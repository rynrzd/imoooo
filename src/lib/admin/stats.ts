import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { isStripeConfigured } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PaidPlanId } from "@/config/plans";
import { auditActionLabel } from "./labels";

/**
 * Statistiques du tableau de bord administrateur — données RÉELLES
 * (Supabase + Stripe), aucune donnée fictive. Les comptes administrateurs
 * sont exclus de toutes les statistiques clients : un admin n'est pas un
 * client Nireo.
 */

const ACTIVE_OR = "lifetime_access.is.true,status.in.(active,trialing,past_due)";
const PAID_PLANS: PaidPlanId[] = ["starter", "pro", "business"];

/**
 * Ce que le tableau de bord affiche EN HAUT.
 *
 * Volontairement court. La version précédente alignait quatorze tuiles :
 * quatorze chiffres côte à côte ne hiérarchisent rien, et la moitié
 * (« nouveaux sur 30 jours », « codes promo utilisés ») appartient aux
 * pages qui les traitent vraiment. Ce qui reste ici répond à quatre
 * questions qu'on se pose en ouvrant l'administration : combien de monde,
 * combien paient, combien c'est rentré, et qu'est-ce qui cloche.
 */
export interface DashboardStats {
  totalUsers: number;
  newUsers7: number;
  freeUsers: number;
  planCounts: Record<PaidPlanId, number>;
  founderMembers: number;
  activeSubscriptions: number;
  pastDueSubscriptions: number;
}

/**
 * user_id de tous les administrateurs (exclus des statistiques clients).
 *
 * Mémorisé pour la DURÉE D'UNE REQUÊTE (`cache` de React) : le tableau de
 * bord appelle `getDashboardStats` et `getRecentActivity`, la page
 * Utilisateurs appelle `listUsers` — chacun avait besoin de cette liste et
 * la redemandait. C'est la même réponse à quelques millisecondes
 * d'intervalle ; une seule lecture suffit. Le cache ne survit pas à la
 * requête, donc un administrateur ajouté est pris en compte immédiatement.
 */
export const getAdminUserIds = cache(
  async (admin: SupabaseClient): Promise<string[]> => {
    const { data, error } = await admin.from("admin_users").select("user_id");
    if (error) throw new Error(`Lecture des administrateurs impossible : ${error.message}`);
    return (data ?? []).map((r) => r.user_id as string);
  }
);

/** Filtre PostgREST « id hors administrateurs » (no-op sans admins). */
function excludeIds(ids: string[]): string | null {
  return ids.length > 0 ? `(${ids.join(",")})` : null;
}

async function count(
  build: () => PromiseLike<{ count: number | null; error: { message: string } | null }>
): Promise<number> {
  const { count: value, error } = await build();
  if (error) throw new Error(error.message);
  return value ?? 0;
}

/**
 * Encaissements Stripe du mois (factures payées + achats Fondateur).
 *
 * SORTI du chemin bloquant du tableau de bord : c'est le seul chiffre qui
 * dépend d'un appel réseau à Stripe (jusqu'à trois allers-retours), et il
 * retardait l'affichage des sept autres, tous lus en base. La page le rend
 * désormais dans son propre `<Suspense>` — le reste s'affiche sans
 * l'attendre. Aucune valeur n'est pour autant estimée : la tuile montre un
 * état d'attente, puis le montant réel.
 */
export async function getMonthlyRevenueCents(): Promise<number | null> {
  return monthlyRevenue(createAdminClient());
}

async function monthlyRevenue(admin: SupabaseClient): Promise<number | null> {
  if (!isStripeConfigured) return null;
  try {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const stripe = getStripe();
    let total = 0;
    // Factures d'abonnement payées ce mois-ci (plafonné à 300 factures).
    let startingAfter: string | undefined;
    for (let i = 0; i < 3; i++) {
      const invoices = await stripe.invoices.list({
        status: "paid",
        created: { gte: Math.floor(monthStart.getTime() / 1000) },
        limit: 100,
        starting_after: startingAfter,
      });
      for (const invoice of invoices.data) total += invoice.amount_paid;
      if (!invoices.has_more) break;
      startingAfter = invoices.data[invoices.data.length - 1]?.id;
    }
    // Paiements uniques Fondateur confirmés ce mois-ci (déjà en base).
    const { data, error } = await admin
      .from("founder_purchases")
      .select("amount_cents")
      .eq("status", "confirmed")
      .gte("confirmed_at", monthStart.toISOString());
    if (error) throw new Error(error.message);
    for (const row of data ?? []) total += row.amount_cents ?? 0;
    return total;
  } catch (e) {
    logger.error("admin/stats", e);
    return null;
  }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const admin = createAdminClient();
  const adminIds = await getAdminUserIds(admin);
  const excluded = excludeIds(adminIds);

  const profilesBase = () => {
    let query = admin.from("profiles").select("id", { count: "exact", head: true });
    if (excluded) query = query.not("id", "in", excluded);
    return query;
  };
  const subsBase = () => {
    let query = admin.from("subscriptions").select("id", { count: "exact", head: true });
    if (excluded) query = query.not("user_id", "in", excluded);
    return query;
  };

  const iso7 = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const [
    totalUsers,
    newUsers7,
    starter,
    pro,
    business,
    activeSubscriptions,
    pastDueSubscriptions,
    founderMembers,
  ] = await Promise.all([
    count(() => profilesBase()),
    count(() => profilesBase().gte("created_at", iso7)),
    count(() => subsBase().eq("plan", "starter").or(ACTIVE_OR)),
    count(() => subsBase().eq("plan", "pro").or(ACTIVE_OR)),
    count(() => subsBase().eq("plan", "business").or(ACTIVE_OR)),
    count(() => subsBase().in("plan", PAID_PLANS).or(ACTIVE_OR)),
    count(() => subsBase().eq("status", "past_due")),
    count(() =>
      admin
        .from("founder_purchases")
        .select("id", { count: "exact", head: true })
        .eq("status", "confirmed")
    ),
  ]);

  const paidTotal = starter + pro + business;
  return {
    totalUsers,
    newUsers7,
    freeUsers: Math.max(0, totalUsers - paidTotal),
    planCounts: { starter, pro, business },
    founderMembers,
    activeSubscriptions,
    pastDueSubscriptions,
  };
}

/* ------------------------------------------------------------------ */
/* Activité récente                                                    */
/* ------------------------------------------------------------------ */

export type ActivityTone = "neutral" | "positive" | "danger";

export interface ActivityItem {
  id: string;
  label: string;
  detail: string;
  href: string | null;
  at: string;
  tone: ActivityTone;
}

/**
 * Un seul fil, chronologique, au lieu de quatre encarts séparés.
 *
 * Quatre listes côte à côte obligent à comparer mentalement quatre suites
 * de dates pour reconstituer ce qui s'est passé. Ici tout est fusionné et
 * trié : on lit de haut en bas.
 *
 * Chaque ligne vient d'une table réelle — `profiles` (comptes créés),
 * `subscriptions` (abonnements et incidents de paiement) et
 * `admin_audit_logs` (actions administratives). Rien n'est déduit ni
 * reconstitué : un événement absent de ces tables n'apparaît pas.
 */
export async function getRecentActivity(limit = 15): Promise<ActivityItem[]> {
  const admin = createAdminClient();
  const adminIds = await getAdminUserIds(admin);
  const excluded = excludeIds(adminIds);

  let accountsQuery = admin
    .from("profiles")
    .select("id, email, full_name, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (excluded) accountsQuery = accountsQuery.not("id", "in", excluded);

  let subsQuery = admin
    .from("subscriptions")
    .select("user_id, plan, status, updated_at")
    .neq("plan", "free")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (excluded) subsQuery = subsQuery.not("user_id", "in", excluded);

  const [{ data: accounts }, { data: subs }, { data: audit }] = await Promise.all([
    accountsQuery,
    subsQuery,
    admin
      .from("admin_audit_logs")
      .select("id, admin_email, action, target_label, result, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  const items: ActivityItem[] = [];

  for (const row of accounts ?? []) {
    items.push({
      id: `account-${row.id}`,
      label: "Nouveau compte",
      detail: (row.full_name as string) || (row.email as string) || "Compte sans nom",
      href: `/admin/utilisateurs/${row.id}`,
      at: row.created_at as string,
      tone: "neutral",
    });
  }

  // Le statut de l'abonnement dit lui-même de quel événement il s'agit :
  // inutile d'inventer un historique que la table ne conserve pas.
  const emails = new Map<string, string>();
  const subIds = (subs ?? []).map((s) => s.user_id as string);
  if (subIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email")
      .in("id", subIds);
    for (const p of profiles ?? []) emails.set(p.id as string, (p.email as string) ?? "");
  }

  for (const row of subs ?? []) {
    const userId = row.user_id as string;
    const status = row.status as string;
    const who = emails.get(userId) || userId;
    let label = "Abonnement mis à jour";
    let tone: ActivityTone = "neutral";
    if (status === "active" || status === "trialing") {
      label = "Abonnement actif";
      tone = "positive";
    } else if (status === "canceled") {
      label = "Résiliation";
      tone = "danger";
    } else if (status === "past_due" || status === "unpaid") {
      label = "Paiement en retard";
      tone = "danger";
    }
    items.push({
      id: `sub-${userId}-${row.updated_at}`,
      label,
      detail: `${who} · ${row.plan as string}`,
      href: `/admin/utilisateurs/${userId}`,
      at: row.updated_at as string,
      tone,
    });
  }

  for (const row of audit ?? []) {
    items.push({
      id: `audit-${row.id}`,
      label: auditActionLabel(row.action as string),
      detail: [row.admin_email as string, row.target_label as string].filter(Boolean).join(" → "),
      href: "/admin/audit",
      at: row.created_at as string,
      tone: row.result === "error" ? "danger" : "neutral",
    });
  }

  return items
    .filter((item) => Boolean(item.at))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}
