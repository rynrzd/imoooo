import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton, ConfirmAction } from "@/components/admin/confirm-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  cancelSubscriptionAtPeriodEnd,
  cancelSubscriptionNow,
  syncSubscriptionFromStripe,
} from "@/lib/admin/actions/subscriptions";
import { PLAN_LABELS, SUBSCRIPTION_STATUS_LABELS } from "@/lib/admin/labels";
import { getAdminUserIds } from "@/lib/admin/stats";
import { getPlan } from "@/config/plans";
import { formatDate } from "@/lib/format";
import { isStripeConfigured } from "@/lib/stripe/config";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Abonnements" };
export const dynamic = "force-dynamic";

const PER_PAGE = 25;

const SELECT_CLASS =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none " +
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

interface SubscriptionListRow {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  provider: string;
  lifetime_access: boolean;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
}

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
      "id, user_id, plan, status, provider, lifetime_access, cancel_at_period_end, " +
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

  // E-mails + réductions utilisées (registre local alimenté par le webhook).
  const userIds = rows.map((r) => r.user_id);
  const emails = new Map<string, string>();
  const discounts = new Map<string, string>();
  if (userIds.length > 0) {
    const [{ data: profiles }, { data: redemptions }] = await Promise.all([
      admin.from("profiles").select("id, email").in("id", userIds),
      admin
        .from("promo_code_redemptions")
        .select("user_id, promo_codes(code)")
        .in("user_id", userIds),
    ]);
    for (const p of profiles ?? []) emails.set(p.id as string, (p.email as string) ?? "");
    for (const r of redemptions ?? []) {
      const code = (r.promo_codes as { code?: string } | null)?.code;
      if (code) discounts.set(r.user_id as string, code);
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
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Abonnements</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total} abonnement{total > 1 ? "s" : ""} payant{total > 1 ? "s" : ""} — Stripe reste la
          source de vérité des paiements.
          {!isStripeConfigured ? " Stripe n'est pas configuré : actions Stripe indisponibles." : ""}
        </p>
      </div>

      <form className="flex flex-wrap items-center gap-2" action="/admin/abonnements" method="get">
        <select name="plan" defaultValue={plan} className={SELECT_CLASS} aria-label="Filtrer par plan">
          <option value="">Tous les plans</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="business">Business+</option>
        </select>
        <select
          name="statut"
          defaultValue={statut}
          className={SELECT_CLASS}
          aria-label="Filtrer par statut"
        >
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

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Début</TableHead>
              <TableHead>Échéance</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Réduction</TableHead>
              <TableHead>Stripe</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  Aucun abonnement ne correspond à ces critères.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const canStripe = isStripeConfigured && Boolean(row.stripe_subscription_id);
                const billable = ["active", "trialing", "past_due"].includes(row.status);
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/admin/utilisateurs/${row.user_id}`}
                        className="block max-w-52 truncate font-medium hover:underline"
                      >
                        {emails.get(row.user_id) || row.user_id}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {PLAN_LABELS[row.plan] ?? row.plan}
                        {row.lifetime_access ? " · à vie" : ""}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.status === "past_due"
                            ? "destructive"
                            : row.status === "canceled" || row.status === "inactive"
                              ? "outline"
                              : "secondary"
                        }
                      >
                        {SUBSCRIPTION_STATUS_LABELS[row.status] ?? row.status}
                        {row.cancel_at_period_end ? " · fin programmée" : ""}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.current_period_start
                        ? formatDate(row.current_period_start)
                        : formatDate(row.created_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.current_period_end ? formatDate(row.current_period_end) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.lifetime_access
                        ? "Paiement unique"
                        : `${getPlan(row.plan).monthlyPrice.toFixed(2).replace(".", ",")} € / mois`}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {discounts.get(row.user_id) ?? "—"}
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell>
                      {canStripe ? (
                        <div className="flex flex-wrap gap-1.5">
                          <ActionButton
                            label="Sync"
                            size="xs"
                            action={syncSubscriptionFromStripe.bind(null, row.user_id)}
                          />
                          {billable && !row.cancel_at_period_end ? (
                            <ConfirmAction
                              label="Annuler"
                              size="xs"
                              title="Annuler à la fin de la période"
                              description="L'abonnement Stripe sera résilié à la prochaine échéance : le client conserve l'accès déjà payé."
                              confirmLabel="Annuler à échéance"
                              action={cancelSubscriptionAtPeriodEnd.bind(null, row.user_id)}
                            />
                          ) : null}
                          {billable ? (
                            <ConfirmAction
                              label="Couper"
                              size="xs"
                              variant="destructive"
                              title="Annulation immédiate"
                              description="L'abonnement Stripe est résilié tout de suite : l'accès payant du client est coupé immédiatement."
                              confirmLabel="Annuler immédiatement"
                              requiredPhrase="ANNULER"
                              action={cancelSubscriptionNow.bind(null, row.user_id)}
                            />
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {row.lifetime_access ? "Fondateur" : "Hors Stripe"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
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

      <p className="text-xs text-muted-foreground">
        Le changement de plan d&apos;un client se fait depuis sa fiche (
        <span className="whitespace-nowrap">Utilisateurs → fiche → Abonnement</span>) : il passe
        par Stripe quand l&apos;abonnement est facturé, jamais par une simple écriture en base.
      </p>
    </div>
  );
}
