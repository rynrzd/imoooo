import type { Metadata } from "next";
import Link from "next/link";
import { SubscriptionActions } from "@/components/admin/subscription-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PLAN_LABELS, SUBSCRIPTION_STATUS_LABELS } from "@/lib/admin/labels";
import { getAdminUserIds } from "@/lib/admin/stats";
import { FOUNDER_TIERS, getPlan } from "@/config/plans";
import { formatAdminDate } from "@/lib/admin/format";
import { isStripeConfigured } from "@/lib/stripe/config";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Abonnements" };
export const dynamic = "force-dynamic";

const PER_PAGE = 25;

const SELECT_CLASS =
  "h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none transition-colors " +
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40";

interface SubscriptionListRow {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  provider: string;
  lifetime_access: boolean;
  founder_tier: number | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
}

/** Type de paiement lisible — jamais « Paiement unique » par défaut. */
function paymentType(row: SubscriptionListRow): { label: string; tone: string } {
  if (row.lifetime_access) return { label: "Fondateur · à vie", tone: "founder" };
  if (row.provider === "stripe" && row.stripe_subscription_id)
    return { label: "Abonnement mensuel", tone: "sub" };
  if (row.provider === "founder") return { label: "Fondateur", tone: "founder" };
  if (row.provider === "manual") return { label: "Attribution manuelle", tone: "manual" };
  if (row.plan === "free") return { label: "Gratuit", tone: "free" };
  return { label: "—", tone: "unknown" };
}

/** Montant lisible selon le type (mensuel, Fondateur unique, sinon —). */
function amountLabel(row: SubscriptionListRow): string {
  if (row.lifetime_access || row.provider === "founder") {
    const tier = FOUNDER_TIERS.find((t) => t.tier === row.founder_tier);
    return tier ? `${tier.price} € · paiement unique` : "Paiement unique";
  }
  if (row.provider === "stripe" && row.stripe_subscription_id) {
    return `${getPlan(row.plan).monthlyPrice.toFixed(2).replace(".", ",")} € / mois`;
  }
  return "—";
}

const TYPE_TONE: Record<string, string> = {
  founder: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  sub: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  manual: "border-border bg-muted text-muted-foreground",
  free: "border-border bg-muted text-muted-foreground",
  unknown: "border-border bg-muted text-muted-foreground",
};

const TH = "px-3 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap";
const TD = "px-3 py-3 align-middle text-sm whitespace-nowrap";

/** /admin/abonnements — vue et actions Stripe (source de vérité paiements). */
export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const plan = typeof params.plan === "string" ? params.plan : "";
  const statut = typeof params.statut === "string" ? params.statut : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);

  const admin = createAdminClient();
  const adminIds = await getAdminUserIds(admin);

  let query = admin
    .from("subscriptions")
    .select(
      "id, user_id, plan, status, provider, lifetime_access, founder_tier, cancel_at_period_end, " +
        "stripe_customer_id, stripe_subscription_id, current_period_start, " +
        "current_period_end, created_at",
      { count: "exact" }
    )
    .neq("plan", "free");
  if (adminIds.length > 0) query = query.not("user_id", "in", `(${adminIds.join(",")})`);
  if (plan && ["starter", "pro", "business"].includes(plan)) query = query.eq("plan", plan);
  if (statut === "echec") {
    query = query.eq("status", "past_due");
  } else if (statut && ["active", "trialing", "past_due", "canceled", "inactive"].includes(statut)) {
    query = query.eq("status", statut);
  }

  const from = (page - 1) * PER_PAGE;
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, from + PER_PAGE - 1);
  if (error) throw new Error(`Lecture des abonnements impossible : ${error.message}`);
  const rows = (data ?? []) as unknown as SubscriptionListRow[];
  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));

  // E-mails, réductions utilisées, statut de modération (accès suspendu ?).
  const userIds = rows.map((r) => r.user_id);
  const emails = new Map<string, string>();
  const discounts = new Map<string, string>();
  const suspended = new Set<string>();
  if (userIds.length > 0) {
    const [{ data: profiles }, { data: redemptions }, { data: moderation }] = await Promise.all([
      admin.from("profiles").select("id, email").in("id", userIds),
      admin.from("promo_code_redemptions").select("user_id, promo_codes(code)").in("user_id", userIds),
      admin.from("user_moderation").select("user_id, status").in("user_id", userIds),
    ]);
    for (const p of profiles ?? []) emails.set(p.id as string, (p.email as string) ?? "");
    for (const r of redemptions ?? []) {
      const code = (r.promo_codes as { code?: string } | null)?.code;
      if (code) discounts.set(r.user_id as string, code);
    }
    for (const m of moderation ?? []) {
      if ((m.status as string) === "suspended" || (m.status as string) === "banned") {
        suspended.add(m.user_id as string);
      }
    }
  }

  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (plan) sp.set("plan", plan);
    if (statut) sp.set("statut", statut);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `/admin/abonnements${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="animate-page-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Abonnements</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {total} abonnement{total > 1 ? "s" : ""} payant{total > 1 ? "s" : ""}. Stripe reste la
          source de vérité des paiements — chaque action est exécutée côté Stripe puis synchronisée.
          {!isStripeConfigured ? " Stripe n’est pas configuré : les actions Stripe sont indisponibles." : ""}
        </p>
      </div>

      <form
        className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/60 p-3"
        action="/admin/abonnements"
        method="get"
      >
        <select name="plan" defaultValue={plan} className={SELECT_CLASS} aria-label="Filtrer par plan">
          <option value="">Tous les plans</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="business">Business+</option>
        </select>
        <select name="statut" defaultValue={statut} className={SELECT_CLASS} aria-label="Filtrer par statut">
          <option value="">Tous les statuts</option>
          <option value="active">Actifs</option>
          <option value="trialing">Essai</option>
          <option value="echec">Paiements échoués</option>
          <option value="canceled">Annulés</option>
          <option value="inactive">Inactifs</option>
        </select>
        <Button type="submit" variant="outline" size="sm">
          Filtrer
        </Button>
      </form>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className={TH}>Client</th>
                <th className={TH}>Plan</th>
                <th className={TH}>Statut</th>
                <th className={TH}>Type</th>
                <th className={TH}>Montant</th>
                <th className={TH}>Réduction</th>
                <th className={TH}>Début</th>
                <th className={TH}>Prochaine échéance</th>
                <th className={TH}>Annulation prévue</th>
                <th className={TH}>Stripe</th>
                <th className={`${TH} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-12 text-center text-sm text-muted-foreground">
                    Aucun abonnement ne correspond à ces critères.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const canStripe = isStripeConfigured && Boolean(row.stripe_subscription_id);
                  const billable = ["active", "trialing", "past_due"].includes(row.status);
                  const type = paymentType(row);
                  const isSuspended = suspended.has(row.user_id);
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/30"
                    >
                      <td className={TD}>
                        <Link
                          href={`/admin/utilisateurs/${row.user_id}`}
                          className="block max-w-52 truncate font-medium hover:underline"
                        >
                          {emails.get(row.user_id) || row.user_id}
                        </Link>
                        {isSuspended ? (
                          <span className="mt-0.5 inline-block text-[11px] font-medium text-amber-600 dark:text-amber-400">
                            Accès suspendu
                          </span>
                        ) : null}
                      </td>
                      <td className={TD}>
                        <Badge variant="secondary">{PLAN_LABELS[row.plan] ?? row.plan}</Badge>
                      </td>
                      <td className={TD}>
                        <StatusBadge status={row.status} cancelScheduled={row.cancel_at_period_end} />
                      </td>
                      <td className={TD}>
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                            TYPE_TONE[type.tone] ?? TYPE_TONE.unknown
                          }`}
                        >
                          {type.label}
                        </span>
                      </td>
                      <td className={`${TD} text-muted-foreground`}>{amountLabel(row)}</td>
                      <td className={`${TD} text-muted-foreground`}>
                        {discounts.get(row.user_id) ?? "—"}
                      </td>
                      <td className={`${TD} text-muted-foreground`}>
                        {row.current_period_start
                          ? formatAdminDate(row.current_period_start)
                          : formatAdminDate(row.created_at)}
                      </td>
                      <td className={`${TD} text-muted-foreground`}>
                        {row.lifetime_access
                          ? "—"
                          : row.current_period_end
                            ? formatAdminDate(row.current_period_end)
                            : "—"}
                      </td>
                      <td className={`${TD} text-muted-foreground`}>
                        {row.cancel_at_period_end && row.current_period_end ? (
                          <span className="font-medium text-amber-600 dark:text-amber-400">
                            {formatAdminDate(row.current_period_end)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={TD}>
                        {row.stripe_subscription_id ? (
                          <code
                            className="block max-w-36 truncate text-xs text-muted-foreground"
                            title={`${row.stripe_customer_id ?? ""} / ${row.stripe_subscription_id}`}
                          >
                            {row.stripe_subscription_id}
                          </code>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className={`${TD} text-right`}>
                        <div className="flex justify-end">
                          <SubscriptionActions
                            userId={row.user_id}
                            email={emails.get(row.user_id) || row.user_id}
                            canStripe={canStripe}
                            billable={billable}
                            cancelScheduled={row.cancel_at_period_end}
                            suspended={isSuspended}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} / {pageCount}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className="underline-offset-2 hover:underline">
                ← Précédente
              </Link>
            ) : null}
            {page < pageCount ? (
              <Link href={pageHref(page + 1)} className="underline-offset-2 hover:underline">
                Suivante →
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <p className="text-xs leading-relaxed text-muted-foreground">
        « Suspendre l’accès » bloque la connexion à Nireo sans toucher à l’abonnement Stripe (accès
        rétablissable). Le changement de plan d’un client se fait depuis sa fiche
        (Utilisateurs → fiche → Abonnement) : il passe par Stripe quand l’abonnement est facturé.
      </p>
    </div>
  );
}

function StatusBadge({ status, cancelScheduled }: { status: string; cancelScheduled: boolean }) {
  const label = SUBSCRIPTION_STATUS_LABELS[status] ?? status;
  const cls =
    status === "active" || status === "trialing"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : status === "past_due"
        ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
        : "border-border bg-muted text-muted-foreground";
  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className={`inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>
        {label}
      </span>
      {cancelScheduled ? (
        <span className="text-[11px] text-amber-600 dark:text-amber-400">fin programmée</span>
      ) : null}
    </span>
  );
}
