import type { Metadata } from "next";
import Link from "next/link";
import { Award, Euro, Percent, Repeat, Ticket, TrendingUp } from "lucide-react";
import { ActionButton } from "@/components/admin/confirm-action";
import { PromoCreateDialog } from "@/components/admin/promo-create-dialog";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createPromoCode,
  setPromoCodeActive,
  syncPromoUsage,
} from "@/lib/admin/actions/promos";
import { getPromoStats } from "@/lib/admin/promo-stats";
import { PLAN_LABELS } from "@/lib/admin/labels";
import { formatAdminDate } from "@/lib/admin/format";
import { formatCents } from "@/lib/marketing/types";
import { isStripeConfigured } from "@/lib/stripe/config";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Codes promo" };
export const dynamic = "force-dynamic";

interface PromoRow {
  id: string;
  code: string;
  description: string;
  discount_type: "percent" | "amount";
  discount_value: number;
  duration: string;
  duration_months: number | null;
  applies_to_plans: string[];
  max_redemptions: number | null;
  once_per_customer: boolean;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  stripe_promotion_code_id: string | null;
  times_redeemed: number;
  created_at: string;
}

function discountLabel(row: PromoRow): string {
  return row.discount_type === "percent"
    ? `-${row.discount_value} %`
    : `-${Number(row.discount_value).toFixed(2).replace(".", ",")} €`;
}

function durationLabel(row: PromoRow): string {
  if (row.duration === "forever") return "Permanente";
  if (row.duration === "repeating") return `${row.duration_months ?? "?"} mois`;
  return "Une échéance";
}

function statusBadge(row: PromoRow) {
  const now = Date.now();
  if (!row.is_active) return <Badge variant="outline">Désactivé</Badge>;
  if (row.expires_at && Date.parse(row.expires_at) < now) {
    return <Badge variant="secondary">Expiré</Badge>;
  }
  if (row.starts_at && Date.parse(row.starts_at) > now) {
    return <Badge variant="secondary">Programmé</Badge>;
  }
  return <Badge>Actif</Badge>;
}

/** /admin/codes-promo — création et gestion des coupons (Stripe serveur). */
export default async function AdminPromoCodesPage() {
  const admin = createAdminClient();
  const [{ data, error }, stats] = await Promise.all([
    admin
      .from("promo_codes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    getPromoStats(),
  ]);
  if (error) throw new Error(`Lecture des codes promo impossible : ${error.message}`);
  const rows = (data ?? []) as PromoRow[];
  const usagePct =
    stats.usageRate === null ? "—" : `${Math.round(stats.usageRate * 1000) / 10} %`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Codes promo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isStripeConfigured
              ? "Les codes sont créés dans Stripe (source de vérité) et appliqués au paiement."
              : "Stripe n'est pas configuré : les codes créés ici ne s'appliquent à aucun paiement."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isStripeConfigured ? (
            <ActionButton label="Synchroniser les compteurs" action={syncPromoUsage} />
          ) : null}
          <PromoCreateDialog action={createPromoCode} />
        </div>
      </div>

      {/* Statistiques — sources réelles (compteurs + montants Stripe encaissés). */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="Codes"
          value={String(stats.totalCodes)}
          hint={`${stats.activeCodes} actif${stats.activeCodes > 1 ? "s" : ""}`}
          icon={Ticket}
        />
        <StatCard label="Utilisations" value={String(stats.totalRedemptions)} icon={Repeat} />
        <StatCard
          label="Réductions accordées"
          value={formatCents(stats.discountCents)}
          icon={Percent}
        />
        <StatCard
          label="CA généré"
          value={formatCents(stats.revenueCents)}
          hint="Encaissé sur commandes avec code"
          icon={Euro}
        />
        <StatCard
          label="Code le plus utilisé"
          value={stats.topCode?.code ?? "—"}
          hint={stats.topCode ? `${stats.topCode.times} utilisation${stats.topCode.times > 1 ? "s" : ""}` : undefined}
          icon={Award}
        />
        <StatCard
          label="Taux d'utilisation"
          value={usagePct}
          hint="Codes à nombre d'usages plafonné"
          icon={TrendingUp}
        />
      </div>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Réduction</TableHead>
              <TableHead>Durée</TableHead>
              <TableHead>Plans</TableHead>
              <TableHead>Utilisations</TableHead>
              <TableHead>Validité</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Aucun code promo. Créez le premier avec le bouton ci-dessus.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      href={`/admin/codes-promo/${row.id}`}
                      className="font-medium hover:underline"
                    >
                      {row.code}
                    </Link>
                    {row.description ? (
                      <span className="block max-w-44 truncate text-xs text-muted-foreground">
                        {row.description}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>{discountLabel(row)}</TableCell>
                  <TableCell className="text-muted-foreground">{durationLabel(row)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.applies_to_plans.length === 0
                      ? "Tous"
                      : row.applies_to_plans
                          .map((p) => PLAN_LABELS[p] ?? p)
                          .join(", ")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.times_redeemed}
                    {row.max_redemptions ? ` / ${row.max_redemptions}` : ""}
                    {row.once_per_customer ? " · 1re transaction" : ""}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.starts_at ? `dès ${formatAdminDate(row.starts_at)}` : ""}
                    {row.starts_at && row.expires_at ? " · " : ""}
                    {row.expires_at ? `jusqu'au ${formatAdminDate(row.expires_at)}` : ""}
                    {!row.starts_at && !row.expires_at ? "—" : ""}
                  </TableCell>
                  <TableCell>{statusBadge(row)}</TableCell>
                  <TableCell>
                    <ActionButton
                      label={row.is_active ? "Désactiver" : "Activer"}
                      size="xs"
                      action={setPromoCodeActive.bind(null, row.id, !row.is_active)}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
