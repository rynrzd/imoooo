import { getPlan } from "@/config/plans";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { readSiteSettingRaw } from "./settings";

/**
 * Espace Emails de l'administration — lectures (clé secrète, serveur).
 *
 * Deux sources, toutes deux DÉJÀ présentes en base : aucune migration.
 *
 * - `email_logs` : l'historique. La table existait pour les rappels de loyer
 *   et l'e-mail de bienvenue ; elle porte déjà destinataire, sujet, statut,
 *   erreur et une `dedupe_key` unique par utilisateur — c'est exactement ce
 *   qu'il faut pour tracer un envoi manuel et empêcher un doublon.
 * - `site_settings` : les modèles, sous la clé `email_templates`. Un modèle
 *   est du contenu éditorial, pas une entité métier : le stocker en JSON
 *   évite une table (et donc une migration impossible depuis cette machine)
 *   sans rien perdre.
 *
 * Ce fichier ne fait QUE lire. Les écritures et les envois sont dans
 * `actions/emails.ts`, derrière `requireAdminAction`.
 */

/* ------------------------------------------------------------------ */
/* Nature des envois                                                   */
/* ------------------------------------------------------------------ */

/**
 * D'où vient un envoi. Trois origines et non deux : un rappel de loyer
 * déclenché par un propriétaire depuis son espace n'est ni un envoi de
 * l'administration, ni un automatisme — le confondre avec l'un ou l'autre
 * donnerait un historique faux.
 */
export type EmailOrigin = "admin" | "client" | "auto";

export const EMAIL_ORIGIN_LABELS: Record<EmailOrigin, string> = {
  admin: "Administration",
  client: "Espace client",
  auto: "Automatique",
};

interface KindInfo {
  label: string;
  origin: EmailOrigin;
}

/**
 * Les `kind` réellement écrits dans `email_logs` par le code du projet.
 * Un kind inconnu (ancien envoi, code retiré) reste affiché tel quel plutôt
 * que d'être masqué : l'historique ne doit rien cacher.
 */
export const EMAIL_KINDS: Record<string, KindInfo> = {
  admin_manual: { label: "Message de l’équipe", origin: "admin" },
  welcome: { label: "Bienvenue", origin: "auto" },
  subscription_started: { label: "Nouvel abonnement", origin: "auto" },
  subscription_changed: { label: "Changement d’offre", origin: "auto" },
  subscription_cancelled: { label: "Résiliation", origin: "auto" },
  monthly_report: { label: "Rapport mensuel", origin: "auto" },
  rent_late_auto: { label: "Relance de loyer (automatique)", origin: "auto" },
  rent_late_tenant: { label: "Relance de loyer au locataire", origin: "auto" },
  rent_late_owner: { label: "Alerte loyer au propriétaire", origin: "auto" },
  rent_late_manual: { label: "Relance de loyer", origin: "client" },
  lease_expiring: { label: "Bail bientôt échu", origin: "auto" },
  document_expiring: { label: "Document bientôt expiré", origin: "auto" },
  maintenance_overdue: { label: "Chantier en retard", origin: "auto" },
  test_email: { label: "E-mail de test", origin: "admin" },
};

export function emailKindLabel(kind: string): string {
  return EMAIL_KINDS[kind]?.label ?? kind;
}

export function emailKindOrigin(kind: string): EmailOrigin {
  return EMAIL_KINDS[kind]?.origin ?? "auto";
}

/** Les kinds d'une origine donnée — sert à filtrer côté base. */
function kindsForOrigin(origin: EmailOrigin): string[] {
  return Object.entries(EMAIL_KINDS)
    .filter(([, info]) => info.origin === origin)
    .map(([kind]) => kind);
}

/* ------------------------------------------------------------------ */
/* Historique                                                          */
/* ------------------------------------------------------------------ */

export interface EmailLogItem {
  id: string;
  user_id: string;
  kind: string;
  recipient: string;
  subject: string;
  status: "sent" | "failed";
  error: string | null;
  created_at: string;
  /** Nom du compte destinataire, s'il existe encore. */
  full_name: string;
}

export type EmailView = "tous" | "envoyes" | "automatiques";

export interface EmailLogFilters {
  view: EmailView;
  q?: string;
  page: number;
  perPage: number;
}

export interface EmailLogResult {
  items: EmailLogItem[];
  total: number;
}

export async function listEmailLogs(filters: EmailLogFilters): Promise<EmailLogResult> {
  if (!isAdminConfigured) return { items: [], total: 0 };
  const admin = createAdminClient();

  let query = admin
    .from("email_logs")
    .select("id, user_id, kind, recipient, subject, status, error, created_at", {
      count: "exact",
    });

  if (filters.view === "envoyes") query = query.in("kind", kindsForOrigin("admin"));
  if (filters.view === "automatiques") query = query.in("kind", kindsForOrigin("auto"));

  if (filters.q) {
    // Mêmes précautions que la liste des utilisateurs : les jokers PostgREST
    // sont neutralisés pour que la recherche reste littérale.
    const term = filters.q.replace(/[%_,()]/g, " ").trim();
    if (term) query = query.or(`recipient.ilike.%${term}%,subject.ilike.%${term}%`);
  }

  const from = (filters.page - 1) * filters.perPage;
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, from + filters.perPage - 1);
  if (error) throw new Error(`Lecture de l'historique impossible : ${error.message}`);

  const rows = data ?? [];
  const names = new Map<string, string>();
  const ids = [...new Set(rows.map((r) => r.user_id as string))];
  if (ids.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);
    for (const p of profiles ?? []) names.set(p.id as string, (p.full_name as string) ?? "");
  }

  return {
    total: count ?? 0,
    items: rows.map((r) => ({
      id: r.id as string,
      user_id: r.user_id as string,
      kind: r.kind as string,
      recipient: r.recipient as string,
      subject: r.subject as string,
      status: (r.status as "sent" | "failed") ?? "sent",
      error: (r.error as string | null) ?? null,
      created_at: r.created_at as string,
      full_name: names.get(r.user_id as string) ?? "",
    })),
  };
}

export interface EmailOverview {
  sent30d: number;
  failed30d: number;
  lastSentAt: string | null;
}

/**
 * Trois chiffres, tous comptés en base. Rien n'est estimé : si la table est
 * vide, l'écran affiche zéro et le dit.
 */
export async function getEmailOverview(): Promise<EmailOverview> {
  if (!isAdminConfigured) return { sent30d: 0, failed30d: 0, lastSentAt: null };
  const admin = createAdminClient();
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const [sent, failed, last] = await Promise.all([
    admin
      .from("email_logs")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("created_at", since),
    admin
      .from("email_logs")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", since),
    admin
      .from("email_logs")
      .select("created_at")
      .eq("status", "sent")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    sent30d: sent.count ?? 0,
    failed30d: failed.count ?? 0,
    lastSentAt: (last.data?.created_at as string | undefined) ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Destinataires                                                       */
/* ------------------------------------------------------------------ */

export interface EmailRecipient {
  id: string;
  email: string;
  full_name: string;
  plan: string;
  plan_label: string;
}

function toRecipient(row: Record<string, unknown>): EmailRecipient {
  const plan = (row.plan as string) ?? "free";
  return {
    id: row.id as string,
    email: (row.email as string) ?? "",
    full_name: (row.full_name as string) ?? "",
    plan,
    plan_label: getPlan(plan).name,
  };
}

/**
 * Recherche d'un destinataire parmi les comptes Nireo.
 *
 * `email_logs.user_id` référence `auth.users` : un envoi ne peut donc viser
 * qu'un compte existant. C'est une contrainte, mais une bonne — tout e-mail
 * parti de l'administration reste rattaché à quelqu'un et retrouvable.
 * Les administrateurs sont inclus : c'est ainsi qu'on s'envoie un test.
 */
export async function searchRecipients(q: string, limit = 8): Promise<EmailRecipient[]> {
  if (!isAdminConfigured) return [];
  const term = q.replace(/[%_,()]/g, " ").trim();
  if (term.length < 2) return [];
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id, email, full_name, plan")
    .or(`email.ilike.%${term}%,full_name.ilike.%${term}%`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Recherche impossible : ${error.message}`);
  return (data ?? []).map(toRecipient);
}

export async function getRecipient(userId: string): Promise<EmailRecipient | null> {
  if (!isAdminConfigured) return null;
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id, email, full_name, plan")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`Lecture du destinataire impossible : ${error.message}`);
  return data ? toRecipient(data) : null;
}

/* ------------------------------------------------------------------ */
/* Modèles                                                             */
/* ------------------------------------------------------------------ */

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  updated_at: string;
}

export const EMAIL_TEMPLATES_KEY = "email_templates";

/** Une valeur JSON quelconque devient une liste de modèles valides, ou rien. */
export function coerceTemplates(value: unknown): EmailTemplate[] {
  const container = value as { items?: unknown } | null;
  const items = Array.isArray(value)
    ? value
    : Array.isArray(container?.items)
      ? container.items
      : [];
  const out: EmailTemplate[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const name = typeof o.name === "string" ? o.name : "";
    if (!id || !name) continue;
    out.push({
      id,
      name,
      subject: typeof o.subject === "string" ? o.subject : "",
      body: typeof o.body === "string" ? o.body : "",
      updated_at: typeof o.updated_at === "string" ? o.updated_at : "",
    });
  }
  return out;
}

export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  const value = await readSiteSettingRaw<unknown>(EMAIL_TEMPLATES_KEY, null);
  return coerceTemplates(value);
}
