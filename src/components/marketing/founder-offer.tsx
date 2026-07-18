"use client";

import * as React from "react";
import { Check, Crown, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  FOUNDER_SCOPE_NOTICE,
  FOUNDER_TIERS,
  FOUNDER_TOTAL_PLACES,
  founderTierForPlace,
} from "@/config/plans";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

/**
 * Offre Fondateur — 100 places, accès Business+ à vie. Section Premium
 * affichée AU-DESSUS des abonnements sur la page Tarifs.
 * - Compteur RÉEL : RPC founder_offer_status (achats CONFIRMÉS par le webhook
 *   Stripe uniquement) ; s'il n'est pas fiable, aucun chiffre n'est affiché.
 * - 100 places vendues : la section disparaît entièrement.
 * - Sans Stripe : le bouton est présent mais inactif — aucun achat simulé,
 *   aucune liste d'attente.
 */

/** Avantages Fondateur — uniquement des engagements réels. */
const FOUNDER_BENEFITS = [
  "Business+ à vie",
  "Toutes les futures fonctionnalités Business+ incluses",
  "Badge Fondateur exclusif (numéroté)",
  "Accès anticipé aux nouveautés",
  "Aucun abonnement mensuel",
];

export function FounderOffer({ stripeEnabled }: { stripeEnabled: boolean }) {
  const [confirmed, setConfirmed] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);

  // La section est rendue immédiatement (SSR compris) au palier courant ;
  // le compteur réel arrive dès la réponse — et masque tout si l'offre est
  // épuisée. Jamais de chiffre inventé : sans réponse, pas de compteur.
  React.useEffect(() => {
    if (!isSupabaseConfigured) return;
    createClient()
      .rpc("founder_offer_status")
      .then(({ data, error }) => {
        if (!error && data && typeof data.confirmed === "number") {
          setConfirmed(data.confirmed);
        }
      });
  }, []);

  // Compteur indisponible (RPC absente / erreur) : l'offre est présentée au
  // palier 1 mais sans compteur — jamais de chiffre inventé.
  const soldCount = confirmed ?? 0;
  const currentTier = founderTierForPlace(soldCount + 1);
  if (!currentTier) return null; // 100 places attribuées : offre terminée.

  const remainingTotal = FOUNDER_TOTAL_PLACES - soldCount;

  const buy = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/stripe/founder-checkout", { method: "POST" });
      const body = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
      if (response.status === 401) {
        window.location.assign("/inscription");
        return;
      }
      if (!response.ok || !body.url) {
        toast.error(body.error ?? "Paiement indisponible pour le moment.");
        return;
      }
      window.location.assign(body.url);
    } catch {
      toast.error("Erreur réseau. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Reveal>
      <section aria-labelledby="offre-fondateur" className="space-y-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="flex items-center justify-center gap-1.5 text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            <Star className="size-3.5 fill-current" aria-hidden />
            Offre Fondateur
            <Star className="size-3.5 fill-current" aria-hidden />
          </p>
          <h2
            id="offre-fondateur"
            className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
          >
            Seulement {FOUNDER_TOTAL_PLACES} places à vie.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Un paiement unique, l&apos;intégralité de Business+ pour toujours —
            réservé aux {FOUNDER_TOTAL_PLACES} premiers comptes.
          </p>
        </div>

        {/* Carte Premium inversée : contraste maximal, cohérente clair/sombre. */}
        <div className="relative overflow-hidden rounded-2xl bg-foreground text-background shadow-[0_24px_64px_-24px_rgb(0_0_0/0.5)]">
          {/* Halo décoratif discret. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-28 -right-28 size-72 rounded-full bg-background/10 blur-3xl"
          />
          <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:gap-12">
            <div className="space-y-5">
              <p className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
                <Crown className="size-4" />
                Membre Fondateur
              </p>
              <ul className="space-y-2.5">
                {FOUNDER_BENEFITS.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2.5 text-sm sm:text-[15px]">
                    <Check className="mt-0.5 size-4 shrink-0 opacity-70" />
                    {benefit}
                  </li>
                ))}
              </ul>
              <p className="text-xs leading-relaxed opacity-60">{FOUNDER_SCOPE_NOTICE}</p>
            </div>

            <div className="flex flex-col justify-center gap-4">
              {/* Les deux paliers : l'actuel est mis en avant, l'autre annoncé. */}
              <div className="grid grid-cols-2 gap-3">
                {FOUNDER_TIERS.map((tier) => {
                  const isCurrent = tier.tier === currentTier.tier;
                  const isSoldOut = tier.toPlace <= soldCount;
                  return (
                    <div
                      key={tier.tier}
                      className={cn(
                        "rounded-xl border p-3.5 sm:p-4",
                        isCurrent
                          ? "border-background/40 bg-background/10"
                          : "border-background/15 opacity-60"
                      )}
                    >
                      <p className="text-2xl font-semibold tracking-tight sm:text-3xl">
                        {tier.price} €
                        <span className="text-xs font-normal opacity-70"> à vie</span>
                      </p>
                      <p className="mt-1 text-xs opacity-80">
                        {isSoldOut
                          ? "Palier épuisé"
                          : tier.tier === 1
                            ? "pour les 50 premiers"
                            : "pour les 50 suivants"}
                      </p>
                    </div>
                  );
                })}
              </div>

              {confirmed !== null ? (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">
                    {remainingTotal} / {FOUNDER_TOTAL_PLACES} places restantes
                  </p>
                  <div
                    role="progressbar"
                    aria-valuenow={soldCount}
                    aria-valuemin={0}
                    aria-valuemax={FOUNDER_TOTAL_PLACES}
                    aria-label="Places Fondateur attribuées"
                    className="h-1.5 overflow-hidden rounded-full bg-background/20"
                  >
                    <div
                      className="h-full rounded-full bg-background transition-[width] duration-700"
                      style={{ width: `${(soldCount / FOUNDER_TOTAL_PLACES) * 100}%` }}
                    />
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Button
                  size="lg"
                  disabled={!stripeEnabled || busy}
                  onClick={() => void buy()}
                  className="w-full bg-background text-foreground shadow-md transition-transform hover:bg-background/90 motion-safe:hover:scale-[1.02]"
                >
                  <Crown data-icon="inline-start" />
                  {busy ? "Redirection…" : "Devenir Fondateur"}
                </Button>
                {!stripeEnabled ? (
                  <p className="text-center text-xs opacity-70">
                    Paiement en ligne bientôt disponible — aucune place ne peut
                    être réservée pour l&apos;instant.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    </Reveal>
  );
}
