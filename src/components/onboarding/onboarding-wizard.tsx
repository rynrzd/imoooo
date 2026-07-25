"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, PartyPopper, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { logger } from "@/lib/logger";
import { ONBOARDING_TOTAL_STEPS } from "@/lib/onboarding";
import { useAppStore } from "@/lib/store";
import { persistTourCompleted, startProductTour } from "./product-tour";

/**
 * Assistant de première connexion — 4 étapes courtes.
 *
 * Ouverture automatique UNIQUEMENT si : utilisateur authentifié (e-mail
 * confirmé, garanti par le proxy), profil chargé, et onboarding ni terminé ni
 * ignoré. La progression est persistée par étape côté serveur (POST
 * /api/onboarding) : la reprise se fait à la bonne étape après un
 * rafraîchissement ou sur un autre appareil. Jamais sur la landing, la
 * connexion, l'admin ou Stripe Checkout (le composant n'est monté que dans le
 * layout applicatif protégé). Relance manuelle depuis Paramètres
 * (événement `immopilot:onboarding`).
 */

export function OnboardingWizard() {
  const { profile, loading, completeOnboarding, skipOnboarding, saveOnboardingStep } =
    useAppStore();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [saving, setSaving] = React.useState(false);
  const openedRef = React.useRef(false);

  // Ouverture automatique après la première connexion, à l'étape mémorisée.
  // Différée d'un tick : pas de setState synchrone dans l'effet.
  React.useEffect(() => {
    if (loading || !profile || openedRef.current) return;
    if (!profile.onboardingCompleted && !profile.onboardingSkipped) {
      openedRef.current = true;
      const resume = Math.min(
        Math.max(profile.onboardingCurrentStep ?? 0, 0),
        ONBOARDING_TOTAL_STEPS - 1
      );
      // Différé d'un tick : pas de setState synchrone dans le corps de l'effet.
      const id = window.setTimeout(() => {
        setStep(resume);
        setOpen(true);
      }, 400);
      return () => window.clearTimeout(id);
    }
  }, [loading, profile]);

  // Relance manuelle (« Revoir le guide » dans Paramètres).
  React.useEffect(() => {
    const relaunch = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener("immopilot:onboarding", relaunch);
    return () => window.removeEventListener("immopilot:onboarding", relaunch);
  }, []);

  /**
   * Ferme définitivement le guide en persistant l'état FINAL (terminé ou
   * ignoré). En cas d'échec réel : le guide reste OUVERT, un message clair
   * invite à réessayer, et l'erreur technique est journalisée — jamais de
   * faux succès, jamais de fermeture silencieuse.
   */
  const dismiss = async (mode: "skip" | "complete", after?: () => void) => {
    if (saving) return;
    setSaving(true);
    try {
      if (mode === "complete") {
        if (!profile?.onboardingCompleted) await completeOnboarding();
      } else if (!profile?.onboardingSkipped) {
        await skipOnboarding(step);
      }
      setOpen(false);
      after?.();
    } catch (e) {
      logger.error(`onboarding/${mode}`, e);
      toast.error(
        "Impossible d'enregistrer votre progression. Vérifiez votre connexion et réessayez."
      );
      // On NE ferme PAS et on NE navigue PAS : l'utilisateur peut réessayer.
    } finally {
      setSaving(false);
    }
  };

  /**
   * Change d'étape et enregistre la progression (best-effort : une panne
   * réseau ne bloque pas la navigation dans le guide — seuls les états
   * « terminé » / « ignoré » sont strictement conditionnés au succès).
   */
  const goToStep = (next: number) => {
    const clamped = Math.min(Math.max(next, 0), ONBOARDING_TOTAL_STEPS - 1);
    setStep(clamped);
    void saveOnboardingStep(clamped).catch((e) => logger.error("onboarding/step", e));
  };

  const firstName = profile?.fullName?.split(" ")[0] ?? "";

  const steps: { title: string; body: React.ReactNode }[] = [
    {
      title: `Bienvenue sur Nireo${firstName ? `, ${firstName}` : ""} !`,
      body: (
        <p className="text-sm leading-relaxed text-muted-foreground">
          Votre espace de gestion locative est prêt : logements, locataires,
          loyers, documents et travaux, réunis au même endroit. Deux minutes
          suffisent pour démarrer.
        </p>
      ),
    },
    {
      title: "Complétez votre profil",
      body: (
        <div className="space-y-3">
          <p className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
            <UserRound className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              Nom, téléphone, entreprise ou SCI, photo : tout se règle dans
              <strong className="text-foreground"> Paramètres → Profil</strong>,
              avec la sécurité du compte et vos préférences de notifications.
            </span>
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => {
              void dismiss("complete", () => router.push("/parametres"));
            }}
          >
            Compléter mon profil maintenant
          </Button>
        </div>
      ),
    },
    {
      title: "Ajoutez votre premier logement",
      body: (
        <p className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
          <Building2 className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            Tout part du logement : bail, loyers, documents et photos
            s&apos;articulent autour de lui. Le bouton final ouvre la page
            Logements et son formulaire complet.
          </span>
        </p>
      ),
    },
    {
      title: "C'est parti !",
      body: (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <PartyPopper className="size-4 shrink-0 text-primary" />
            Votre espace est configuré. Une visite rapide de l&apos;interface
            (une minute) est disponible — une seule fois, jamais imposée.
          </p>
          <p className="text-xs text-muted-foreground">
            Onboarding et visite restent relançables à tout moment depuis
            Paramètres → Aide.
          </p>
        </div>
      ),
    },
  ];

  const isLast = step === ONBOARDING_TOTAL_STEPS - 1;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Fermeture (voile, Échap, croix) = ignorer : persiste puis ferme.
        if (!next) void dismiss("skip");
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
        <DialogTitle>{steps[step].title}</DialogTitle>
        <div className="space-y-4">
          <Progress
            value={((step + 1) * 100) / ONBOARDING_TOTAL_STEPS}
            aria-label={`Étape ${step + 1} sur ${ONBOARDING_TOTAL_STEPS}`}
          />
          <div className="animate-panel-in min-h-24">{steps[step].body}</div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" size="sm" disabled={saving} onClick={() => void dismiss("skip")}>
              Ignorer
            </Button>
            <div className="flex flex-wrap justify-end gap-2">
              {step > 0 ? (
                <Button variant="outline" disabled={saving} onClick={() => goToStep(step - 1)}>
                  Précédent
                </Button>
              ) : null}
              {isLast ? (
                <>
                  <Button
                    variant="ghost"
                    disabled={saving}
                    onClick={() => {
                      // « Ne plus proposer » : la visite ne sera plus suggérée.
                      void persistTourCompleted();
                      void dismiss("complete");
                    }}
                  >
                    Ne plus proposer
                  </Button>
                  <Button
                    variant="outline"
                    disabled={saving}
                    onClick={() => {
                      void dismiss("complete", () => startProductTour());
                    }}
                  >
                    Lancer la visite
                  </Button>
                  <Button
                    disabled={saving}
                    onClick={() => {
                      // Le vrai formulaire vit sur la page Logements : aucun
                      // second formulaire dupliqué.
                      void dismiss("complete", () => router.push("/logements"));
                    }}
                  >
                    {saving ? "Enregistrement…" : "Créer mon premier logement"}
                  </Button>
                </>
              ) : (
                <Button disabled={saving} onClick={() => goToStep(step + 1)}>
                  Suivant
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
