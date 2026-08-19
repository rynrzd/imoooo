import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CreditCard, Euro, Users } from "lucide-react";
import { StatCard } from "@/components/admin/stat-card";
import { formatAdminDateTime } from "@/lib/admin/format";
import { getDashboardStats, getRecentActivity, type ActivityTone } from "@/lib/admin/stats";
import { isStripeConfigured } from "@/lib/stripe/config";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tableau de bord" };
export const dynamic = "force-dynamic";

function euros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
    cents / 100
  );
}

/** Couleur de la pastille d'un événement — le seul usage de couleur ici. */
const TONE_DOT: Record<ActivityTone, string> = {
  neutral: "bg-muted-foreground/40",
  positive: "bg-emerald-500",
  danger: "bg-destructive",
};

/**
 * /admin — ce qu'on veut savoir en ouvrant l'administration.
 *
 * Quatre chiffres, la répartition des offres, puis un fil d'activité. Pas
 * quatorze tuiles : un tableau de bord qui montre tout ne montre rien.
 * Chaque valeur vient de Supabase ou de Stripe ; quand une source est
 * indisponible, l'écran affiche « — » et le dit, il n'estime jamais.
 */
export default async function AdminDashboardPage() {
  const [stats, activity] = await Promise.all([getDashboardStats(), getRecentActivity()]);

  const paid = stats.planCounts.starter + stats.planCounts.pro + stats.planCounts.business;
  const distribution = [
    { label: "Gratuit", value: stats.freeUsers, className: "bg-muted-foreground/30" },
    { label: "Starter", value: stats.planCounts.starter, className: "bg-primary/40" },
    { label: "Pro", value: stats.planCounts.pro, className: "bg-primary/70" },
    { label: "Business+", value: stats.planCounts.business, className: "bg-primary" },
  ];
  const total = stats.freeUsers + paid;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Tableau de bord</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          L’essentiel de Nireo. Le détail vit dans les pages dédiées.
        </p>
      </div>

      {/* ---------------- Vue d'ensemble ---------------- */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Comptes clients"
          value={String(stats.totalUsers)}
          hint={
            stats.newUsers7 > 0
              ? `+${stats.newUsers7} cette semaine`
              : "aucune inscription cette semaine"
          }
          icon={Users}
        />
        <StatCard
          label="Abonnements actifs"
          value={String(stats.activeSubscriptions)}
          hint={
            stats.founderMembers > 0
              ? `dont ${stats.founderMembers} Fondateur${stats.founderMembers > 1 ? "s" : ""}`
              : undefined
          }
          icon={CreditCard}
        />
        <StatCard
          label="Encaissé ce mois"
          value={stats.monthlyRevenueCents === null ? "—" : euros(stats.monthlyRevenueCents)}
          hint={
            isStripeConfigured
              ? "factures payées + Fondateur"
              : "Stripe non connecté : chiffre indisponible"
          }
          icon={Euro}
        />
        <StatCard
          label="Paiements en retard"
          value={String(stats.pastDueSubscriptions)}
          hint={stats.pastDueSubscriptions > 0 ? "à traiter" : "rien à signaler"}
          icon={AlertTriangle}
        />
      </section>

      {/* ---------------- Répartition des offres ---------------- */}
      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium">Répartition des comptes</h2>
          <Link
            href="/admin/abonnements"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Voir les abonnements
          </Link>
        </div>

        {total === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Aucun compte pour le moment.</p>
        ) : (
          <>
            {/* Une seule barre : les proportions se lisent d'un coup d'œil,
                là où quatre tuiles obligeaient à faire le calcul. */}
            <div
              className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={distribution
                .map((part) => `${part.label} : ${part.value}`)
                .join(", ")}
            >
              {distribution.map((part) =>
                part.value > 0 ? (
                  <span
                    key={part.label}
                    className={part.className}
                    style={{ width: `${(part.value / total) * 100}%` }}
                  />
                ) : null
              )}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
              {distribution.map((part) => (
                <li key={part.label} className="flex items-center gap-1.5 text-xs">
                  <span className={cn("size-2 rounded-full", part.className)} aria-hidden />
                  <span className="text-muted-foreground">{part.label}</span>
                  <span className="font-medium tabular-nums">{part.value}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* ---------------- Activité récente ---------------- */}
      <section className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4 pb-2">
          <h2 className="text-sm font-medium">Activité récente</h2>
          <Link
            href="/admin/audit"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Journal complet
          </Link>
        </div>

        {activity.length === 0 ? (
          <p className="px-4 pt-2 pb-4 text-sm text-muted-foreground">
            Rien à afficher pour le moment.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {activity.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-4 py-2.5">
                <span
                  aria-hidden
                  className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", TONE_DOT[item.tone])}
                />
                <div className="min-w-0 flex-1">
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="block truncate text-sm font-medium underline-offset-2 hover:underline"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <p className="truncate text-sm font-medium">{item.label}</p>
                  )}
                  <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatAdminDateTime(item.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
