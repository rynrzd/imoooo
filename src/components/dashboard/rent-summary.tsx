"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { RentPayment } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Loyers du mois — attendus, encaissés, en retard.
 *
 * Trois chiffres sur une ligne, un filet de progression, rien d'autre : c'est
 * la question que se pose un bailleur en ouvrant l'application. Les grandes
 * cartes d'indicateurs restent sur l'écran Statistiques.
 *
 * Le rouge n'apparaît QUE s'il y a un vrai retard, et il est toujours doublé
 * du mot « en retard » — jamais une couleur seule.
 */
export function RentSummary({
  payments,
  monthLabel,
}: {
  /** Échéances du mois en cours, déjà filtrées. */
  payments: RentPayment[];
  monthLabel: string;
}) {
  const expected = payments.reduce((sum, p) => sum + p.expected, 0);
  const received = payments.reduce((sum, p) => sum + p.received, 0);
  const late = payments
    .filter((p) => p.status === "retard")
    .reduce((sum, p) => sum + (p.expected - p.received), 0);
  const ratio = expected > 0 ? Math.min(100, (received * 100) / expected) : 0;

  return (
    <section aria-labelledby="loyers-du-mois" className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="loyers-du-mois" className="text-sm font-medium text-foreground">
          Loyers · {monthLabel}
        </h2>
        <Link
          href="/loyers"
          className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
        >
          Détail
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-card px-3 py-3">
        <dl className="flex items-end justify-between gap-3">
          <div>
            <dt className="text-xs text-muted-foreground">Encaissés</dt>
            <dd className="text-lg font-semibold tabular-nums text-foreground">
              {formatCurrency(received)}
            </dd>
          </div>
          <div className="text-right">
            <dt className="text-xs text-muted-foreground">Attendus</dt>
            <dd className="text-sm font-medium tabular-nums text-foreground">
              {formatCurrency(expected)}
            </dd>
          </div>
        </dl>

        <div
          className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round(ratio)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Part des loyers encaissés ce mois-ci"
        >
          <div
            className="h-full rounded-full bg-emerald-600 transition-[width] duration-200"
            style={{ width: `${ratio}%` }}
          />
        </div>

        <p
          className={cn(
            "mt-2 text-xs",
            late > 0 ? "font-medium text-red-700 dark:text-red-400" : "text-muted-foreground"
          )}
        >
          {late > 0
            ? `${formatCurrency(late)} en retard`
            : expected === 0
              ? "Aucune échéance ce mois-ci"
              : "Aucun retard"}
        </p>
      </div>
    </section>
  );
}
