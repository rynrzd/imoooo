import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PartnerFormDialog } from "@/components/admin/marketing/partner-form-dialog";
import { PartnerStatusBadge } from "@/components/admin/marketing/status-badges";
import { Button } from "@/components/ui/button";
import { getPartnerBalances, getPartnerFunnels } from "@/lib/marketing/partners";
import { buildPartnerLink } from "@/lib/marketing/referral";
import {
  PARTNER_TYPE_LABELS,
  commissionRuleLabel,
  formatCents,
  type MarketingPartnerRow,
  type PartnerType,
} from "@/lib/marketing/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Partenaires" };
export const dynamic = "force-dynamic";

const SELECT_CLASS =
  "h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none transition-colors " +
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40";
const TH = "px-3 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap";
const TD = "px-3 py-3 align-middle text-sm";

/** /admin/marketing/partenaires — liste, recherche, filtre, création. */
export default async function PartnersListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const statut = typeof params.statut === "string" ? params.statut : "";
  const type = typeof params.type === "string" ? params.type : "";

  const admin = createAdminClient();
  let query = admin.from("marketing_partners").select("*").order("created_at", { ascending: false });
  if (q) query = query.or(`name.ilike.%${q}%,company_name.ilike.%${q}%,email.ilike.%${q}%,referral_slug.ilike.%${q}%`);
  if (statut === "actifs") query = query.eq("is_active", true);
  else if (statut === "inactifs") query = query.eq("is_active", false);
  if (type && type in PARTNER_TYPE_LABELS) query = query.eq("partner_type", type);

  const { data, error } = await query;
  if (error) throw new Error(`Lecture des partenaires impossible : ${error.message}`);
  const partners = (data ?? []) as MarketingPartnerRow[];

  const ids = partners.map((p) => p.id);
  const [balances, funnels] = await Promise.all([getPartnerBalances(ids), getPartnerFunnels(ids)]);

  return (
    <div className="animate-page-in space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/admin/marketing" className="mb-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Tableau de bord marketing
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Partenaires</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {partners.length} partenaire{partners.length > 1 ? "s" : ""}. Chaque partenaire a un lien
            et un QR code uniques, générés automatiquement.
          </p>
        </div>
        <PartnerFormDialog triggerLabel="Nouveau partenaire" />
      </div>

      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/60 p-3" action="/admin/marketing/partenaires" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Rechercher (nom, entreprise, e-mail, lien)…"
          className="h-9 min-w-52 flex-1 rounded-lg border border-border bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
        />
        <select name="statut" defaultValue={statut} className={SELECT_CLASS} aria-label="Filtrer par statut">
          <option value="">Tous les statuts</option>
          <option value="actifs">Actifs</option>
          <option value="inactifs">Inactifs</option>
        </select>
        <select name="type" defaultValue={type} className={SELECT_CLASS} aria-label="Filtrer par type">
          <option value="">Tous les types</option>
          {(Object.keys(PARTNER_TYPE_LABELS) as PartnerType[]).map((t) => (
            <option key={t} value={t}>
              {PARTNER_TYPE_LABELS[t]}
            </option>
          ))}
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
                <th className={TH}>Partenaire</th>
                <th className={TH}>Type</th>
                <th className={TH}>Statut</th>
                <th className={TH}>Commission</th>
                <th className={`${TH} text-right`}>Clics</th>
                <th className={`${TH} text-right`}>Inscr.</th>
                <th className={`${TH} text-right`}>Payants</th>
                <th className={`${TH} text-right`}>Cagnotte dispo.</th>
                <th className={`${TH} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {partners.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-12 text-center text-sm text-muted-foreground">
                    Aucun partenaire ne correspond à ces critères. Créez votre premier partenaire pour
                    obtenir un lien et un QR code.
                  </td>
                </tr>
              ) : (
                partners.map((p) => {
                  const funnel = funnels.get(p.id);
                  const balance = balances.get(p.id);
                  return (
                    <tr key={p.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/30">
                      <td className={TD}>
                        <Link href={`/admin/marketing/partenaires/${p.id}`} className="font-medium hover:underline">
                          {p.name}
                        </Link>
                        {p.company_name ? (
                          <span className="block text-xs text-muted-foreground">{p.company_name}</span>
                        ) : null}
                        <code className="mt-0.5 block text-[11px] text-muted-foreground">/?ref={p.referral_slug}</code>
                      </td>
                      <td className={`${TD} text-muted-foreground`}>{PARTNER_TYPE_LABELS[p.partner_type]}</td>
                      <td className={TD}>
                        <PartnerStatusBadge isActive={p.is_active} expiresAt={p.expires_at} />
                      </td>
                      <td className={`${TD} max-w-52 text-xs text-muted-foreground`}>
                        {commissionRuleLabel(p)}
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>{funnel?.clicks ?? 0}</td>
                      <td className={`${TD} text-right tabular-nums`}>{funnel?.signups ?? 0}</td>
                      <td className={`${TD} text-right tabular-nums`}>{funnel?.conversions ?? 0}</td>
                      <td className={`${TD} text-right font-medium tabular-nums`}>
                        {formatCents(balance?.payableCents ?? 0)}
                      </td>
                      <td className={`${TD} text-right`}>
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" render={<a href={buildPartnerLink(p.referral_slug)} target="_blank" rel="noopener noreferrer" aria-label="Ouvrir le lien" />}>
                            <ExternalLink className="size-4" />
                          </Button>
                          <Button size="sm" variant="outline" render={<Link href={`/admin/marketing/partenaires/${p.id}`} />}>
                            Ouvrir
                          </Button>
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
    </div>
  );
}
