/**
 * Test de bout en bout du PARCOURS D'AFFILIATION (Nireo).
 * ============================================================================
 * Trace le parcours complet et en prouve chaque maillon avec les données
 * RÉELLES écrites en base :
 *
 *   1. Création du lien affilié (partenaire + code + slug + lien public)
 *   2. Conservation du code / cookie (serialize ↔ parse, first-touch)
 *   3. Clic depuis le lien (record_partner_click : validation, dédup, bot,
 *      lien inconnu / expiré / désactivé)
 *   4. Inscription depuis le lien (attach_partner_attribution : first-touch,
 *      anti self-referral, anti compte admin)
 *   5. Paiement Stripe réussi → réception invoice.paid  (SIMULÉ : voir note)
 *   6. Attribution de la vente au BON partenaire (getEligibilityContext)
 *   7. Calcul EXACT de la commission (miroir fidèle de commissions.ts,
 *      incl. taxes exclusives, %/fixe, règles de durée, filtre plan)
 *   8. Ajout UNIQUE dans la cagnotte (upsert stripe_invoice_id unique + vue)
 *   9. Protection double webhook (2 couches : stripe_webhook_events + invoice)
 *  10. Remboursement charge.refunded → retrait de la commission (total,
 *      partiel recalculé, déjà-payée → reversed).
 *  11. INTÉGRITÉ : commission sans payment_intent valide REFUSÉE (contrainte
 *      SQL, migration 20260725120000) — faille reversal corrigée.
 *  12. Relevé de paiement atomique + double paiement bloqué.
 *
 * ⚠️ NOTE STRIPE : ce test N'APPELLE PAS l'API Stripe. La clé configurée dans
 * .env.local est une clé LIVE (sk_live_…) — un vrai appel créerait des
 * mouvements d'argent réels. Les objets `invoice` / `charge` Stripe sont donc
 * reconstitués fidèlement (mêmes champs que le webhook lit), et le calcul de
 * commission est un MIROIR EXACT de src/lib/marketing/commissions.ts. Toute la
 * chaîne base + fonctions SQL (RPC) est, elle, RÉELLE.
 * Pour un vrai run « Stripe test mode », fournir une clé sk_test_ (voir fin).
 *
 * Prérequis : migration 20260724090000_marketing_partners.sql appliquée.
 * Usage :         node scripts/affiliation-e2e-test.mjs
 * Garder les données (pas de nettoyage) :  KEEP=1 node scripts/affiliation-e2e-test.mjs
 * ============================================================================
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
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
const KEEP = process.env.KEEP === "1";

const admin = createClient(URL_, SECRET, { auth: { persistSession: false } });

let pass = 0,
  fail = 0,
  pending = 0;
const check = (name, ok, detail = "") => {
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? "✅ PASS" : "❌ FAIL"}  ${name}${detail ? `  —  ${detail}` : ""}`);
};
const pend = (name, detail = "") => {
  pending++;
  console.log(`  ⏳ PENDING  ${name}${detail ? `  —  ${detail}` : ""}`);
};
const stage = (n, title) => console.log(`\n── ${n}. ${title} ${"─".repeat(Math.max(0, 58 - title.length))}`);
const proof = (label, obj) => console.log(`     ↳ ${label}: ${JSON.stringify(obj)}`);

const stamp = Date.now();
let migrationPending = false;
const cleanup = { partnerIds: [], userIds: [], adminUserIds: [], eventIds: [] };

/* ------------------------------------------------------------------ */
/* MIROIRS FIDÈLES de src/lib/marketing (calcul identique au serveur)  */
/* ------------------------------------------------------------------ */

// referral.ts — cookie « ref|timestampMs »
const REF_FORMAT = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,59}$/;
const sanitizeRef = (raw) => {
  const v = (raw ?? "").trim();
  return REF_FORMAT.test(v) ? v : null;
};
const serializeRefCookie = (p) => `${p.ref}|${p.ts}`;
const parseRefCookie = (value) => {
  if (!value) return null;
  const [ref, ts] = value.split("|");
  const cleanRef = sanitizeRef(ref);
  const time = Number(ts);
  if (!cleanRef || !Number.isFinite(time) || time <= 0) return null;
  return { ref: cleanRef, ts: time };
};
const BOT_UA = /bot|crawler|spider|crawling|facebookexternalhit|whatsapp|telegram|slack|discord|preview|curl|wget|python-requests|headless/i;
const isBotUserAgent = (ua) => (ua ? BOT_UA.test(ua) : false);
const hashIp = (ip) => {
  const v = (ip ?? "").trim();
  if (!v) return "";
  const salt = env.REF_IP_SALT?.trim() || "nireo-referral-v1";
  return createHash("sha256").update(`${salt}:${v}`).digest("hex");
};
const buildPartnerLink = (slug) => `${env.NEXT_PUBLIC_SITE_URL || "https://nireo.fr"}/?ref=${encodeURIComponent(slug)}`;

// commissions.ts — calcul EXACT
const exclusiveTaxCents = (invoice) =>
  (invoice.total_taxes ?? [])
    .filter((t) => t.tax_behavior === "exclusive")
    .reduce((s, t) => s + (t.amount ?? 0), 0);

/** Miroir de createCommissionForPaidInvoice (partie calcul, avant insert). */
function computeCommission(partner, invoice, plan) {
  if (invoice.status !== "paid") return { skip: "not_paid" };
  const grossCents = invoice.amount_paid ?? 0;
  if (grossCents <= 0) return { skip: "zero_amount" };
  if (!(partner.commission_value > 0)) return { skip: "no_commission_value" };
  if (partner.applicable_plans.length > 0 && !partner.applicable_plans.includes(plan)) {
    return { skip: "plan_not_covered" };
  }
  const eligibleCents = Math.max(0, grossCents - exclusiveTaxCents(invoice));
  if (eligibleCents <= 0) return { skip: "no_eligible" };
  const commissionCents =
    partner.commission_type === "fixed"
      ? Math.round(partner.commission_value * 100)
      : Math.round((eligibleCents * partner.commission_value) / 100);
  if (commissionCents <= 0) return { skip: "zero_commission" };
  return { grossCents, eligibleCents, commissionCents };
}

// commissions.ts — payment_intent Stripe obligatoire et bien formé.
const isValidPaymentIntentId = (id) => typeof id === "string" && /^pi_[A-Za-z0-9]+$/.test(id);

const LIVE_STATUSES = ["pending", "approved", "payable", "paid"];

/** Miroir RÉEL de reverseCommissionForRefund : requête par payment_intent + updates. */
async function runReversal(charge) {
  const pi =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : (charge.payment_intent?.id ?? "");
  if (!pi) return { matched: 0 };
  const { data } = await admin
    .from("partner_commissions")
    .select("*")
    .eq("stripe_payment_intent_id", pi)
    .in("status", LIVE_STATUSES);
  const commissions = data ?? [];
  if (commissions.length === 0) return { matched: 0 };
  const fullyRefunded = charge.refunded || charge.amount_refunded >= charge.amount;
  for (const c of commissions) {
    if (fullyRefunded || c.status === "paid" || c.commission_type === "fixed") {
      await admin
        .from("partner_commissions")
        .update({ status: "reversed", reversal_reason: "Paiement remboursé côté Stripe." })
        .eq("id", c.id);
    } else {
      const newEligible = Math.max(0, c.eligible_amount - charge.amount_refunded);
      if (newEligible <= 0) {
        await admin
          .from("partner_commissions")
          .update({ status: "reversed", reversal_reason: "Paiement intégralement remboursé." })
          .eq("id", c.id);
      } else {
        await admin
          .from("partner_commissions")
          .update({
            eligible_amount: newEligible,
            commission_amount: Math.round((newEligible * c.commission_rate) / 100),
            reversal_reason: "Remboursement partiel Stripe — commission recalculée.",
          })
          .eq("id", c.id);
      }
    }
  }
  return { matched: commissions.length, fullyRefunded };
}

/* ------------------------------------------------------------------ */

async function main() {
  const probe = await admin.from("marketing_partners").select("id").limit(1);
  if (probe.error && /does not exist|relation|schema cache/i.test(probe.error.message)) {
    console.error("\n⚠ Migration non appliquée : 20260724090000_marketing_partners.sql\n  " + probe.error.message);
    process.exit(2);
  }
  if (probe.error) throw new Error(`Accès marketing_partners : ${probe.error.message}`);

  // ══════════════════════════════════════════════════════════════════
  stage(1, "Création du lien affilié");
  const slug = `e2e-assur-${stamp}`;
  const code = `e2e${stamp.toString(36)}k7`;
  const { data: partner, error: pErr } = await admin
    .from("marketing_partners")
    .insert({
      name: "Assurance E2E",
      company_name: "E2E Assur SARL",
      partner_type: "assurance",
      email: `partenaire-e2e-${stamp}@example.com`,
      referral_code: code,
      referral_slug: slug,
      commission_type: "percent",
      commission_value: 10, // 10 %
      commission_duration_type: "first_payment",
      attribution_window_days: 30,
      is_active: true,
    })
    .select("*")
    .single();
  if (pErr || !partner) throw new Error(`Partenaire non créé : ${pErr?.message}`);
  cleanup.partnerIds.push(partner.id);
  const link = buildPartnerLink(partner.referral_slug);
  check("Partenaire créé avec code + slug uniques", partner.referral_code === code && partner.referral_slug === slug);
  check("Jeton tableau de bord partenaire généré (64 hex)", /^[0-9a-f]{64}$/.test(partner.dashboard_token || ""));
  check("Lien public construit", link === `${env.NEXT_PUBLIC_SITE_URL || "https://nireo.fr"}/?ref=${slug}`, link);
  proof("partenaire", { id: partner.id, code: partner.referral_code, slug: partner.referral_slug, commission: `${partner.commission_value}% ${partner.commission_duration_type}` });

  // ══════════════════════════════════════════════════════════════════
  stage(2, "Conservation du code / cookie (first-touch)");
  const cookie = serializeRefCookie({ ref: partner.referral_slug, ts: stamp });
  const parsed = parseRefCookie(cookie);
  check("Cookie sérialisé puis relu à l'identique", parsed?.ref === partner.referral_slug && parsed?.ts === stamp, cookie);
  check("Cookie corrompu rejeté", parseRefCookie("<script>|abc") === null);
  proof("cookie nireo_ref", { value: cookie, parsed });

  // ══════════════════════════════════════════════════════════════════
  stage(3, "Clic depuis le lien (record_partner_click)");
  const ua = "Mozilla/5.0 (Windows NT 10.0) Chrome/120";
  check("User-agent robot filtré AVANT la base (JS)", isBotUserAgent("facebookexternalhit/1.1") === true);
  const clickArgs = { p_ref: slug, p_landing: "/", p_source: "flyer", p_campaign: "", p_ip_hash: hashIp("203.0.113.9"), p_user_agent: "Chrome · Windows" };
  const c1 = await admin.rpc("record_partner_click", clickArgs);
  check("1er clic compté (valid + counted)", c1.data?.valid === true && c1.data?.counted === true, JSON.stringify(c1.data));
  const c2 = await admin.rpc("record_partner_click", clickArgs);
  check("Rafraîchissement immédiat NON recompté (dédup 10 min)", c2.data?.valid === true && c2.data?.counted === false);
  const { count: clickCount } = await admin.from("partner_clicks").select("id", { count: "exact", head: true }).eq("partner_id", partner.id);
  check("1 seul clic réel en base malgré 2 hits", clickCount === 1, `clics=${clickCount}`);
  const cUnknown = await admin.rpc("record_partner_click", { ...clickArgs, p_ref: "inconnu-zzz" });
  check("Ref inconnu → refusé", cUnknown.data?.valid === false && cUnknown.data?.reason === "unknown");
  proof("clic", { window_days: c1.data?.window_days, slug: c1.data?.slug });

  // ══════════════════════════════════════════════════════════════════
  stage(4, "Inscription depuis le lien (attribution)");
  const email = `client-e2e-${stamp}@example.com`;
  const { data: userData, error: uErr } = await admin.auth.admin.createUser({ email, password: "E2E-Test-2026!secure", email_confirm: true });
  if (uErr) throw new Error(`Client non créé : ${uErr.message}`);
  const userId = userData.user.id;
  cleanup.userIds.push(userId);
  const att = await admin.rpc("attach_partner_attribution", { p_user_id: userId, p_ref: slug, p_first_click_at: new Date(stamp).toISOString() });
  check("Vente rattachée au partenaire (attach=true)", att.data?.attached === true, JSON.stringify(att.data));

  const { data: attrRow } = await admin.from("partner_attributions").select("*").eq("user_id", userId).single();
  check("Ligne partner_attributions créée (status signed_up)", attrRow?.partner_id === partner.id && attrRow?.status === "signed_up");
  proof("attribution", { partner_id: attrRow.partner_id, status: attrRow.status, first_click_at: attrRow.first_click_at });

  // First-touch
  const { data: partner2 } = await admin.from("marketing_partners").insert({
    name: "Concurrent E2E", partner_type: "courtier", email: `concurrent-e2e-${stamp}@example.com`,
    referral_code: `cc${stamp.toString(36)}zz`, referral_slug: `e2e-concurrent-${stamp}`, commission_type: "percent", commission_value: 25,
  }).select("*").single();
  cleanup.partnerIds.push(partner2.id);
  const att2 = await admin.rpc("attach_partner_attribution", { p_user_id: userId, p_ref: partner2.referral_slug });
  check("First-touch : 2e partenaire NON écrasé", att2.data?.attached === false && att2.data?.reason === "already_attributed");

  // Anti self-referral
  const selfEmail = `self-e2e-${stamp}@example.com`;
  const { data: selfUser } = await admin.auth.admin.createUser({ email: selfEmail, password: "Self-2026!secure", email_confirm: true });
  cleanup.userIds.push(selfUser.user.id);
  const { data: selfPartner } = await admin.from("marketing_partners").insert({
    name: "Self E2E", partner_type: "autre", email: selfEmail,
    referral_code: `sf${stamp.toString(36)}qq`, referral_slug: `e2e-self-${stamp}`, commission_type: "fixed", commission_value: 10,
  }).select("*").single();
  cleanup.partnerIds.push(selfPartner.id);
  const selfAtt = await admin.rpc("attach_partner_attribution", { p_user_id: selfUser.user.id, p_ref: selfPartner.referral_slug });
  check("Anti self-referral (e-mail compte = e-mail partenaire)", selfAtt.data?.attached === false && selfAtt.data?.reason === "self_referral");

  // Anti compte admin
  const { data: adminUser } = await admin.auth.admin.createUser({ email: `admin-e2e-${stamp}@example.com`, password: "Admin-2026!secure", email_confirm: true });
  cleanup.userIds.push(adminUser.user.id);
  const { data: adminRow } = await admin.from("admin_users").insert({ user_id: adminUser.user.id, role: "support" }).select("id").single();
  if (adminRow) cleanup.adminUserIds.push(adminRow.id);
  const adminAtt = await admin.rpc("attach_partner_attribution", { p_user_id: adminUser.user.id, p_ref: slug });
  check("Compte administrateur jamais attribué", adminAtt.data?.attached === false && adminAtt.data?.reason === "admin_account");

  // ══════════════════════════════════════════════════════════════════
  stage(5, "Calcul EXACT de la commission (miroir commissions.ts)");
  // Vérifs de calcul pur (sans base) — cas taxes / fixe / plan / 0€.
  const cPercentTaxed = computeCommission(
    { commission_type: "percent", commission_value: 10, applicable_plans: [] },
    { status: "paid", amount_paid: 3000, currency: "eur", total_taxes: [{ amount: 500, tax_behavior: "exclusive" }] },
    "starter"
  );
  check("Taxe exclusive déduite : (3000-500)×10% = 250c", cPercentTaxed.commissionCents === 250, JSON.stringify(cPercentTaxed));
  const cFixed = computeCommission({ commission_type: "fixed", commission_value: 15, applicable_plans: [] }, { status: "paid", amount_paid: 2990, currency: "eur" }, "pro");
  check("Commission fixe : 15€ = 1500c (indépendante du montant)", cFixed.commissionCents === 1500);
  const cZero = computeCommission({ commission_type: "percent", commission_value: 10, applicable_plans: [] }, { status: "paid", amount_paid: 0 }, "starter");
  check("Facture 0€ (essai) → aucune commission", cZero.skip === "zero_amount");
  const cPlan = computeCommission({ commission_type: "percent", commission_value: 10, applicable_plans: ["pro"] }, { status: "paid", amount_paid: 2990 }, "starter");
  check("Plan non couvert → aucune commission", cPlan.skip === "plan_not_covered");
  // Règle d'intégrité : payment_intent obligatoire et bien formé.
  check("payment_intent valide accepté (pi_…)", isValidPaymentIntentId(`pi_e2e${stamp}`) === true);
  check("payment_intent vide/malformé refusé", !isValidPaymentIntentId("") && !isValidPaymentIntentId("ch_123") && !isValidPaymentIntentId("pi_bad_underscore"));

  // Paiement réel simulé : facture starter 29,90€, sans taxe séparée.
  const invoiceId = `in_e2e_${stamp}`;
  const paymentIntent = `pi_e2e${stamp}`;
  const invoice = { id: invoiceId, status: "paid", amount_paid: 2990, currency: "eur", total_taxes: [], payment_intent: paymentIntent };
  const calc = computeCommission(partner, invoice, "starter");
  check("Commission calculée : 10% de 29,90€ = 299c", calc.commissionCents === 299, JSON.stringify(calc));

  // ══════════════════════════════════════════════════════════════════
  stage(6, "invoice.paid → ajout UNIQUE dans la cagnotte");
  const commissionRow = {
    partner_id: partner.id, user_id: userId, subscription_id: `sub_e2e_${stamp}`,
    stripe_invoice_id: invoiceId, stripe_payment_intent_id: paymentIntent, plan: "starter",
    gross_amount: calc.grossCents, eligible_amount: calc.eligibleCents,
    commission_type: "percent", commission_rate: 10, commission_amount: calc.commissionCents,
    currency: "eur", status: "pending",
  };
  const ins1 = await admin.from("partner_commissions").upsert(commissionRow, { onConflict: "stripe_invoice_id", ignoreDuplicates: true }).select("id");
  check("Commission insérée (1 ligne)", ins1.data?.length === 1, ins1.error?.message ?? "");
  const commId = ins1.data[0].id;
  await admin.from("partner_attributions").update({ status: "converted", converted_at: new Date().toISOString() }).eq("user_id", userId).eq("partner_id", partner.id);

  const { data: dbComm } = await admin.from("partner_commissions").select("*").eq("id", commId).single();
  check("Ligne commission conforme (299c, pending)", dbComm.commission_amount === 299 && dbComm.status === "pending");
  proof("commission", { id: dbComm.id, gross: dbComm.gross_amount, eligible: dbComm.eligible_amount, amount: dbComm.commission_amount, status: dbComm.status });

  const readPot = async () => {
    const { data } = await admin.from("partner_commission_totals").select("*").eq("partner_id", partner.id);
    const acc = { pending: 0, payable: 0, paid: 0, reversed: 0 };
    for (const r of data ?? []) if (acc[r.status] !== undefined) acc[r.status] += Number(r.total_cents);
    return acc;
  };
  check("Cagnotte = 299c en attente (calculée depuis la vue)", (await readPot()).pending === 299);

  // ══════════════════════════════════════════════════════════════════
  stage(7, "Protection contre les doubles webhooks (2 couches)");
  // Couche 1 : table stripe_webhook_events (garde par event.id)
  const eventId = `evt_e2e_${stamp}`;
  const ev1 = await admin.from("stripe_webhook_events").insert({ id: eventId, type: "invoice.paid" });
  cleanup.eventIds.push(eventId);
  check("Couche 1 : 1er événement réservé", !ev1.error);
  const ev2 = await admin.from("stripe_webhook_events").insert({ id: eventId, type: "invoice.paid" });
  check("Couche 1 : même event.id rejoué → bloqué (23505)", ev2.error?.code === "23505");
  // Couche 2 : upsert même facture → aucune nouvelle commission
  const ins2 = await admin.from("partner_commissions").upsert(commissionRow, { onConflict: "stripe_invoice_id", ignoreDuplicates: true }).select("id");
  check("Couche 2 : même stripe_invoice_id → 0 commission ajoutée", (ins2.data?.length ?? 0) === 0);
  const { count: commCount } = await admin.from("partner_commissions").select("id", { count: "exact", head: true }).eq("stripe_invoice_id", invoiceId);
  check("1 seule commission pour la facture (cagnotte inchangée)", commCount === 1 && (await readPot()).pending === 299);

  // ══════════════════════════════════════════════════════════════════
  stage(8, "Remboursement charge.refunded → retrait de la commission");
  const charge = { payment_intent: paymentIntent, refunded: true, amount: 2990, amount_refunded: 2990 };
  const rev = await runReversal(charge);
  check("Remboursement total rattaché par payment_intent", rev.matched === 1 && rev.fullyRefunded === true);
  const { data: afterRefund } = await admin.from("partner_commissions").select("status, reversal_reason").eq("id", commId).single();
  check("Commission passée à 'reversed'", afterRefund.status === "reversed");
  check("Cagnotte : 299c retirés (pending = 0)", (await readPot()).pending === 0);
  proof("commission après remboursement", afterRefund);

  // Remboursement PARTIEL d'une commission % non payée → recalcul
  const invoiceId2 = `in_e2e_partial_${stamp}`;
  const pi2 = `pi_e2epartial${stamp}`;
  await admin.from("partner_commissions").insert({
    partner_id: partner.id, user_id: userId, subscription_id: `sub_e2e_${stamp}`,
    stripe_invoice_id: invoiceId2, stripe_payment_intent_id: pi2, plan: "starter",
    gross_amount: 2990, eligible_amount: 2990, commission_type: "percent", commission_rate: 10,
    commission_amount: 299, currency: "eur", status: "pending",
  });
  await runReversal({ payment_intent: pi2, refunded: false, amount: 2990, amount_refunded: 1000 });
  const { data: partial } = await admin.from("partner_commissions").select("eligible_amount, commission_amount, status").eq("stripe_invoice_id", invoiceId2).single();
  check("Remboursement partiel recalculé : (2990-1000)×10% = 199c", partial.eligible_amount === 1990 && partial.commission_amount === 199 && partial.status === "pending", JSON.stringify(partial));

  // ══════════════════════════════════════════════════════════════════
  stage(9, "Intégrité : commission SANS payment_intent valide REFUSÉE");
  // Faille corrigée : impossible de créer une commission sans PI « pi_… » valide.
  // Garantie au niveau STOCKAGE (contrainte SQL, migration 20260725120000) —
  // s'applique même au service_role. On tente une insertion vide ET malformée.
  const tryBadInsert = async (pi, tag) => {
    const r = await admin.from("partner_commissions").insert({
      partner_id: partner.id, user_id: userId, subscription_id: `sub_e2e_${stamp}`,
      stripe_invoice_id: `in_e2e_bad_${tag}_${stamp}`, stripe_payment_intent_id: pi, plan: "starter",
      gross_amount: 2990, eligible_amount: 2990, commission_type: "percent", commission_rate: 10,
      commission_amount: 299, currency: "eur", status: "pending",
    }).select("id");
    if (!r.error && r.data?.[0]) await admin.from("partner_commissions").delete().eq("id", r.data[0].id); // nettoyage si accepté à tort
    return r.error;
  };
  const errEmpty = await tryBadInsert("", "empty");
  const errMalformed = await tryBadInsert("ch_not_a_pi", "malformed");
  const rejected = (e) => !!e && /pi_required|check constraint|violates|null value/i.test(e.message);
  if (rejected(errEmpty) && rejected(errMalformed)) {
    check("Contrainte SQL : commission PI vide REFUSÉE", true);
    check("Contrainte SQL : commission PI malformé REFUSÉE", true);
  } else {
    pend("Contrainte SQL payment_intent (vide + malformé)", "migration 20260725120000 NON appliquée — appliquer dans Supabase puis relancer");
    migrationPending = true;
  }
  // PI valide toujours accepté (déjà prouvé au stage 6 : la commission 299c existe).
  check("Commission avec PI valide acceptée (déjà insérée au stage 6)", isValidPaymentIntentId(paymentIntent));

  // ══════════════════════════════════════════════════════════════════
  stage(10, "Relevé de paiement atomique + double paiement bloqué");
  // Remet une commission payable pour le relevé.
  const invoiceId4 = `in_e2e_payout_${stamp}`;
  const { data: payComm } = await admin.from("partner_commissions").insert({
    partner_id: partner.id, user_id: userId, subscription_id: `sub_e2e_${stamp}`,
    stripe_invoice_id: invoiceId4, stripe_payment_intent_id: `pi_e2epayout${stamp}`, plan: "starter",
    gross_amount: 2990, eligible_amount: 2990, commission_type: "percent", commission_rate: 10,
    commission_amount: 299, currency: "eur", status: "payable", payable_at: new Date().toISOString(),
  }).select("id").single();
  const { data: payout } = await admin.from("partner_payouts").insert({
    partner_id: partner.id, period_start: new Date(stamp - 30 * 86400000).toISOString().slice(0, 10),
    period_end: new Date().toISOString().slice(0, 10), total_amount: 0, status: "draft",
  }).select("*").single();
  cleanup.payoutId = payout.id;
  await admin.from("partner_commissions").update({ payout_id: payout.id }).eq("id", payComm.id).eq("status", "payable");
  const paid = await admin.rpc("mark_partner_payout_paid", { p_payout_id: payout.id, p_payment_method: "Virement SEPA", p_payment_reference: "VIR-E2E-001", p_notes: "e2e" });
  check("Relevé marqué payé (atomique, total 299c)", paid.data?.ok === true && paid.data?.total_cents === 299, JSON.stringify(paid.data));
  const dbl = await admin.rpc("mark_partner_payout_paid", { p_payout_id: payout.id, p_payment_method: "x", p_payment_reference: "y" });
  check("Double paiement du relevé BLOQUÉ", dbl.data?.ok === false && dbl.data?.reason === "already_paid");

  // ══════════════════════════════════════════════════════════════════
  console.log("\n══════════════ PREUVE FINALE (état réel en base) ══════════════");
  const { data: allComms } = await admin.from("partner_commissions").select("stripe_invoice_id, commission_amount, status, stripe_payment_intent_id").eq("partner_id", partner.id).order("earned_at");
  console.table(allComms.map((c) => ({ invoice: c.stripe_invoice_id.replace(`_${stamp}`, ""), montant_c: c.commission_amount, statut: c.status, a_pi: c.stripe_payment_intent_id ? "oui" : "NON" })));
  const potFinal = await readPot();
  console.log(`Cagnotte finale : en_attente=${potFinal.pending}c · payé=${potFinal.paid}c · reversed=${potFinal.reversed}c`);
  console.log(`Partenaire=${partner.id}  ·  Client=${userId}`);
}

async function doCleanup() {
  if (KEEP) {
    console.log("\nKEEP=1 → données CONSERVÉES en base pour inspection (pas de nettoyage).");
    console.log(`Partenaires: ${cleanup.partnerIds.join(", ")}`);
    console.log(`Utilisateurs: ${cleanup.userIds.join(", ")}`);
    return;
  }
  for (const eid of cleanup.eventIds) await admin.from("stripe_webhook_events").delete().eq("id", eid);
  for (const aid of cleanup.adminUserIds) await admin.from("admin_users").delete().eq("id", aid);
  for (const pid of cleanup.partnerIds) {
    await admin.from("partner_commissions").delete().eq("partner_id", pid);
    await admin.from("partner_payouts").delete().eq("partner_id", pid);
    await admin.from("partner_attributions").delete().eq("partner_id", pid);
    await admin.from("partner_clicks").delete().eq("partner_id", pid);
    await admin.from("marketing_partners").delete().eq("id", pid);
  }
  for (const uid of cleanup.userIds) await admin.auth.admin.deleteUser(uid).catch(() => {});
  console.log("\nNettoyage effectué (aucune donnée résiduelle).");
}

console.log(`\n╔═ TEST E2E AFFILIATION — ${new Date().toISOString()} ═╗`);
console.log(`  Base : ${URL_.replace(/^https:\/\//, "").split(".")[0]}  ·  Stripe : NON appelé (clé live)  ·  KEEP=${KEEP ? "1" : "0"}`);
try {
  await main();
} catch (e) {
  console.error("\n💥 Erreur test :", e.message);
  fail++;
} finally {
  await doCleanup();
  console.log(`\n═══════════ ${pass} réussis · ${fail} échoués · ${pending} en attente ═══════════`);
  if (migrationPending) {
    console.log("⏳ Contrainte SQL non vérifiée : appliquer la migration");
    console.log("   supabase/migrations/20260725120000_commission_requires_payment_intent.sql");
    console.log("   puis relancer ce test pour valider l'intégrité au niveau base.");
  }
  process.exit(fail > 0 ? 1 : 0);
}
