import { redirect } from "next/navigation";
import {
  BadgeEuro,
  BarChart3,
  LogOut,
  MousePointerClick,
  UserPlus,
  Wallet,
} from "lucide-react";
import { StatCard } from "@/components/admin/stat-card";
import { PartnerShare } from "@/components/marketing/partner-share";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAdminDate } from "@/lib/admin/format";
import { getAuthenticatedPartner } from "@/lib/marketing/partner-auth";
import {
  getPartnerCommissions,
  getPartnerDashboardStats,
} from "@/lib/marketing/partner-dashboard";
import { generateQrDataUrl } from "@/lib/marketing/qr";
import { formatCents } from "@/lib/marketing/types";
import { SITE_URL } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  approved: "Validée",
  payable: "À payer",
  paid: "Payée",
  cancelled: "Annulée",
  reversed: "Remboursée",
};

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  business: "Business+",
};

/** Tableau de bord self-service du partenaire (données réelles). */
export default async function PartnerDashboardPage() {
  const partner = await getAuthenticatedPartner();
  if (!partner) redirect("/partenaire?erreur=session");

  const [stats, commissions] = await Promise.all([
    getPartnerDashboardStats(partner.id),
    getPartnerCommissions(partner.id),
  ]);

  const referralLink = `${SITE_URL}/?ref=${partner.referralSlug}`;
  let qrDataUrl: string | null = null;
  try {
    qrDataUrl = await generateQrDataUrl(referralLink, 512);
  } catch {
    qrDataUrl = null;
  }

  const commissionLabel =
    partner.commissionType === "percent"
      ? `${partner.commissionValue} % du montant encaissé`
      : `${formatCents(Math.round(partner.commissionValue * 100))} par client payant`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Bonjour {partner.name || partner.companyName || "partenaire"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {partner.companyName ? `${partner.companyName} · ` : ""}Commission :{" "}
            {commissionLabel}
          </p>
        </div>
        <a
          href="/partenaire/deconnexion"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <LogOut className="size-4" aria-hidden />
          Se déconnecter
        </a>
      </div>

      {!partner.isActive ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          Votre compte partenaire est actuellement suspendu : votre lien
          n&apos;attribue plus de nouvelles inscriptions. Contactez Nireo pour
          le réactiver. Votre historique reste consultable.
        </p>
      ) : null}

      {/* Activité */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Clics" value={String(stats.clicks)} icon={MousePointerClick} />
        <StatCard label="Inscriptions" value={String(stats.signups)} icon={UserPlus} />
        <StatCard label="Abonnements" value={String(stats.conversions)} icon={BarChart3} />
        <StatCard
          label="CA généré"
          value={formatCents(stats.grossRevenueCents)}
          hint="Encaissé sur vos filleuls"
          icon={BadgeEuro}
        />
      </div>

      {/* Commissions */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Commissions gagnées"
          value={formatCents(stats.earnedCents)}
          icon={Wallet}
        />
        <StatCard label="Déjà payées" value={formatCents(stats.paidCents)} />
        <StatCard
          label="Restant à payer"
          value={formatCents(stats.remainingCents)}
          hint="Versé par virement"
        />
      </div>

      {/* Lien + QR */}
      <div className="rounded-xl border border-border bg-card p-5">
        <PartnerShare referralLink={referralLink} qrDataUrl={qrDataUrl} />
      </div>

      {/* Historique des commissions */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-foreground">Historique des commissions</h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Encaissé</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Aucune commission pour le moment. Vos gains apparaîtront ici
                    dès qu&apos;un filleul règle son abonnement.
                  </TableCell>
                </TableRow>
              ) : (
                commissions.map((c, i) => (
                  <TableRow key={`${c.earnedAt}-${i}`}>
                    <TableCell>{formatAdminDate(c.earnedAt)}</TableCell>
                    <TableCell>{PLAN_LABELS[c.plan] ?? c.plan ?? "—"}</TableCell>
                    <TableCell>{formatCents(c.grossCents)}</TableCell>
                    <TableCell className="font-medium">{formatCents(c.commissionCents)}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "paid" ? "default" : "secondary"}>
                        {STATUS_LABELS[c.status] ?? c.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
