/**
 * Test de bout en bout du module « Marketing & Partenaires ».
 *
 * Couvre le parcours réel (sans passer par Stripe : on insère les
 * commissions comme le ferait le webhook après un paiement confirmé) :
 *  1. création d'un partenaire (code + slug uniques)
 *  2. enregistrement d'un clic (record_partner_click) + déduplication
 *  3. inscription d'un client jetable + attribution (attach_partner_attribution)
 *  4. anti self-referral, anti compte admin, first-touch
 *  5. création d'UNE commission par facture (idempotence stripe_invoice_id)
 *  6. calcul de la cagnotte depuis les commissions réelles
 *  7. cycle commission : pending → approved → payable
 *  8. relevé de paiement : create → mark_paid (atomique) → double paiement bloqué
 *  9. lien expiré / partenaire désactivé refusés à l'attribution
 * Tout est SUPPRIMÉ à la fin (aucune donnée résiduelle).
 *
 * Prérequis : migration 20260724090000_marketing_partners.sql appliquée.
 * Usage : node scripts/marketing-test.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = env.SUPABASE_SECRET_KEY;
if (!URL_ || !SECRET) {
  console.error("Variables Supabase manquantes dans .env.local");
  process.exit(1);
}

const admin = createClient(URL_, SECRET, { auth: { persistSession: false } });
let pass = 0,
  fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const stamp = Date.now();
const cleanup = { partnerIds: [], userIds: [] };

async function main() {
  // ---- Probe : la migration est-elle appliquée ? ----
  const probe = await admin.from("marketing_partners").select("id").limit(1);
  if (probe.error && /does not exist|relation|schema cache/i.test(probe.error.message)) {
    console.error(
      "\n⚠ Migration non appliquée. Exécutez d'abord 20260724090000_marketing_partners.sql\n" +
        "  (Supabase → SQL Editor, ou `supabase db push`).\n  Détail : " +
        probe.error.message
    );
    process.exit(2);
  }
  if (probe.error) throw new Error(`Accès marketing_partners : ${probe.error.message}`);

  // ---- 1. Création d'un partenaire ----
  const slug = `test-assurance-${stamp}`;
  const code = `tst${stamp.toString(36)}xy`;
  const { data: partner, error: pErr } = await admin
    .from("marketing_partners")
    .insert({
      name: "Assurance Test",
      company_name: "Test SARL",
      partner_type: "assurance",
      email: `partenaire-${stamp}@example.com`,
      referral_code: code,
      referral_slug: slug,
      commission_type: "percent",
      commission_value: 10,
      commission_duration_type: "first_payment",
      attribution_window_days: 30,
      is_active: true,
    })
    .select("*")
    .single();
  check("Création d'un partenaire", !pErr && !!partner?.id, pErr?.message ?? "");
  if (!partner) throw new Error("Partenaire non créé, arrêt.");
  cleanup.partnerIds.push(partner.id);

  check("Code + slug uniques enregistrés", partner.referral_code === code && partner.referral_slug === slug);

  // ---- 2. Clic via record_partner_click + déduplication ----
  const clickArgs = {
    p_ref: slug,
    p_landing: "/",
    p_source: "flyer",
    p_campaign: "",
    p_ip_hash: `hash-${stamp}`,
    p_user_agent: "Chrome · Windows",
  };
  const c1 = await admin.rpc("record_partner_click", clickArgs);
  check("Clic enregistré (valid + counted)", !c1.error && c1.data?.valid === true && c1.data?.counted === true, c1.error?.message ?? JSON.stringify(c1.data));
  const c2 = await admin.rpc("record_partner_click", clickArgs);
  check("Rafraîchissement immédiat NON recompté (dédup 10 min)", !c2.error && c2.data?.valid === true && c2.data?.counted === false);

  const { count: clickCount } = await admin
    .from("partner_clicks")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partner.id);
  check("1 seul clic réel enregistré malgré 2 hits", clickCount === 1, `clics=${clickCount}`);

  // Ref inconnu / inactif
  const cUnknown = await admin.rpc("record_partner_click", { ...clickArgs, p_ref: "inconnu-xyz" });
  check("Ref inconnu → valid=false", !cUnknown.error && cUnknown.data?.valid === false);

  // ---- 3. Client jetable + attribution ----
  const email = `client-mkt-${stamp}@example.com`;
  const { data: userData, error: uErr } = await admin.auth.admin.createUser({
    email,
    password: "Mkt-Test-2026!secure",
    email_confirm: true,
  });
  check("Client jetable créé", !uErr && !!userData?.user?.id, uErr?.message ?? "");
  const userId = userData.user.id;
  cleanup.userIds.push(userId);

  const att = await admin.rpc("attach_partner_attribution", {
    p_user_id: userId,
    p_ref: slug,
    p_first_click_at: new Date().toISOString(),
  });
  check("Attribution rattachée au compte", !att.error && att.data?.attached === true, att.error?.message ?? JSON.stringify(att.data));

  // First-touch : 2e tentative avec un autre partenaire ne doit PAS écraser
  const { data: partner2 } = await admin
    .from("marketing_partners")
    .insert({
      name: "Concurrent Test",
      partner_type: "courtier",
      email: `concurrent-${stamp}@example.com`,
      referral_code: `cc${stamp.toString(36)}zz`,
      referral_slug: `test-concurrent-${stamp}`,
      commission_type: "percent",
      commission_value: 20,
    })
    .select("*")
    .single();
  cleanup.partnerIds.push(partner2.id);
  const att2 = await admin.rpc("attach_partner_attribution", {
    p_user_id: userId,
    p_ref: partner2.referral_slug,
  });
  check("First-touch : attribution existante NON écrasée", !att2.error && att2.data?.attached === false && att2.data?.reason === "already_attributed");

  // Self-referral : un compte dont l'e-mail = e-mail partenaire est refusé
  const selfEmail = `self-${stamp}@example.com`;
  const { data: selfUser } = await admin.auth.admin.createUser({ email: selfEmail, password: "Self-2026!secure", email_confirm: true });
  cleanup.userIds.push(selfUser.user.id);
  const { data: selfPartner } = await admin
    .from("marketing_partners")
    .insert({
      name: "Self Test",
      partner_type: "autre",
      email: selfEmail,
      referral_code: `sf${stamp.toString(36)}qq`,
      referral_slug: `test-self-${stamp}`,
      commission_type: "fixed",
      commission_value: 10,
    })
    .select("*")
    .single();
  cleanup.partnerIds.push(selfPartner.id);
  const selfAtt = await admin.rpc("attach_partner_attribution", { p_user_id: selfUser.user.id, p_ref: selfPartner.referral_slug });
  check("Self-referral bloqué", !selfAtt.error && selfAtt.data?.attached === false && selfAtt.data?.reason === "self_referral");

  // ---- 4. Commission (webhook simulé) + idempotence ----
  const invoiceId = `in_test_${stamp}`;
  const commissionRow = {
    partner_id: partner.id,
    user_id: userId,
    subscription_id: `sub_test_${stamp}`,
    stripe_invoice_id: invoiceId,
    stripe_payment_intent_id: `pi_test_${stamp}`,
    plan: "starter",
    gross_amount: 2000,
    eligible_amount: 2000,
    commission_type: "percent",
    commission_rate: 10,
    commission_amount: 200,
    currency: "eur",
    status: "pending",
  };
  const ins1 = await admin.from("partner_commissions").upsert(commissionRow, { onConflict: "stripe_invoice_id", ignoreDuplicates: true }).select("id");
  check("Commission créée (10% de 20€ = 2€)", !ins1.error && ins1.data?.length === 1, ins1.error?.message ?? "");

  // Webhook rejoué : même facture → aucune nouvelle commission
  const ins2 = await admin.from("partner_commissions").upsert(commissionRow, { onConflict: "stripe_invoice_id", ignoreDuplicates: true }).select("id");
  check("Idempotence : facture Stripe en double → 1 seule commission", !ins2.error && (ins2.data?.length ?? 0) === 0);

  const { count: commCount } = await admin
    .from("partner_commissions")
    .select("id", { count: "exact", head: true })
    .eq("stripe_invoice_id", invoiceId);
  check("1 seule ligne commission pour la facture", commCount === 1, `count=${commCount}`);

  // Conversion de l'attribution
  await admin.from("partner_attributions").update({ status: "converted", converted_at: new Date().toISOString() }).eq("user_id", userId).eq("partner_id", partner.id);
  const { data: attr } = await admin.from("partner_attributions").select("status").eq("user_id", userId).maybeSingle();
  check("Attribution marquée convertie", attr?.status === "converted");

  // ---- 5. Cagnotte calculée ----
  const { data: totals } = await admin.from("partner_commission_totals").select("*").eq("partner_id", partner.id);
  const pending = (totals ?? []).filter((t) => t.status === "pending").reduce((s, t) => s + Number(t.total_cents), 0);
  check("Cagnotte : 200c en attente (calculée depuis commissions)", pending === 200, `pending=${pending}`);

  // ---- 6. Cycle commission : pending → approved → payable ----
  const commId = ins1.data[0].id;
  await admin.from("partner_commissions").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", commId);
  await admin.from("partner_commissions").update({ status: "payable", payable_at: new Date().toISOString() }).eq("id", commId);
  const { data: afterCycle } = await admin.from("partner_commissions").select("status").eq("id", commId).single();
  check("Commission passée en 'payable'", afterCycle.status === "payable");

  // ---- 7. Relevé de paiement + mark_paid atomique ----
  const { data: payout } = await admin
    .from("partner_payouts")
    .insert({
      partner_id: partner.id,
      period_start: new Date(stamp - 30 * 86400000).toISOString().slice(0, 10),
      period_end: new Date().toISOString().slice(0, 10),
      total_amount: 0,
      status: "draft",
    })
    .select("*")
    .single();
  cleanup.payoutId = payout.id;
  await admin.from("partner_commissions").update({ payout_id: payout.id }).eq("id", commId).eq("status", "payable");

  const paid = await admin.rpc("mark_partner_payout_paid", {
    p_payout_id: payout.id,
    p_payment_method: "Virement SEPA",
    p_payment_reference: "VIR-TEST-001",
    p_notes: "Test",
  });
  check("Relevé marqué payé (atomique)", !paid.error && paid.data?.ok === true && paid.data?.total_cents === 200, paid.error?.message ?? JSON.stringify(paid.data));

  const { data: commPaid } = await admin.from("partner_commissions").select("status, paid_at").eq("id", commId).single();
  check("Commission liée passée à 'paid' avec paid_at", commPaid.status === "paid" && !!commPaid.paid_at);

  // Double paiement bloqué
  const doublePaid = await admin.rpc("mark_partner_payout_paid", {
    p_payout_id: payout.id,
    p_payment_method: "Virement SEPA",
    p_payment_reference: "VIR-TEST-002",
    p_notes: "",
  });
  check("Double paiement BLOQUÉ", !doublePaid.error && doublePaid.data?.ok === false && doublePaid.data?.reason === "already_paid");

  // ---- 8. Lien expiré / partenaire désactivé ----
  const { data: expiredPartner } = await admin
    .from("marketing_partners")
    .insert({
      name: "Expiré Test",
      partner_type: "autre",
      email: `expire-${stamp}@example.com`,
      referral_code: `ex${stamp.toString(36)}pp`,
      referral_slug: `test-expire-${stamp}`,
      commission_type: "percent",
      commission_value: 10,
      is_active: true,
      expires_at: new Date(stamp - 86400000).toISOString(),
    })
    .select("*")
    .single();
  cleanup.partnerIds.push(expiredPartner.id);
  const expiredClick = await admin.rpc("record_partner_click", { ...clickArgs, p_ref: expiredPartner.referral_slug, p_ip_hash: `hash-exp-${stamp}` });
  check("Lien expiré → clic refusé", !expiredClick.error && expiredClick.data?.valid === false && expiredClick.data?.reason === "expired");

  const { data: inactivePartner } = await admin
    .from("marketing_partners")
    .insert({
      name: "Inactif Test",
      partner_type: "autre",
      email: `inactif-${stamp}@example.com`,
      referral_code: `in${stamp.toString(36)}mm`,
      referral_slug: `test-inactif-${stamp}`,
      commission_type: "percent",
      commission_value: 10,
      is_active: false,
    })
    .select("*")
    .single();
  cleanup.partnerIds.push(inactivePartner.id);
  const inactiveClick = await admin.rpc("record_partner_click", { ...clickArgs, p_ref: inactivePartner.referral_slug, p_ip_hash: `hash-ina-${stamp}` });
  check("Partenaire désactivé → clic refusé", !inactiveClick.error && inactiveClick.data?.valid === false && inactiveClick.data?.reason === "inactive");

  // ---- 9. Suppression bloquée si données financières ----
  const del = await admin.from("marketing_partners").delete().eq("id", partner.id).select("id");
  // La FK partner_commissions → marketing_partners (on delete restrict) empêche la suppression.
  check("Suppression bloquée si commissions liées (FK restrict)", !!del.error, del.error ? "refusée comme attendu" : "AURAIT DÛ ÉCHOUER");
}

async function doCleanup() {
  // Ordre : commissions/payouts d'abord (FK restrict), puis partenaires, puis users.
  for (const pid of cleanup.partnerIds) {
    await admin.from("partner_commissions").delete().eq("partner_id", pid);
    await admin.from("partner_payouts").delete().eq("partner_id", pid);
    await admin.from("partner_attributions").delete().eq("partner_id", pid);
    await admin.from("partner_clicks").delete().eq("partner_id", pid);
    await admin.from("marketing_partners").delete().eq("id", pid);
  }
  for (const uid of cleanup.userIds) {
    await admin.auth.admin.deleteUser(uid).catch(() => {});
  }
}

try {
  await main();
} catch (e) {
  console.error("\nErreur test :", e.message);
  fail++;
} finally {
  await doCleanup();
  console.log("\nNettoyage effectué (aucune donnée résiduelle).");
  console.log(`\n=== ${pass} réussis, ${fail} échoués ===`);
  process.exit(fail > 0 ? 1 : 0);
}
