import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  BadgePercent,
  CreditCard,
  Crown,
  Euro,
  UserPlus,
  Users,
} from "lucide-react";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { auditActionLabel, PLAN_LABELS, SUBSCRIPTION_STATUS_LABELS } from "@/lib/admin/labels";
import { getDashboardStats } from "@/lib/admin/stats";
import { formatDate } from "@/lib/format";
import { isStripeConfigured } from "@/lib/stripe/config";

export const metadata: Metadata = { title: "Tableau de bord" };
export const dynamic = "force-dynamic";

function euros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
    cents / 100
  );
}

/** Tableau de bord administrateur — données réelles Supabase + Stripe. */
export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Tableau de bord</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue d&apos;ensemble de Nireo — utilisateurs, abonnements et activité.
        </p>
      </div>

      {/* Utilisateurs */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Utilisateurs" value={String(stats.totalUsers)} icon={Users} />
        <StatCard
          label="Actifs (30 j)"
          value={stats.activeUsers30 === null ? "—" : String(stats.activeUsers30)}
          hint={stats.activeUsers30 === null ? "Indisponible" : "Dernière connexion < 30 j"}
          icon={Users}
        />
        <StatCard
          label="Nouveaux (7 j)"
          value={String(stats.newUsers7)}
          icon={UserPlus}
        />
        <StatCard
          label="Nouveaux (30 j)"
          value={String(stats.newUsers30)}
          icon={UserPlus}
        />
      </section>

      {/* Plans */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Gratuit" value={String(stats.freeUsers)} />
        <StatCard label="Starter" value={String(stats.planCounts.starter)} />
        <StatCard label="Pro" value={String(stats.planCounts.pro)} />
        <StatCard label="Business+" value={String(stats.planCounts.business)} />
        <StatCard
          label="Fondateurs"
          value={String(stats.founderMembers)}
          icon={Crown}
          className="col-span-2 lg:col-span-1"
        />
      </section>

      {/* Abonnements & revenus */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="Abonnements actifs"
          value={String(stats.activeSubscriptions)}
          icon={CreditCard}
        />
        <StatCard label="Annulés" value={String(stats.canceledSubscriptions)} />
        <StatCard
          label="Paiements en retard"
          value={String(stats.pastDueSubscriptions)}
          icon={AlertTriangle}
        />
        <StatCard
          label="Encaissé ce mois"
          value={stats.monthlyRevenueCents === null ? "—" : euros(stats.monthlyRevenueCents)}
          hint={isStripeConfigured ? "Stripe (factures payées + Fondateur)" : "Stripe non connecté"}
          icon={Euro}
        />
        <StatCard
          label="Codes promo utilisés"
          value={String(stats.promoRedemptions)}
          icon={BadgePercent}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {/* Derniers comptes */}
        <div className="rounded-xl bg-card ring-1 ring-foreground/10">
          <div className="flex items-center justify-between px-4 pt-4">
            <h2 className="text-sm font-medium">Derniers comptes créés</h2>
            <Link
              href="/admin/utilisateurs"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Tout voir
            </Link>
          </div>
          <div className="mt-2 divide-y divide-border/60 px-4 pb-3">
            {stats.recentAccounts.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">Aucun compte pour le moment.</p>
            ) : (
              stats.recentAccounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/utilisateurs/${account.id}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {account.full_name || account.email || "Compte sans nom"}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">{account.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline">{PLAN_LABELS[account.plan] ?? account.plan}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(account.created_at)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Derniers abonnements */}
        <div className="rounded-xl bg-card ring-1 ring-foreground/10">
          <div className="flex items-center justify-between px-4 pt-4">
            <h2 className="text-sm font-medium">Derniers abonnements</h2>
            <Link
              href="/admin/abonnements"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Tout voir
            </Link>
          </div>
          <div className="mt-2 divide-y divide-border/60 px-4 pb-3">
            {stats.recentSubscriptions.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">
                Aucun abonnement payant pour le moment.
              </p>
            ) : (
              stats.recentSubscriptions.map((sub) => (
                <div
                  key={`${sub.user_id}-${sub.updated_at}`}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/admin/utilisateurs/${sub.user_id}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {sub.email || sub.user_id}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {PLAN_LABELS[sub.plan] ?? sub.plan} ·{" "}
                      {SUBSCRIPTION_STATUS_LABELS[sub.status] ?? sub.status}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(sub.updated_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Erreurs récentes */}
        <div className="rounded-xl bg-card ring-1 ring-foreground/10">
          <div className="flex items-center justify-between px-4 pt-4">
            <h2 className="text-sm font-medium">Erreurs importantes</h2>
            <Link
              href="/admin/audit?resultat=error"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Tout voir
            </Link>
          </div>
          <div className="mt-2 divide-y divide-border/60 px-4 pb-3">
            {stats.recentErrors.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">Aucune erreur enregistrée.</p>
            ) : (
              stats.recentErrors.map((row) => (
                <div key={row.id} className="py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-destructive">
                      {auditActionLabel(row.action)}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(row.created_at)}
                    </span>
                  </div>
                  {row.detail ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.detail}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Activité récente */}
        <div className="rounded-xl bg-card ring-1 ring-foreground/10">
          <div className="flex items-center justify-between px-4 pt-4">
            <h2 className="text-sm font-medium">Activité récente</h2>
            <Link
              href="/admin/audit"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Journal complet
            </Link>
          </div>
          <div className="mt-2 divide-y divide-border/60 px-4 pb-3">
            {stats.recentActivity.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">
                Aucune action administrative pour le moment.
              </p>
            ) : (
              stats.recentActivity.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{auditActionLabel(row.action)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.admin_email}
                      {row.target_label ? ` → ${row.target_label}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(row.created_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
