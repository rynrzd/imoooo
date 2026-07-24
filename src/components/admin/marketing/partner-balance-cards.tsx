import { Ban, CircleDollarSign, Clock, RotateCcw, Wallet } from "lucide-react";
import { formatCents, type PartnerBalance } from "@/lib/marketing/types";

/**
 * Cagnotte d'un partenaire — TOUJOURS calculée depuis les commissions
 * réelles (jamais une valeur modifiable à la main). Affichage sobre.
 */
export function PartnerBalanceCards({ balance }: { balance: PartnerBalance }) {
  const cells: { label: string; value: string; icon: React.ReactNode; tone?: string }[] = [
    { label: "En attente", value: formatCents(balance.pendingCents), icon: <Clock className="size-4 text-amber-500" /> },
    { label: "Validé", value: formatCents(balance.approvedCents), icon: <Wallet className="size-4 text-blue-500" /> },
    { label: "Disponible", value: formatCents(balance.payableCents), icon: <Wallet className="size-4 text-violet-500" /> },
    { label: "Déjà payé", value: formatCents(balance.paidCents), icon: <CircleDollarSign className="size-4 text-emerald-500" /> },
    { label: "Annulées", value: formatCents(balance.cancelledCents), icon: <Ban className="size-4 text-muted-foreground" /> },
    { label: "Remboursées", value: formatCents(balance.reversedCents), icon: <RotateCcw className="size-4 text-red-500" /> },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Cagnotte</h2>
        <span className="text-xs text-muted-foreground">
          Total généré : <strong className="text-foreground">{formatCents(balance.totalEarnedCents)}</strong>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cells.map((cell) => (
          <div key={cell.label} className="rounded-lg bg-muted/40 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {cell.icon}
              {cell.label}
            </div>
            <p className="mt-1 text-lg font-semibold tabular-nums">{cell.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        La cagnotte est calculée automatiquement depuis les commissions issues des paiements Stripe
        réellement encaissés. Elle n’est jamais saisie manuellement.
      </p>
    </div>
  );
}
