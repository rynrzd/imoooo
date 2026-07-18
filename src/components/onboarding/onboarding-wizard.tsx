"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, PartyPopper, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { logger } from "@/lib/logger";
import { useAppStore } from "@/lib/store";
import { persistTourCompleted, startProductTour } from "./product-tour";

/**
 * Assistant de première connexion — 4 étapes courtes, affiché UNE seule fois.
 * Ouverture automatique uniquement si : utilisateur authentifié (e-mail
 * confirmé, garanti par le proxy), profil chargé depuis Supabase et
 * profiles.onboarding_completed = false. Jamais sur la landing, jamais
 * pendant le callback, jamais après un simple rafraîchissement une fois
 * terminé ou ignoré (statut persisté en base, pas en localStorage).
 * Relance MANUELLE possible depuis Paramètres (événement `immopilot:onboarding`).
 */

const TOTAL_STEPS = 4;

export function OnboardingWizard() {
  const { profile, loading, completeOnboarding } = useAppStore();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [saving, setSaving] = React.useState(false);
  const openedRef = React.useRef(false);

  // Ouverture automatique après la première connexion uniquement
  // (différée d'un tick : pas de setState synchrone dans l'effet).
  React.useEffect(() => {
    if (loading || !profile || openedRef.current) return;
    if (profile.onboardingCompleted === false) {
      openedRef.current = true;
      const id = window.setTimeout(() => setOpen(true), 400);
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

  /** Termine (ou ignore définitivement) : persiste puis ferme. */
  const finish = async (after?: () => void) => {
    setSaving(true);
    try {
      if (!profile?.onboardingCompleted) await completeOnboarding();
      setOpen(false);
      after?.();
    } catch (e) {
      logger.error("onboarding/complete", e);
      // Jamais bloquant, mais jamais de faux succès : on explique la conséquence.
      setOpen(false);
      toast.error(
        "Impossible d'enregistrer votre progression : le guide pourra réapparaître à la prochaine connexion."
      );
      after?.();
    } finally {
      setSaving(false);
    }
  };

  const firstName = profile?.fullName?.split(" ")[0] ?? "";

  const steps: { title: string; body: React.ReactNode }[] = [
    {
      title: `Bienvenue sur ImmoPilot${firstName ? `, ${firstName}` : ""} !`,
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
              void finish(() => router.push("/parametres"));
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

  const isLast = step === TOTAL_STEPS - 1;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Fermeture = ignorer définitivement : plus jamais d'ouverture automatique.
        if (!next) void finish();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogTitle>{steps[step].title}</DialogTitle>
        <div className="space-y-4">
          <Progress
            value={((step + 1) * 100) / TOTAL_STEPS}
            aria-label={`Étape ${step + 1} sur ${TOTAL_STEPS}`}
          />
          <div className="animate-panel-in min-h-24">{steps[step].body}</div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" size="sm" disabled={saving} onClick={() => void finish()}>
              Ignorer
            </Button>
            <div className="flex flex-wrap justify-end gap-2">
              {step > 0 ? (
                <Button variant="outline" disabled={saving} onClick={() => setStep((s) => s - 1)}>
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
                      void finish();
                    }}
                  >
                    Ne plus proposer
                  </Button>
                  <Button
                    variant="outline"
                    disabled={saving}
                    onClick={() => {
                      void finish(() => startProductTour());
                    }}
                  >
                    Lancer la visite
                  </Button>
                  <Button
                    disabled={saving}
                    onClick={() => {
                      // Le vrai formulaire vit sur la page Logements : aucun
                      // second formulaire dupliqué.
                      void finish(() => router.push("/logements"));
                    }}
                  >
                    {saving ? "Enregistrement…" : "Créer mon premier logement"}
                  </Button>
                </>
              ) : (
                <Button disabled={saving} onClick={() => setStep((s) => s + 1)}>
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
