"use client";

import * as React from "react";
import { Check, Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** Avantages affichés à la confirmation — engagements réels uniquement. */
const BENEFITS = [
  "Business+ à vie, sans abonnement",
  "Badge Fondateur numéroté",
  "Toutes les futures fonctionnalités Business+ incluses",
];

/** ~45 s de filet de sécurité (15 × 3 s) avant de proposer « Actualiser ». */
const POLL_ATTEMPTS = 15;
const POLL_DELAY_MS = 3000;
/** Redirection automatique vers le tableau de bord après confirmation. */
const AUTO_REDIRECT_MS = 3000;
const DASHBOARD_URL = "/";

type State =
  | { kind: "waiting" }
  | { kind: "confirmed"; founderNumber: number | null }
  | { kind: "timeout" };

/**
 * Retour du paiement Fondateur. La place n'est attribuée QUE par le webhook
 * Stripe (fonction SQL atomique) : cette page ATTEND la confirmation en base
 * (lecture RLS de sa propre ligne) et n'affiche jamais un succès non confirmé.
 */
export default function FounderWelcomePage() {
  const [state, setState] = React.useState<State>({ kind: "waiting" });
  const startedRef = React.useRef(false);

  React.useEffect(() => {
    if (startedRef.current || !isSupabaseConfigured) return;
    startedRef.current = true;
    let cancelled = false;
    const supabase = createClient();

    const poll = async () => {
      for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt++) {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) return;
          const { data: row } = await supabase
            .from("subscriptions")
            .select("lifetime_access, status, founder_purchase_number")
            .eq("user_id", user.id)
            .maybeSingle();
          if (cancelled) return;
          // Accès confirmé : place Fondateur (lifetime) OU abonnement actif.
          // On s'arrête IMMÉDIATEMENT — jamais de polling au-delà.
          if (row && (row.lifetime_access || row.status === "active")) {
            setState({
              kind: "confirmed",
              founderNumber: row.founder_purchase_number ?? null,
            });
            return;
          }
        } catch {
          // Erreur réseau : tentative suivante.
        }
        if (attempt < POLL_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, POLL_DELAY_MS));
          if (cancelled) return;
        }
      }
      if (!cancelled) setState({ kind: "timeout" });
    };
    void poll();
    return () => {
      cancelled = true;
    };
    // startedRef garantit une seule exécution (double-invoke StrictMode inclus).
    // Aucun refresh() du store ici : il repasserait le store en « loading »,
    // AppDataBoundary démonterait la page et le polling reboucquerait.
  }, []);

  // Confirmation détectée : redirection automatique vers le tableau de bord.
  // Navigation PLEINE PAGE (le store se recharge → plan Business+ à jour).
  React.useEffect(() => {
    if (state.kind !== "confirmed") return;
    const id = window.setTimeout(() => {
      window.location.assign(DASHBOARD_URL);
    }, AUTO_REDIRECT_MS);
    return () => window.clearTimeout(id);
  }, [state.kind]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-lg space-y-6 rounded-2xl border border-border bg-card p-8 text-center shadow-sm sm:p-10">
        {state.kind === "waiting" ? (
          <>
            <Loader2 className="mx-auto size-8 animate-spin text-primary" aria-hidden />
            <div className="space-y-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Paiement reçu, activation en cours…
              </h1>
              <p className="text-sm text-muted-foreground">
                Votre place Fondateur est en train d&apos;être confirmée par notre
                système de paiement. Cela prend généralement quelques secondes.
              </p>
            </div>
          </>
        ) : state.kind === "confirmed" ? (
          <>
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Crown className="size-7" aria-hidden />
            </span>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Bienvenue Fondateur 🎉
              </h1>
              <p className="text-sm text-muted-foreground">
                Merci de faire partie des 100 premiers utilisateurs
                d&apos;ImmoPilot.
                {state.founderNumber ? (
                  <>
                    {" "}
                    Vous êtes le membre Fondateur{" "}
                    <span className="font-semibold text-foreground">
                      n°{state.founderNumber}
                    </span>
                    .
                  </>
                ) : null}
              </p>
            </div>
            <ul className="mx-auto max-w-xs space-y-2 text-left">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {benefit}
                </li>
              ))}
            </ul>
            <div className="space-y-1.5">
              <Button
                size="lg"
                onClick={() => window.location.assign(DASHBOARD_URL)}
              >
                Accéder à ImmoPilot
              </Button>
              <p className="text-xs text-muted-foreground">
                Redirection automatique en cours…
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Paiement reçu, activation en cours
              </h1>
              <p className="text-sm text-muted-foreground">
                La confirmation prend plus de temps que prévu. Votre place sera
                activée automatiquement dès la validation du paiement — aucun
                nouvel achat n&apos;est nécessaire.
              </p>
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => window.location.reload()}>
                Actualiser
              </Button>
              <Button onClick={() => window.location.assign("/abonnement")}>
                Voir mon abonnement
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
