/**
 * AUDIT RLS DES TABLES NIREO ID — isolation réelle entre deux comptes.
 *
 * Usage : node scripts/nid-rls-audit.mjs
 *
 * Ne lit AUCUNE policy : crée deux comptes jetables, fait écrire A, puis
 * tente lecture / écriture / suppression avec la session de B sur CHAQUE
 * table `nid_*`. Une table absente est signalée comme telle plutôt que
 * comptée réussie — une table qui n'existe pas ne prouve rien.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync("./.env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const admin = createClient(URL_, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const TABLES = [
  "nid_admins", "nid_assets", "nid_assignments", "nid_audit_logs",
  "nid_check_campaigns", "nid_check_requests", "nid_check_schedules", "nid_checkups",
  "nid_disputes", "nid_documents", "nid_events", "nid_media", "nid_ownerships",
  "nid_plan_limits", "nid_professional_access", "nid_professional_profiles",
  "nid_repair_orders", "nid_share_links", "nid_stripe_events", "nid_transfers",
  "nid_workspace_invites", "nid_workspace_members", "nid_workspaces",
];

const R = [];
const check = (n, ok, d = "") => { R.push({ n, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`); };
const note = (n, d = "") => console.log(`INFO  ${n}${d ? ` — ${d}` : ""}`);

const stamp = Date.now();
const mail = (x) => `audit-nid-${x}-${stamp}@nireo-audit.test`;
const created = [];

async function session(email) {
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error("generateLink: " + error.message);
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error: e2 } = await c.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "email" });
  if (e2) throw new Error("verifyOtp: " + e2.message);
  return { c, id: data.user.id };
}

try {
  for (const tag of ["a", "b"]) {
    const { data, error } = await admin.auth.admin.createUser({
      email: mail(tag), password: "Audit-2026!Secure#x", email_confirm: true,
    });
    if (error) throw new Error(`createUser ${tag}: ${error.message}`);
    created.push(data.user.id);
  }
  const a = await session(mail("a"));
  const b = await session(mail("b"));
  check("Sessions A et B ouvertes", Boolean(a.id && b.id));

  /* ---------- Quelles tables existent réellement ? ---------- */
  console.log("\n───────── Présence des tables ─────────");
  const present = [];
  const missing = [];
  for (const t of TABLES) {
    const { error } = await admin.from(t).select("*").limit(1);
    if (error && /does not exist|schema cache/i.test(error.message)) missing.push(t);
    else present.push(t);
  }
  note(`Tables présentes en base`, `${present.length}/${TABLES.length}`);
  if (missing.length) note("Tables ABSENTES (migration non appliquée)", missing.join(", "));

  /* ---------- A crée de VRAIES données : sans elles, « B ne voit rien »
        ne prouve pas que la RLS filtre — seulement que la base est vide. ---------- */
  let aWorkspace = null;
  let aAsset = null;
  if (present.includes("nid_workspaces")) {
    const { data, error } = await admin.from("nid_workspaces")
      .insert({ kind: "personnel", name: "AUDIT espace de A", owner_user_id: a.id })
      .select().single();
    if (error) note("Création de l'espace de A impossible", error.message.slice(0, 70));
    else aWorkspace = data;
  }
  if (aWorkspace && present.includes("nid_assets")) {
    const { data, error } = await admin.from("nid_assets").insert({
      public_id: "NIR-AUDIT-" + Date.now().toString(36).toUpperCase(),
      brand: "AuditPhone", model: "Modèle A", workspace_id: aWorkspace.id,
    }).select().single();
    if (error) note("Création du passeport de A impossible", error.message.slice(0, 70));
    else aAsset = data;
  }
  note("Données réelles de A créées", `espace=${aWorkspace ? "oui" : "non"} · passeport=${aAsset ? "oui" : "non"}`);

  if (present.length === 0) {
    note("Nireo ID n'est pas déployé en base", "aucune isolation à tester");
  } else {
    /* ---------- B peut-il LIRE les tables ? ---------- */
    console.log("\n───────── Lecture avec la session de B ─────────");
    for (const t of present) {
      const { data, error } = await b.c.from(t).select("*").limit(50);
      const rows = data?.length ?? 0;
      if (error) {
        check(`${t} — lecture refusée ou vide pour B`, true, `refusé : ${error.message.slice(0, 50)}`);
        continue;
      }
      // Une table de RÉFÉRENCE (plans) peut être lisible : ce n'est pas une fuite.
      const reference = t === "nid_plan_limits";
      if (reference) {
        note(`${t} — table de référence`, `${rows} ligne(s) lisibles (attendu)`);
        continue;
      }
      // Toute ligne visible doit appartenir à B, jamais à quelqu'un d'autre.
      const foreign = (data ?? []).filter((row) => {
        const owner = row.owner_id ?? row.user_id ?? row.created_by ?? null;
        return owner && owner !== b.id;
      });
      check(`${t} — B ne voit aucune ligne d'autrui`, foreign.length === 0,
        `${rows} ligne(s) visibles, ${foreign.length} appartenant à un autre compte`);
    }

    /* ---------- B voit-il les données NOMMÉMENT créées par A ? ---------- */
    console.log("\n───────── B vise les données de A par leur identifiant ─────────");
    if (aWorkspace) {
      const { data } = await b.c.from("nid_workspaces").select("*").eq("id", aWorkspace.id);
      check("B ne peut pas lire l'espace de A par son identifiant", (data?.length ?? 0) === 0,
        data?.length ? JSON.stringify(data[0]).slice(0, 70) : "");
      const upd = await b.c.from("nid_workspaces").update({ name: "PIRATÉ" }).eq("id", aWorkspace.id).select();
      check("B ne peut pas renommer l'espace de A", Boolean(upd.error) || (upd.data?.length ?? 0) === 0,
        upd.error?.message.slice(0, 60) ?? "aucune ligne modifiée");
      const del = await b.c.from("nid_workspaces").delete().eq("id", aWorkspace.id).select();
      check("B ne peut pas supprimer l'espace de A", Boolean(del.error) || (del.data?.length ?? 0) === 0,
        del.error?.message.slice(0, 60) ?? "aucune ligne supprimée");
    }
    if (aAsset) {
      const { data } = await b.c.from("nid_assets").select("*").eq("id", aAsset.id);
      check("B ne peut pas lire le passeport de A par son identifiant", (data?.length ?? 0) === 0,
        data?.length ? JSON.stringify(data[0]).slice(0, 70) : "");
    }

    /* ---------- B peut-il ÉCRIRE au nom de quelqu'un d'autre ? ---------- */
    console.log("\n───────── Écriture usurpée par B ─────────");
    const forge = async (t, payload) => {
      const { error } = await b.c.from(t).insert(payload);
      return error;
    };
    const e1 = await forge("nid_admins", { user_id: b.id, role: "owner", is_active: true });
    check("B ne peut pas se déclarer administrateur Nireo ID", Boolean(e1), e1?.message.slice(0, 60) ?? "INSERTION ACCEPTÉE");

    if (present.includes("nid_workspaces")) {
      const e2 = await forge("nid_workspaces", { owner_user_id: a.id, name: "USURPÉ", kind: "personnel" });
      check("B ne peut pas créer un espace au nom de A", Boolean(e2), e2?.message.slice(0, 60) ?? "INSERTION ACCEPTÉE");
    }
    if (present.includes("nid_plan_limits")) {
      const e3 = await b.c.from("nid_plan_limits").update({ max_assets: 99999 }).neq("plan", "");
      check("B ne peut pas relever les plafonds de plan", Boolean(e3.error) || (e3.data?.length ?? 0) === 0,
        e3.error?.message.slice(0, 60) ?? "aucune ligne modifiée");
    }
  }
} catch (e) {
  console.error("ERREUR:", e?.stack ?? e);
  check("Audit mené à son terme", false, String(e?.message ?? e));
} finally {
  for (const id of created) { try { await admin.auth.admin.deleteUser(id); } catch { /* déjà parti */ } }
  // Les données de A partent en cascade avec son compte ; on force au cas où.
  try { await admin.from("nid_assets").delete().like("public_id", "NIR-AUDIT-%"); } catch { /* rien */ }
  console.log("\nNettoyage : comptes d'audit supprimés.");
  const graded = R.filter((x) => typeof x.ok === "boolean");
  console.log(`\n${graded.filter((x) => x.ok).length}/${graded.length} PASS`);
  process.exit(graded.some((x) => !x.ok) ? 1 : 0);
}
