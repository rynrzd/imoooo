"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Check, CreditCard, Crown } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/layout/page-header";
import { PlanBadge } from "@/components/subscription/plan-badge";
import { getPlan, PLANS, type PaidPlanId, type Plan } from "@/config/plans";
import { resolvePlan, type SubscriptionRow } from "@/lib/stripe/subscription";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Page Abonnement — plan réel (table subscriptions, RLS lecture seule),
 * quotas réellement consommés, accès Fondateur affiché. Les boutons
 * appellent les routes Stripe ; sans clés elles répondent 503 et
 * l'interface l'explique — aucun paiement simulé.
 */

async function postJson(path: string, body?: unknown): Promise<{ url?: string }> {
  const response = await fetch(path, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as {
    url?: string;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error ?? "Une erreur est survenue. Réessayez.");
  }
  return data;
}

const priceLabel = (price: number) =>
  price.toLocaleString("fr-FR", { minimumFractionDigits: price % 1 === 0 ? 0 : 2 });

/** Un seul toast de retour Checkout à la fois (sonner remplace par id). */
const CHECKOUT_TOAST_ID = "checkout-return";

/** Le retour de Checkout n'est traité qu'une fois, même si AppDataBoundary
 * démonte puis remonte la page pendant refresh() (portée module, pas ref). */
let checkoutSyncActive = false;

const SYNC_MAX_ATTEMPTS = 5;
const SYNC_DELAY_MS = 3000;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Après un Checkout abonnement : interroge /api/stripe/sync jusqu'à ce que le
 * plan payant soit réellement écrit en base (webhook ou resynchronisation),
 * avec limite de tentatives. Le succès n'est JAMAIS annoncé sur la seule foi
 * de l'ouverture de success_url.
 */
async function syncAfterCheckout(refresh: () => Promise<void>): Promise<void> {
  if (checkoutSyncActive) return;
  checkoutSyncActive = true;
  try {
    for (let attempt = 1; attempt <= SYNC_MAX_ATTEMPTS; attempt++) {
      let plan: string | null = null;
      try {
        const response = await fetch("/api/stripe/sync", { method: "POST" });
        const body = (await response.json().catch(() => ({}))) as { plan?: string };
        if (response.ok && typeof body.plan === "string") plan = body.plan;
      } catch {
        // Erreur réseau : on retentera.
      }
      if (plan && plan !== "free") {
        toast.success(`Merci ! Votre plan ${getPlan(plan).name} est actif.`, {
          id: CHECKOUT_TOAST_ID,
        });
        await refresh();
        return;
      }
      if (attempt < SYNC_MAX_ATTEMPTS) await wait(SYNC_DELAY_MS);
    }
    toast.info(
      "Paiement transmis. L'activation sera appliquée dès la confirmation de Stripe — actualisez la page dans quelques instants.",
      { id: CHECKOUT_TOAST_ID, duration: 10000 }
    );
    await refresh();
  } finally {
    checkoutSyncActive = false;
  }
}

/**
 * Après un Checkout Fondateur : la place n'est attribuée QUE par le webhook
 * (fonction SQL idempotente). On attend qu'elle apparaisse sur la ligne
 * subscriptions (lecture RLS), avec la même limite de tentatives.
 */
async function syncFounderAfterCheckout(refresh: () => Promise<void>): Promise<void> {
  if (checkoutSyncActive) return;
  checkoutSyncActive = true;
  try {
    const supabase = createClient();
    for (let attempt = 1; attempt <= SYNC_MAX_ATTEMPTS; attempt++) {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data: row } = await supabase
          .from("subscriptions")
          .select("lifetime_access")
          .eq("user_id", user.id)
          .maybeSingle();
        if (row?.lifetime_access) {
          toast.success("Bienvenue parmi les Fondateurs ! Votre accès à vie est actif.", {
            id: CHECKOUT_TOAST_ID,
          });
          await refresh();
          return;
        }
      } catch {
        // Erreur réseau : on retentera.
      }
      if (attempt < SYNC_MAX_ATTEMPTS) await wait(SYNC_DELAY_MS);
    }
    toast.info(
      "Paiement transmis. Votre place Fondateur sera confirmée d'ici quelques instants — actualisez la page.",
      { id: CHECKOUT_TOAST_ID, duration: 10000 }
    );
    await refresh();
  } finally {
    checkoutSyncActive = false;
  }
}

export function SubscriptionPageClient({ stripeEnabled }: { stripeEnabled: boolean }) {
  // useSearchParams impose une frontière Suspense pour le prérendu statique.
  return (
    <React.Suspense fallback={null}>
      <SubscriptionContent stripeEnabled={stripeEnabled} />
    </React.Suspense>
  );
}

function QuotaLine({
  label,
  used,
  max,
}: {
  label: string;
  used: number;
  max: number | null;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums text-foreground">
          {used} / {max === null ? "illimité" : max}
        </span>
      </div>
      {max !== null ? (
        <Progress value={Math.min(100, (used * 100) / Math.max(1, max))} aria-label={label} />
      ) : null}
    </div>
  );
}

function SubscriptionContent({ stripeEnabled }: { stripeEnabled: boolean }) {
  const { profile, data, refresh } = useAppStore();
  const searchParams = useSearchParams();
  const [pendingPlan, setPendingPlan] = React.useState<string | null>(null);
  const [portalPending, setPortalPending] = React.useState(false);
  const [subscription, setSubscription] = React.useState<SubscriptionRow | null>(null);

  // Abonnement réel (RLS : sa propre ligne, lecture seule). Le plan
  // affiché retombe sur profiles.plan si la ligne manque — jamais bloquant.
  React.useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: row } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (row) setSubscription(row as SubscriptionRow);
    });
  }, []);

  const currentPlan: Plan = subscription
    ? resolvePlan(subscription)
    : getPlan(profile?.plan);
  const isFounder = Boolean(subscription?.lifetime_access && subscription.provider === "founder");
  const checkoutState = searchParams.get("checkout");
  const founderState = searchParams.get("founder");

  // Retour de Stripe Checkout. IMPORTANT : le paramètre est retiré de l'URL
  // de façon SYNCHRONE avant tout refresh() — refresh() passe le store en
  // loading, AppDataBoundary démonte alors la page, et un remontage avec
  // ?checkout=success encore présent relançait indéfiniment toast + refresh.
  React.useEffect(() => {
    if (!checkoutState && !founderState) return;
    window.history.replaceState(null, "", window.location.pathname);

    if (checkoutState === "success") {
      // Jamais « abonnement actif » sur la seule ouverture de success_url :
      // le succès n'est annoncé qu'une fois le plan payant confirmé en base.
      toast.info("Paiement reçu, activation en cours…", {
        id: CHECKOUT_TOAST_ID,
        duration: 15000,
      });
      void syncAfterCheckout(refresh);
    } else if (checkoutState === "cancelled") {
      toast.info("Paiement annulé — aucun montant n'a été débité.", {
        id: CHECKOUT_TOAST_ID,
      });
    } else if (founderState === "success") {
      toast.info("Paiement reçu, confirmation de votre place Fondateur en cours…", {
        id: CHECKOUT_TOAST_ID,
        duration: 15000,
      });
      void syncFounderAfterCheckout(refresh);
    }
  }, [checkoutState, founderState, refresh]);

  const choosePlan = async (planId: PaidPlanId) => {
    setPendingPlan(planId);
    try {
      const { url } = await postJson("/api/stripe/checkout", { plan: planId });
      if (url) window.location.assign(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Paiement indisponible.");
      setPendingPlan(null);
    }
  };

  const openPortal = async () => {
    setPortalPending(true);
    try {
      const { url } = await postJson("/api/stripe/portal");
      if (url) window.location.assign(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Portail indisponible.");
      setPortalPending(false);
    }
  };

  const activeTenants = data.tenants.filter((t) => !t.exitDate).length;
  const startedAt = subscription?.created_at
    ? new Date(subscription.created_at).toLocaleDateString("fr-FR")
    : null;
  const renewsAt = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString("fr-FR")
    : null;

  return (
    <>
      <PageHeader
        title="Abonnement"
        description="Choisissez le plan adapté à la taille de votre patrimoine"
      />

      {/* État de l'abonnement */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-medium">
              Votre abonnement
              <PlanBadge planId={currentPlan.id} />
              {isFounder ? (
                <Badge variant="secondary" className="gap-1">
                  <Crown className="size-3 text-primary" />
                  Membre Fondateur n°{subscription?.founder_purchase_number}
                </Badge>
              ) : null}
            </CardTitle>
            <CardDescription>
              {isFounder
                ? "Accès Business+ à vie (offre Fondateur) — aucun renouvellement, aucune facturation."
                : currentPlan.id === "free"
                  ? "Vous utilisez le plan gratuit. Passez à un plan supérieur pour débloquer plus de logements et de fonctionnalités."
                  : `Plan ${currentPlan.name} actif${renewsAt ? ` — renouvellement le ${renewsAt}` : ""}. Gérez votre facturation depuis le portail sécurisé Stripe.`}
              {startedAt ? ` Depuis le ${startedAt}.` : ""}
            </CardDescription>
          </div>
          {subscription?.provider === "stripe" && currentPlan.id !== "free" ? (
            <Button variant="outline" onClick={() => void openPortal()} disabled={portalPending}>
              <CreditCard data-icon="inline-start" />
              {portalPending ? "Ouverture…" : "Gérer mon abonnement"}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <QuotaLine
            label="Logements"
            used={data.properties.length}
            max={currentPlan.limits.maxProperties}
          />
          <QuotaLine
            label="Locataires actifs"
            used={activeTenants}
            max={currentPlan.limits.maxActiveTenants}
          />
          <QuotaLine
            label="Documents"
            used={data.documents.length}
            max={currentPlan.limits.maxDocuments}
          />
          <QuotaLine label="Photos" used={data.photos.length} max={currentPlan.limits.maxPhotos} />
          {/* Avantages réellement débloqués par le plan actuel. */}
          <div className="sm:col-span-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Inclus dans votre plan
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {currentPlan.highlights.map((feature) => (
                <li
                  key={feature}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-foreground"
                >
                  <Check className="size-3 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Tarifs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan.id;
          const isPending = pendingPlan === plan.id;
          return (
            <Card
              key={plan.id}
              className={cn(
                "relative flex flex-col",
                plan.popular && "border-primary shadow-sm"
              )}
            >
              {plan.popular ? (
                <Badge className="absolute -top-2.5 left-4">Recommandé</Badge>
              ) : null}
              <CardHeader>
                <CardTitle className="text-sm font-medium">{plan.name}</CardTitle>
                <p className="pt-1">
                  <span className="text-2xl font-semibold tracking-tight text-foreground">
                    {priceLabel(plan.monthlyPrice)} €
                  </span>
                  <span className="text-sm text-muted-foreground"> /mois</span>
                </p>
                <p className="text-xs text-muted-foreground">{plan.description}</p>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-2">
                  {plan.highlights.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-foreground"
                    >
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {plan.id === "free" ? (
                  <Button className="w-full" variant="outline" disabled>
                    {isCurrent ? "Plan actuel" : "Plan de départ"}
                  </Button>
                ) : isFounder ? (
                  <Button className="w-full" variant="outline" disabled>
                    {plan.id === "business" ? "Inclus à vie (Fondateur)" : "Couvert par votre accès à vie"}
                  </Button>
                ) : !stripeEnabled && !isCurrent ? (
                  // Stripe non configuré : jamais de faux bouton de paiement.
                  <Button className="w-full" variant="outline" disabled>
                    Paiement en ligne bientôt disponible
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    disabled={isCurrent || pendingPlan !== null}
                    onClick={() => void choosePlan(plan.id as PaidPlanId)}
                  >
                    {isCurrent
                      ? "Plan actuel"
                      : isPending
                        ? "Redirection…"
                        : "Choisir ce plan"}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Paiement sécurisé par Stripe. Les prix sont indiqués hors taxes.
        Changement de plan et résiliation possibles à tout moment depuis
        « Gérer mon abonnement », au prorata de la période en cours.
      </p>
    </>
  );
}
