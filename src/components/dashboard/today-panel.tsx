"use client";

import Link from "next/link";
import { CalendarClock, FileWarning, Hammer, UserRound, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currentMonthKey } from "@/lib/dates";
import { formatCurrency, formatDate } from "@/lib/format";
import type { AppData } from "@/lib/types";

/**
 * « Aujourd'hui » — vue du jour dérivée UNIQUEMENT des données réelles :
 * loyers du mois encore attendus, interventions prévues, documents
 * expirant sous 30 jours, baux se terminant sous 60 jours.
 */

interface TodayEntry {
  id: string;
  icon: typeof Wallet;
  iconClass: string;
  label: string;
  detail: string;
  href: string;
}

function buildEntries(data: AppData): TodayEntry[] {
  const entries: TodayEntry[] = [];
  const month = currentMonthKey();
  const todayIso = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const in60 = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
  const propertyName = (id: string) =>
    data.properties.find((p) => p.id === id)?.name ?? "Logement";

  // Prochains loyers : échéances du mois non soldées (attente ou partiel).
  for (const payment of data.rentPayments) {
    if (payment.month !== month) continue;
    if (payment.status !== "attente" && payment.status !== "partiel") continue;
    const remaining = payment.expected - payment.received;
    entries.push({
      id: `rent-${payment.id}`,
      icon: Wallet,
      iconClass: "bg-primary/8 text-primary",
      label: `Loyer attendu — ${propertyName(payment.propertyId)}`,
      detail: `${formatCurrency(remaining)} restant ce mois-ci`,
      href: "/loyers",
    });
  }

  // Interventions prévues ou en cours.
  for (const work of data.works) {
    if (work.status === "termine") continue;
    entries.push({
      id: `work-${work.id}`,
      icon: Hammer,
      iconClass: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
      label: `${work.status === "en_cours" ? "Chantier en cours" : "Intervention prévue"} — ${propertyName(work.propertyId)}`,
      detail: `${work.title} · ${formatDate(work.date)}`,
      href: "/travaux",
    });
  }

  // Documents expirant sous 30 jours (ou déjà expirés).
  for (const document of data.documents) {
    if (!document.expiresAt || document.expiresAt > in30) continue;
    const expired = document.expiresAt < todayIso;
    entries.push({
      id: `doc-${document.id}`,
      icon: FileWarning,
      iconClass: expired
        ? "bg-red-500/10 text-red-700 dark:text-red-400"
        : "bg-amber-500/10 text-amber-700 dark:text-amber-400",
      label: `${document.name} — ${expired ? "expiré" : "expire bientôt"}`,
      detail: `${propertyName(document.propertyId)} · ${formatDate(document.expiresAt)}`,
      href: "/documents",
    });
  }

  // Baux se terminant sous 60 jours : anticiper la relocation.
  for (const tenant of data.tenants) {
    if (!tenant.exitDate || tenant.exitDate < todayIso || tenant.exitDate > in60) continue;
    entries.push({
      id: `lease-${tenant.id}`,
      icon: UserRound,
      iconClass: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
      label: `Fin de bail — ${propertyName(tenant.propertyId)}`,
      detail: `${tenant.firstName} ${tenant.lastName} · départ le ${formatDate(tenant.exitDate)}`,
      href: `/locataires/${tenant.id}`,
    });
  }

  return entries.slice(0, 8);
}

export function TodayPanel({ data }: { data: AppData }) {
  const entries = buildEntries(data);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <CalendarClock className="size-4 text-primary" />
          Aujourd&apos;hui
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3">
        {entries.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">
            Rien de prévu : loyers à jour, aucune échéance imminente.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={entry.href}
                  className="flex items-center gap-3 px-2 py-2.5 transition-colors hover:bg-accent/60"
                >
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-md ${entry.iconClass}`}
                    aria-hidden
                  >
                    <entry.icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {entry.label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {entry.detail}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
