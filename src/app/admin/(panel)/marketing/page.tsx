import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  MousePointerClick,
  Users,
  UserCheck,
  Wallet,
  TrendingUp,
  CircleDollarSign,
  Clock,
  BadgeCheck,
  Handshake,
} from "lucide-react";
import { StatCard } from "@/components/admin/stat-card";
import { MarketingTrendChart } from "@/components/admin/marketing/marketing-trend-chart";
import { Button } from "@/components/ui/button";
import {
  getMarketingOverview,
  getMarketingTrend,
  getTopPartners,
  PERIOD_LABELS,
  periodStart,
  sanitizePeriod,
  type MarketingPeriod,
} from "@/lib/marketing/stats";
import { formatCents } from "@/lib/marketing/types";
import { isStripeConfigured } from "@/lib/stripe/config";

export const metadata: Metadata = { title: "Marketing & Partenaires" };
export const dynamic = "force-dynamic";

const PERIODS: MarketingPeriod[] = ["7j", "30j", "90j", "12m", "tout"];

const TREND_TABS: { key: string; label: string; days: 7 | 30 | 365 }[] = [
  { key: "7", label: "7 jours", days: 7 },
  { key: "30", label: "30 jours", days: 30 },
  { key: "12m", label: "12 mois", days: 365 },
];

/** /admin/marketing — vue d'ensemble du programme partenaires (vraies données). */
export default async function MarketingDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const period = sanitizePeriod(typeof params.periode === "string" ? params.periode : undefined);
  const trendKey = typeof params.tendance === "string" ? params.tendance : "30";
  const trendTab = TREND_TABS.find((t) => t.key === trendKey) ?? TREND_TABS[1]!;

  const since = periodStart(period);
  const [overview, trend, topPartners] = await Promise.all([
    getMarketingOverview(since),
    getMarketingTrend(trendTab.days),
    getTopPartners(since),
  ]);

  const periodHref = (p: MarketingPeriod) =>
    `/admin/marketing?periode=${p}${trendKey !== "30" ? `&tendance=${trendKey}` : ""}`;
  const trendHref = (key: string) =>
    `/admin/marketing?periode=${period}${key !== "30" ? `&tendance=${key}` : ""}`;

  return (
    <div className="animate-page-in space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Marketing &amp; Partenaires</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Programme d’apporteurs d’affaires : liens de parrainage, suivi réel des clics et
            conversions, commissions calculées sur les paiements Stripe encaissés.
            {!isStripeConfigured
              ? " Stripe n’est pas configuré : les commissions ne seront créées qu’une fois la clé renseignée."
              : ""}
          </p>
        </div>
        <Button size="sm" render={<Link href="/admin/marketing/partenaires" />}>
          Gérer les partenaires
          <ArrowRight className="size-4" />
        </Button>
      </div>

      {/* Filtre de période */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card/60 p-1.5">
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={periodHref(p)}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              period === p
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {PERIOD_LABELS[p]}
          </Link>
        ))}
      </div>

      {/* KPI principaux */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Partenaires" value={String(overview.totalPartners)} hint={`${overview.activePartners} actif${overview.activePartners > 1 ? "s" : ""}`} icon={Handshake} />
        <StatCard label="Clics" value={overview.clicks.toLocaleString("fr-FR")} hint={PERIOD_LABELS[period].toLowerCase()} icon={MousePointerClick} />
        <StatCard label="Inscriptions attribuées" value={overview.signups.toLocaleString("fr-FR")} icon={Users} />
        <StatCard label="Clients payants" value={overview.conversions.toLocaleString("fr-FR")} hint={`Taux ${overview.conversionRate.toString().replace(".", ",")} %`} icon={UserCheck} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="CA généré (encaissé)" value={formatCents(overview.grossRevenueCents)} hint="TTC attribué aux partenaires" icon={TrendingUp} />
        <StatCard label="Commissions en attente" value={formatCents(overview.pendingCents)} hint="à valider" icon={Clock} />
        <StatCard label="Commissions disponibles" value={formatCents(overview.payableCents)} hint="prêtes à payer" icon={Wallet} />
        <StatCard label="Commissions versées" value={formatCents(overview.paidCents)} hint="déjà payées" icon={CircleDollarSign} />
      </div>

      {/* Évolution */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Évolution</h2>
            <p className="text-xs text-muted-foreground">Clics, inscriptions et clients payants</p>
          </div>
          <div className="flex gap-1 rounded-lg border border-border p-0.5">
            {TREND_TABS.map((tab) => (
              <Link
                key={tab.key}
                href={trendHref(tab.key)}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  trendTab.key === tab.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>
        <MarketingTrendChart data={trend} />
      </div>

      {/* Meilleurs partenaires + résumé commissions */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Meilleurs partenaires</h2>
            <Link href="/admin/marketing/partenaires" className="text-xs text-primary hover:underline">
              Tous les partenaires
            </Link>
          </div>
          {topPartners.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucune activité partenaire sur cette période.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="py-2 pr-3 text-left font-medium">Partenaire</th>
                    <th className="px-3 py-2 text-right font-medium">Clics</th>
                    <th className="px-3 py-2 text-right font-medium">Inscr.</th>
                    <th className="px-3 py-2 text-right font-medium">Payants</th>
                    <th className="py-2 pl-3 text-right font-medium">CA généré</th>
                  </tr>
                </thead>
                <tbody>
                  {topPartners.map((p) => (
                    <tr key={p.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 pr-3">
                        <Link href={`/admin/marketing/partenaires/${p.id}`} className="font-medium hover:underline">
                          {p.name}
                        </Link>
                        {p.companyName ? (
                          <span className="block text-xs text-muted-foreground">{p.companyName}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{p.clicks}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{p.signups}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{p.conversions}</td>
                      <td className="py-2.5 pl-3 text-right font-medium tabular-nums">{formatCents(p.grossCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Commissions</h2>
          <dl className="space-y-2.5 text-sm">
            <Row icon={<Clock className="size-4 text-amber-500" />} label="En attente" value={formatCents(overview.pendingCents)} />
            <Row icon={<BadgeCheck className="size-4 text-blue-500" />} label="Validées" value={formatCents(overview.approvedCents)} />
            <Row icon={<Wallet className="size-4 text-violet-500" />} label="Disponibles" value={formatCents(overview.payableCents)} />
            <Row icon={<CircleDollarSign className="size-4 text-emerald-500" />} label="Versées" value={formatCents(overview.paidCents)} />
          </dl>
          <div className="mt-4 flex flex-col gap-2">
            <Button size="sm" variant="outline" render={<Link href="/admin/marketing/commissions" />}>
              Voir les commissions
            </Button>
            <Button size="sm" variant="outline" render={<Link href="/admin/marketing/paiements" />}>
              Paiements aux partenaires
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
