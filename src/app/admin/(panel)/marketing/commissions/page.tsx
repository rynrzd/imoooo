import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { MarketingAction } from "@/components/admin/marketing/marketing-action";
import { CommissionStatusBadge } from "@/components/admin/marketing/status-badges";
import { Button } from "@/components/ui/button";
import { formatAdminDate } from "@/lib/admin/format";
import {
  COMMISSION_STATUS_LABELS,
  formatCents,
  type CommissionStatus,
  type MarketingPartnerRow,
  type PartnerCommissionRow,
} from "@/lib/marketing/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Commissions" };
export const dynamic = "force-dynamic";

const PER_PAGE = 30;
const STATUSES: CommissionStatus[] = ["pending", "approved", "payable", "paid", "cancelled", "reversed"];
const SELECT_CLASS =
  "h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none transition-colors " +
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40";
const TH = "px-3 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap";
const TD = "px-3 py-3 align-middle text-sm whitespace-nowrap";

/** /admin/marketing/commissions — liste, filtres, actions, export CSV. */
export default async function CommissionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const partnerId = typeof params.partenaire === "string" ? params.partenaire : "";
  const statut = typeof params.statut === "string" ? params.statut : "";
  const depuis = typeof params.depuis === "string" ? params.depuis : "";
  const jusqu = typeof params.jusqu === "string" ? params.jusqu : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);

  const admin = createAdminClient();

  const { data: partnersData } = await admin
    .from("marketing_partners")
    .select("id, name")
    .order("name");
  const partners = (partnersData ?? []) as Pick<MarketingPartnerRow, "id" | "name">[];
  const partnerName = new Map(partners.map((p) => [p.id, p.name]));

  let query = admin
    .from("partner_commissions")
    .select("*", { count: "exact" })
    .order("earned_at", { ascending: false });
  if (partnerId) query = query.eq("partner_id", partnerId);
  if (STATUSES.includes(statut as CommissionStatus)) query = query.eq("status", statut);
  if (depuis && !Number.isNaN(new Date(depuis).getTime())) query = query.gte("earned_at", new Date(depuis).toISOString());
  if (jusqu && !Number.isNaN(new Date(jusqu).getTime())) {
    const end = new Date(jusqu);
    end.setDate(end.getDate() + 1);
    query = query.lt("earned_at", end.toISOString());
  }

  const from = (page - 1) * PER_PAGE;
  const { data, count, error } = await query.range(from, from + PER_PAGE - 1);
  if (error) throw new Error(`Lecture des commissions impossible : ${error.message}`);
  const commissions = (data ?? []) as PartnerCommissionRow[];
  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));

  // E-mails clients.
  const userIds = [...new Set(commissions.map((c) => c.user_id).filter(Boolean))] as string[];
  const emails = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await admin.from("profiles").select("id, email").in("id", userIds);
    for (const p of profiles ?? []) emails.set(p.id as string, (p.email as string) ?? "");
  }

  const queryString = new URLSearchParams();
  if (partnerId) queryString.set("partenaire", partnerId);
  if (statut) queryString.set("statut", statut);
  if (depuis) queryString.set("depuis", depuis);
  if (jusqu) queryString.set("jusqu", jusqu);
  const exportHref = `/api/admin/marketing/commissions/export?${queryString.toString()}`;
  const pageHref = (p: number) => {
    const sp = new URLSearchParams(queryString);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `/admin/marketing/commissions${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="animate-page-in space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/admin/marketing" className="mb-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Tableau de bord marketing
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Commissions</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {total} commission{total > 1 ? "s" : ""}. Chaque commission provient d’un paiement Stripe
            réellement encaissé. Les actions sont sécurisées et journalisées.
          </p>
        </div>
        <Button size="sm" variant="outline" render={<a href={exportHref} />}>
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      <form className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card/60 p-3" action="/admin/marketing/commissions" method="get">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Partenaire</label>
          <select name="partenaire" defaultValue={partnerId} className={SELECT_CLASS}>
            <option value="">Tous</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Statut</label>
          <select name="statut" defaultValue={statut} className={SELECT_CLASS}>
            <option value="">Tous</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{COMMISSION_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Du</label>
          <input type="date" name="depuis" defaultValue={depuis} className={SELECT_CLASS} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Au</label>
          <input type="date" name="jusqu" defaultValue={jusqu} className={SELECT_CLASS} />
        </div>
        <Button type="submit" variant="outline" size="sm">Filtrer</Button>
      </form>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className={TH}>Date</th>
                <th className={TH}>Partenaire</th>
                <th className={TH}>Client</th>
                <th className={TH}>Plan</th>
                <th className={TH}>Facture</th>
                <th className={`${TH} text-right`}>Encaissé</th>
                <th className={`${TH} text-right`}>Taux</th>
                <th className={`${TH} text-right`}>Commission</th>
                <th className={TH}>Statut</th>
                <th className={`${TH} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {commissions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-12 text-center text-sm text-muted-foreground">
                    Aucune commission ne correspond à ces critères.
                  </td>
                </tr>
              ) : (
                commissions.map((c) => (
                  <tr key={c.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/30">
                    <td className={`${TD} text-muted-foreground`}>{formatAdminDate(c.earned_at)}</td>
                    <td className={TD}>
                      <Link href={`/admin/marketing/partenaires/${c.partner_id}`} className="hover:underline">
                        {partnerName.get(c.partner_id) ?? "—"}
                      </Link>
                    </td>
                    <td className={`${TD} max-w-40 truncate`}>
                      {c.user_id ? (
                        <Link href={`/admin/utilisateurs/${c.user_id}`} className="hover:underline">
                          {emails.get(c.user_id) || c.user_id}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className={`${TD} text-muted-foreground`}>{c.plan || "—"}</td>
                    <td className={TD}>
                      <code className="block max-w-28 truncate text-xs text-muted-foreground" title={c.stripe_invoice_id}>
                        {c.stripe_invoice_id}
                      </code>
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>{formatCents(c.gross_amount, c.currency)}</td>
                    <td className={`${TD} text-right text-muted-foreground`}>
                      {c.commission_type === "percent" ? `${c.commission_rate} %` : "fixe"}
                    </td>
                    <td className={`${TD} text-right font-medium tabular-nums`}>{formatCents(c.commission_amount, c.currency)}</td>
                    <td className={TD}>
                      <CommissionStatusBadge status={c.status as CommissionStatus} />
                      {c.reversal_reason ? (
                        <span className="mt-0.5 block max-w-40 truncate text-[11px] text-muted-foreground" title={c.reversal_reason}>
                          {c.reversal_reason}
                        </span>
                      ) : null}
                    </td>
                    <td className={`${TD} text-right`}>
                      <div className="flex flex-wrap justify-end gap-1">
                        {c.status === "pending" ? (
                          <MarketingAction endpoint="/api/admin/marketing/commissions" payload={{ action: "approve", commissionId: c.id }} label="Valider" variant="outline" />
                        ) : null}
                        {c.status === "approved" ? (
                          <MarketingAction endpoint="/api/admin/marketing/commissions" payload={{ action: "payable", commissionId: c.id }} label="Rendre payable" variant="outline" />
                        ) : null}
                        {["pending", "approved", "payable"].includes(c.status) ? (
                          <MarketingAction
                            endpoint="/api/admin/marketing/commissions"
                            payload={{ action: "cancel", commissionId: c.id }}
                            label="Annuler"
                            variant="ghost"
                            title="Annuler cette commission ?"
                            description="La commission ne sera pas versée. Une raison est obligatoire (journalisée)."
                            confirmLabel="Annuler la commission"
                            withReason
                            reasonRequired
                            reasonLabel="Raison de l’annulation"
                          />
                        ) : null}
                        {c.status === "paid" || c.status === "cancelled" || c.status === "reversed" ? (
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

      {pageCount > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page} / {pageCount}</span>
          <div className="flex gap-2">
            {page > 1 ? <Link href={pageHref(page - 1)} className="hover:underline">← Précédente</Link> : null}
            {page < pageCount ? <Link href={pageHref(page + 1)} className="hover:underline">Suivante →</Link> : null}
          </div>
        </div>
      ) : null}

      <p className="text-xs leading-relaxed text-muted-foreground">
        Cycle : <strong>en attente</strong> → <strong>validée</strong> → <strong>disponible</strong> →{" "}
        <strong>payée</strong> (via un relevé de paiement). Un remboursement Stripe passe automatiquement
        la commission en « remboursée ». Les commissions disponibles sont réglées depuis
        <Link href="/admin/marketing/paiements" className="text-primary hover:underline"> Paiements aux partenaires</Link>.
      </p>
    </div>
  );
}
