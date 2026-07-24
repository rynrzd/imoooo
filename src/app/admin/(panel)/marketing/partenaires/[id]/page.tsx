import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileImage, Mail, MapPin, Phone, User } from "lucide-react";
import { PartnerBalanceCards } from "@/components/admin/marketing/partner-balance-cards";
import { PartnerFormDialog } from "@/components/admin/marketing/partner-form-dialog";
import { PartnerLinkCard } from "@/components/admin/marketing/partner-link-card";
import { MarketingAction } from "@/components/admin/marketing/marketing-action";
import {
  CommissionStatusBadge,
  PartnerStatusBadge,
} from "@/components/admin/marketing/status-badges";
import { Button } from "@/components/ui/button";
import { formatAdminDate, formatAdminDateTime } from "@/lib/admin/format";
import { getPartner, getPartnerBalance, getPartnerFunnels } from "@/lib/marketing/partners";
import { generateQrDataUrl } from "@/lib/marketing/qr";
import { buildPartnerLink } from "@/lib/marketing/referral";
import {
  COMMISSION_DURATION_LABELS,
  PARTNER_TYPE_LABELS,
  PAYOUT_STATUS_LABELS,
  commissionRuleLabel,
  formatCents,
  type CommissionStatus,
  type PartnerCommissionRow,
  type PartnerPayoutRow,
  type PayoutStatus,
} from "@/lib/marketing/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Fiche partenaire" };
export const dynamic = "force-dynamic";

interface AttributedClient {
  user_id: string;
  email: string;
  signup_at: string;
  converted_at: string | null;
  status: string;
}

/** /admin/marketing/partenaires/[id] — fiche complète d'un partenaire. */
export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const partner = await getPartner(id);
  if (!partner) notFound();

  const admin = createAdminClient();
  const [balance, funnels, qrDataUrl, attributionsRes, commissionsRes, payoutsRes] = await Promise.all([
    getPartnerBalance(partner.id),
    getPartnerFunnels([partner.id]),
    generateQrDataUrl(buildPartnerLink(partner.referral_slug), 512),
    admin
      .from("partner_attributions")
      .select("user_id, signup_at, converted_at, status")
      .eq("partner_id", partner.id)
      .order("signup_at", { ascending: false })
      .limit(50),
    admin
      .from("partner_commissions")
      .select("*")
      .eq("partner_id", partner.id)
      .order("earned_at", { ascending: false })
      .limit(50),
    admin
      .from("partner_payouts")
      .select("*")
      .eq("partner_id", partner.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const funnel = funnels.get(partner.id) ?? { clicks: 0, signups: 0, conversions: 0 };
  const commissions = (commissionsRes.data ?? []) as PartnerCommissionRow[];
  const payouts = (payoutsRes.data ?? []) as PartnerPayoutRow[];

  // E-mails des clients attribués (best-effort).
  const attributions = (attributionsRes.data ?? []) as AttributedClient[];
  const userIds = attributions.map((a) => a.user_id);
  const emails = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await admin.from("profiles").select("id, email").in("id", userIds);
    for (const p of profiles ?? []) emails.set(p.id as string, (p.email as string) ?? "");
  }

  const link = buildPartnerLink(partner.referral_slug);
  const canDelete = commissions.length === 0 && payouts.length === 0;

  return (
    <div className="animate-page-in space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/admin/marketing/partenaires" className="mb-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Tous les partenaires
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{partner.name}</h1>
            <PartnerStatusBadge isActive={partner.is_active} expiresAt={partner.expires_at} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {PARTNER_TYPE_LABELS[partner.partner_type]}
            {partner.company_name ? ` · ${partner.company_name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" render={<Link href={`/admin/marketing/supports?partenaire=${partner.id}`} />}>
            <FileImage className="size-4" /> Supports
          </Button>
          <PartnerFormDialog partner={partner} triggerLabel="Modifier" triggerVariant="outline" />
          <MarketingAction
            endpoint="/api/admin/marketing/partners"
            payload={{ action: "toggle", partnerId: partner.id }}
            label={partner.is_active ? "Désactiver" : "Activer"}
            variant="outline"
            title={partner.is_active ? "Désactiver le partenaire ?" : "Activer le partenaire ?"}
            description={
              partner.is_active
                ? "Le lien cesse d’attribuer de nouveaux clients. Les commissions existantes sont conservées."
                : "Le lien recommence à attribuer les nouveaux visiteurs à ce partenaire."
            }
            confirmLabel={partner.is_active ? "Désactiver" : "Activer"}
          />
          {canDelete ? (
            <MarketingAction
              endpoint="/api/admin/marketing/partners"
              payload={{ action: "delete", partnerId: partner.id }}
              label="Supprimer"
              variant="destructive"
              title="Supprimer ce partenaire ?"
              description="Action définitive. Possible uniquement car aucune commission ni paiement n’y est lié."
              confirmLabel="Supprimer"
              requiredPhrase={partner.referral_slug}
            />
          ) : null}
        </div>
      </div>

      {/* Lien + QR */}
      <PartnerLinkCard partnerId={partner.id} link={link} qrDataUrl={qrDataUrl} />

      {/* Entonnoir */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Clics" value={funnel.clicks} />
        <MiniStat label="Inscriptions" value={funnel.signups} />
        <MiniStat label="Clients payants" value={funnel.conversions} />
        <MiniStat label="CA généré" value={formatCents(balance.grossRevenueCents)} isText />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Cagnotte */}
        <div className="lg:col-span-2">
          <PartnerBalanceCards balance={balance} />
        </div>

        {/* Identité + règle de commission */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold">Commission</h2>
            <p className="text-sm font-medium">{commissionRuleLabel(partner)}</p>
            <dl className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <dt>Type</dt>
                <dd className="text-foreground">{partner.commission_type === "percent" ? "Pourcentage" : "Montant fixe"}</dd>
              </div>
              {partner.commission_type === "percent" ? (
                <div className="flex justify-between">
                  <dt>Durée</dt>
                  <dd className="text-foreground">{COMMISSION_DURATION_LABELS[partner.commission_duration_type]}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt>Plans</dt>
                <dd className="text-foreground">
                  {partner.applicable_plans.length > 0 ? partner.applicable_plans.join(", ") : "Tous les payants"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Attribution</dt>
                <dd className="text-foreground">{partner.attribution_window_days} j · premier clic</dd>
              </div>
              <div className="flex justify-between">
                <dt>Validité</dt>
                <dd className="text-foreground">
                  {partner.starts_at ? formatAdminDate(partner.starts_at) : "—"} →{" "}
                  {partner.expires_at ? formatAdminDate(partner.expires_at) : "∞"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold">Contact</h2>
            <dl className="space-y-2 text-sm">
              <ContactRow icon={<User className="size-4" />} value={partner.contact_name} />
              <ContactRow icon={<Mail className="size-4" />} value={partner.email} href={partner.email ? `mailto:${partner.email}` : undefined} />
              <ContactRow icon={<Phone className="size-4" />} value={partner.phone} href={partner.phone ? `tel:${partner.phone}` : undefined} />
              <ContactRow icon={<MapPin className="size-4" />} value={partner.address} />
            </dl>
          </div>
        </div>
      </div>

      {/* Notes internes */}
      {partner.notes ? (
        <div className="rounded-xl border border-border bg-amber-500/5 p-4">
          <h2 className="mb-1.5 text-sm font-semibold">Notes internes</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{partner.notes}</p>
        </div>
      ) : null}

      {/* Clients attribués */}
      <Section title="Clients attribués" count={attributions.length}>
        {attributions.length === 0 ? (
          <Empty>Aucun client attribué à ce partenaire pour le moment.</Empty>
        ) : (
          <TableWrap head={["Client", "Inscription", "Conversion", "Statut"]}>
            {attributions.map((a) => (
              <tr key={a.user_id} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-2.5 text-sm">
                  <Link href={`/admin/utilisateurs/${a.user_id}`} className="hover:underline">
                    {emails.get(a.user_id) || a.user_id}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-sm text-muted-foreground">{formatAdminDate(a.signup_at)}</td>
                <td className="px-3 py-2.5 text-sm text-muted-foreground">{a.converted_at ? formatAdminDate(a.converted_at) : "—"}</td>
                <td className="px-3 py-2.5 text-sm">
                  <span className={a.status === "converted" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
                    {a.status === "converted" ? "Client payant" : "Inscrit"}
                  </span>
                </td>
              </tr>
            ))}
          </TableWrap>
        )}
      </Section>

      {/* Historique des commissions */}
      <Section title="Historique des commissions" count={commissions.length} link={{ href: `/admin/marketing/commissions?partenaire=${partner.id}`, label: "Filtrer les commissions" }}>
        {commissions.length === 0 ? (
          <Empty>Aucune commission. Une commission naît d’un paiement Stripe réellement encaissé.</Empty>
        ) : (
          <TableWrap head={["Date", "Facture", "Encaissé", "Taux", "Commission", "Statut"]}>
            {commissions.map((c) => (
              <tr key={c.id} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-2.5 text-sm text-muted-foreground">{formatAdminDate(c.earned_at)}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground"><code className="max-w-32 truncate">{c.stripe_invoice_id}</code></td>
                <td className="px-3 py-2.5 text-sm tabular-nums">{formatCents(c.gross_amount, c.currency)}</td>
                <td className="px-3 py-2.5 text-sm text-muted-foreground">
                  {c.commission_type === "percent" ? `${c.commission_rate} %` : "fixe"}
                </td>
                <td className="px-3 py-2.5 text-sm font-medium tabular-nums">{formatCents(c.commission_amount, c.currency)}</td>
                <td className="px-3 py-2.5"><CommissionStatusBadge status={c.status as CommissionStatus} /></td>
              </tr>
            ))}
          </TableWrap>
        )}
      </Section>

      {/* Historique des paiements */}
      <Section title="Historique des paiements" count={payouts.length} link={{ href: "/admin/marketing/paiements", label: "Gérer les paiements" }}>
        {payouts.length === 0 ? (
          <Empty>Aucun relevé de paiement pour ce partenaire.</Empty>
        ) : (
          <TableWrap head={["Créé le", "Période", "Montant", "Méthode", "Payé le", "Statut"]}>
            {payouts.map((p) => (
              <tr key={p.id} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-2.5 text-sm text-muted-foreground">{formatAdminDate(p.created_at)}</td>
                <td className="px-3 py-2.5 text-sm text-muted-foreground">{formatAdminDate(p.period_start)} → {formatAdminDate(p.period_end)}</td>
                <td className="px-3 py-2.5 text-sm font-medium tabular-nums">{formatCents(p.total_amount, p.currency)}</td>
                <td className="px-3 py-2.5 text-sm text-muted-foreground">{p.payment_method || "—"}</td>
                <td className="px-3 py-2.5 text-sm text-muted-foreground">{p.paid_at ? formatAdminDateTime(p.paid_at) : "—"}</td>
                <td className="px-3 py-2.5 text-sm text-muted-foreground">{PAYOUT_STATUS_LABELS[p.status as PayoutStatus]}</td>
              </tr>
            ))}
          </TableWrap>
        )}
      </Section>
    </div>
  );
}

function MiniStat({ label, value, isText }: { label: string; value: number | string; isText?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tabular-nums">{isText ? value : Number(value).toLocaleString("fr-FR")}</p>
    </div>
  );
}

function ContactRow({ icon, value, href }: { icon: React.ReactNode; value: string; href?: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <span className="shrink-0">{icon}</span>
      {value ? (
        href ? (
          <a href={href} className="truncate text-foreground hover:underline">{value}</a>
        ) : (
          <span className="truncate text-foreground">{value}</span>
        )
      ) : (
        <span>—</span>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  link,
  children,
}: {
  title: string;
  count: number;
  link?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">
          {title} <span className="text-muted-foreground">({count})</span>
        </h2>
        {link ? (
          <Link href={link.href} className="text-xs text-primary hover:underline">{link.label}</Link>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

function TableWrap({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="border-b border-border bg-muted/40">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
