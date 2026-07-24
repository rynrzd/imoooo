import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MarketingAction } from "@/components/admin/marketing/marketing-action";
import {
  PayoutCreateDialog,
  PayoutMarkPaidDialog,
} from "@/components/admin/marketing/payout-dialogs";
import { PayoutStatusBadge } from "@/components/admin/marketing/status-badges";
import { StatCard } from "@/components/admin/stat-card";
import { formatAdminDate, formatAdminDateTime } from "@/lib/admin/format";
import { getPartnerBalances } from "@/lib/marketing/partners";
import {
  formatCents,
  type MarketingPartnerRow,
  type PartnerPayoutRow,
  type PayoutStatus,
} from "@/lib/marketing/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Paiements aux partenaires" };
export const dynamic = "force-dynamic";

const TH = "px-3 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap";
const TD = "px-3 py-3 align-middle text-sm whitespace-nowrap";

/** /admin/marketing/paiements — relevés de paiement (virements manuels). */
export default async function PayoutsPage() {
  const admin = createAdminClient();

  const [{ data: partnersData }, { data: payoutsData, error }] = await Promise.all([
    admin.from("marketing_partners").select("id, name").order("name"),
    admin.from("partner_payouts").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  if (error) throw new Error(`Lecture des paiements impossible : ${error.message}`);

  const partners = (partnersData ?? []) as Pick<MarketingPartnerRow, "id" | "name">[];
  const partnerName = new Map(partners.map((p) => [p.id, p.name]));
  const payouts = (payoutsData ?? []) as PartnerPayoutRow[];

  const balances = await getPartnerBalances(partners.map((p) => p.id));
  const partnersWithPayable = partners.map((p) => ({
    id: p.id,
    name: p.name,
    payableCents: balances.get(p.id)?.payableCents ?? 0,
  }));
  const totalPayable = partnersWithPayable.reduce((sum, p) => sum + p.payableCents, 0);
  const totalPaid = [...balances.values()].reduce((sum, b) => sum + b.paidCents, 0);
  const draftCount = payouts.filter((p) => p.status === "draft" || p.status === "approved").length;

  return (
    <div className="animate-page-in space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/admin/marketing" className="mb-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Tableau de bord marketing
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Paiements aux partenaires</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Virements <strong>manuels</strong> : Nireo ne déclenche aucun virement bancaire. Créez un
            relevé, effectuez le virement, puis marquez-le payé — les commissions liées sont soldées
            atomiquement (aucun double paiement possible).
          </p>
        </div>
        <PayoutCreateDialog partners={partnersWithPayable} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Disponible à payer" value={formatCents(totalPayable)} hint="commissions disponibles" />
        <StatCard label="Déjà versé" value={formatCents(totalPaid)} hint="cumul" />
        <StatCard label="Relevés à traiter" value={String(draftCount)} hint="brouillons ou approuvés" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className={TH}>Partenaire</th>
                <th className={TH}>Période</th>
                <th className={`${TH} text-right`}>Montant</th>
                <th className={TH}>Statut</th>
                <th className={TH}>Méthode / référence</th>
                <th className={TH}>Payé le</th>
                <th className={`${TH} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payouts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center text-sm text-muted-foreground">
                    Aucun relevé de paiement. Créez-en un pour régler les commissions disponibles d’un
                    partenaire.
                  </td>
                </tr>
              ) : (
                payouts.map((p) => (
                  <tr key={p.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/30">
                    <td className={TD}>
                      <Link href={`/admin/marketing/partenaires/${p.partner_id}`} className="font-medium hover:underline">
                        {partnerName.get(p.partner_id) ?? "—"}
                      </Link>
                    </td>
                    <td className={`${TD} text-muted-foreground`}>
                      {formatAdminDate(p.period_start)} → {formatAdminDate(p.period_end)}
                    </td>
                    <td className={`${TD} text-right font-medium tabular-nums`}>{formatCents(p.total_amount, p.currency)}</td>
                    <td className={TD}><PayoutStatusBadge status={p.status as PayoutStatus} /></td>
                    <td className={`${TD} text-muted-foreground`}>
                      {p.payment_method ? (
                        <span>
                          {p.payment_method}
                          {p.payment_reference ? <span className="block text-xs">{p.payment_reference}</span> : null}
                        </span>
                      ) : "—"}
                    </td>
                    <td className={`${TD} text-muted-foreground`}>{p.paid_at ? formatAdminDateTime(p.paid_at) : "—"}</td>
                    <td className={`${TD} text-right`}>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {p.status === "draft" ? (
                          <MarketingAction endpoint="/api/admin/marketing/payouts" payload={{ action: "approve", payoutId: p.id }} label="Approuver" variant="outline" />
                        ) : null}
                        {(p.status === "draft" || p.status === "approved") ? (
                          <>
                            <PayoutMarkPaidDialog payoutId={p.id} amountLabel={formatCents(p.total_amount, p.currency)} />
                            <MarketingAction
                              endpoint="/api/admin/marketing/payouts"
                              payload={{ action: "cancel", payoutId: p.id }}
                              label="Annuler"
                              variant="ghost"
                              title="Annuler ce relevé ?"
                              description="Les commissions liées redeviennent disponibles pour un futur relevé."
                              confirmLabel="Annuler le relevé"
                            />
                          </>
                        ) : null}
                        {p.status === "paid" || p.status === "cancelled" ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
