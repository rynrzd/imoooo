import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ActionButton } from "@/components/admin/confirm-action";
import { PromoDescriptionForm } from "@/components/admin/promo-description-form";
import { Badge } from "@/components/ui/badge";
import {
  setPromoCodeActive,
  updatePromoDescription,
} from "@/lib/admin/actions/promos";
import { PLAN_LABELS } from "@/lib/admin/labels";
import { formatAdminDate } from "@/lib/admin/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Code promo" };
export const dynamic = "force-dynamic";

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right text-sm">{value}</span>
    </div>
  );
}

/** /admin/codes-promo/[id] — détail d'un code + utilisateurs l'ayant utilisé. */
export default async function AdminPromoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: promo, error } = await admin
    .from("promo_codes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!promo) notFound();

  const { data: redemptions } = await admin
    .from("promo_code_redemptions")
    .select("id, user_id, user_email, amount_total_cents, created_at")
    .eq("promo_code_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/codes-promo"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            <ArrowLeft className="size-3.5" /> Codes promo
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{promo.code}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={promo.is_active ? "default" : "outline"}>
            {promo.is_active ? "Actif" : "Désactivé"}
          </Badge>
          <ActionButton
            label={promo.is_active ? "Désactiver" : "Activer"}
            action={setPromoCodeActive.bind(null, id, !promo.is_active)}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="text-sm font-medium">Détails</h2>
          <div className="mt-2 divide-y divide-border/60">
            <Info
              label="Réduction"
              value={
                promo.discount_type === "percent"
                  ? `-${promo.discount_value} %`
                  : `-${Number(promo.discount_value).toFixed(2).replace(".", ",")} €`
              }
            />
            <Info
              label="Durée"
              value={
                promo.duration === "forever"
                  ? "Permanente"
                  : promo.duration === "repeating"
                    ? `${promo.duration_months ?? "?"} mois`
                    : "Une échéance"
              }
            />
            <Info
              label="Plans concernés"
              value={
                (promo.applies_to_plans as string[]).length === 0
                  ? "Tous les plans payants"
                  : (promo.applies_to_plans as string[])
                      .map((p) => PLAN_LABELS[p] ?? p)
                      .join(", ")
              }
            />
            <Info
              label="Utilisations"
              value={`${promo.times_redeemed}${promo.max_redemptions ? ` / ${promo.max_redemptions}` : " (illimité)"}`}
            />
            <Info
              label="Restriction"
              value={promo.once_per_customer ? "Première transaction uniquement" : "Aucune"}
            />
            <Info
              label="Début"
              value={promo.starts_at ? formatAdminDate(promo.starts_at) : "Immédiat"}
            />
            <Info
              label="Expiration"
              value={promo.expires_at ? formatAdminDate(promo.expires_at) : "Aucune"}
            />
            <Info
              label="Stripe"
              value={
                promo.stripe_promotion_code_id ? (
                  <code className="text-xs">{promo.stripe_promotion_code_id}</code>
                ) : (
                  "Non lié (créé sans Stripe)"
                )
              }
            />
            <Info label="Créé le" value={formatAdminDate(promo.created_at)} />
          </div>
          <div className="mt-3 border-t border-border/60 pt-3">
            <PromoDescriptionForm
              initial={(promo.description as string) ?? ""}
              action={updatePromoDescription.bind(null, id)}
            />
          </div>
        </div>

        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="text-sm font-medium">Utilisateurs ayant utilisé ce code</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Alimenté par le webhook Stripe à chaque paiement Checkout avec ce code.
          </p>
          <div className="mt-2 divide-y divide-border/60">
            {(redemptions ?? []).length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">Aucune utilisation enregistrée.</p>
            ) : (
              (redemptions ?? []).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    {r.user_id ? (
                      <Link
                        href={`/admin/utilisateurs/${r.user_id}`}
                        className="block truncate text-sm font-medium hover:underline"
                      >
                        {r.user_email || r.user_id}
                      </Link>
                    ) : (
                      <span className="block truncate text-sm">{r.user_email || "Inconnu"}</span>
                    )}
                    {typeof r.amount_total_cents === "number" ? (
                      <p className="text-xs text-muted-foreground">
                        Paiement :{" "}
                        {(r.amount_total_cents / 100).toFixed(2).replace(".", ",")} €
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatAdminDate(r.created_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
