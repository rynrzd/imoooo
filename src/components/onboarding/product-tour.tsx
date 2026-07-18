"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logger } from "@/lib/logger";

/**
 * Visite guidée — met en évidence des éléments RÉELS de l'interface
 * (liens de la sidebar, ciblés par href). Les cibles absentes (mobile,
 * page différente) sont automatiquement sautées ; si aucune cible
 * n'existe, l'étape s'affiche centrée — jamais de blocage.
 * Persistance : profiles.product_tour_completed (jamais réaffichée
 * automatiquement). Relance : événement `immopilot:tour`.
 */

interface TourStep {
  selector: string | null;
  title: string;
  text: string;
}

const STEPS: TourStep[] = [
  { selector: 'aside a[href="/"]', title: "Dashboard", text: "Vos indicateurs, alertes et actions à traiter, en un coup d'œil." },
  { selector: 'aside a[href="/logements"]', title: "Logements", text: "Chaque bien est un dossier vivant : bail, loyers, documents, photos, travaux." },
  { selector: 'aside a[href="/loyers"]', title: "Loyers", text: "Échéances mensuelles générées automatiquement, encaissements en un clic." },
  { selector: 'aside a[href="/documents"]', title: "Documents", text: "Bibliothèque privée classée par logement et par catégorie." },
  { selector: 'aside [aria-label^="Notifications"]', title: "Notifications", text: "Loyers en retard, documents qui expirent : les alertes arrivent ici." },
  { selector: 'aside a[href="/parametres"]', title: "Paramètres", text: "Profil, sécurité, notifications, abonnement — et relance de cette visite." },
];

/** Déclenche la visite depuis n'importe où (onboarding, Paramètres). */
export function startProductTour(): void {
  window.dispatchEvent(new CustomEvent("immopilot:tour"));
}

/** Marque la visite comme terminée (ou refusée définitivement) en base :
 * plus jamais proposée automatiquement. Silencieux en mode démo. */
export async function persistTourCompleted(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ product_tour_completed: true })
      .eq("id", user.id);
  } catch (e) {
    logger.error("tour/persist", e);
  }
}

export function ProductTour() {
  const [active, setActive] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  const [rect, setRect] = React.useState<DOMRect | null>(null);

  React.useEffect(() => {
    const start = () => {
      setIndex(0);
      setActive(true);
    };
    window.addEventListener("immopilot:tour", start);
    return () => window.removeEventListener("immopilot:tour", start);
  }, []);

  // Position de la cible de l'étape courante (null = carte centrée).
  // Mesure différée d'une frame : pas de setState synchrone dans l'effet.
  React.useEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() => {
      const step = STEPS[index];
      const element = step.selector
        ? document.querySelector<HTMLElement>(step.selector)
        : null;
      setRect(element ? element.getBoundingClientRect() : null);
    });
    return () => cancelAnimationFrame(frame);
  }, [active, index]);

  if (!active) return null;

  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  const close = (completed: boolean) => {
    setActive(false);
    if (completed) void persistTourCompleted();
  };

  // Popover près de la cible (à droite de la sidebar) ou centré.
  const popoverStyle: React.CSSProperties = rect
    ? {
        position: "fixed",
        top: Math.min(Math.max(rect.top - 8, 16), window.innerHeight - 220),
        left: Math.min(rect.right + 12, window.innerWidth - 336),
      }
    : {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Visite guidée">
      {/* Voile — clic = ignorer (jamais bloquant). */}
      <button
        type="button"
        aria-label="Ignorer la visite"
        className="absolute inset-0 bg-black/40 motion-safe:transition-opacity"
        onClick={() => close(false)}
      />
      {/* Halo sur la cible réelle. */}
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background motion-safe:transition-all motion-safe:duration-200"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
          }}
        />
      ) : null}
      <div
        style={popoverStyle}
        className="w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card p-4 shadow-lg"
      >
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Étape {index + 1} / {STEPS.length}
        </p>
        <h2 className="mt-1 text-sm font-semibold text-foreground">{step.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button size="sm" variant="ghost" onClick={() => close(false)}>
            Ignorer
          </Button>
          <div className="flex gap-1.5">
            {index > 0 ? (
              <Button size="sm" variant="outline" onClick={() => setIndex((i) => i - 1)}>
                Précédent
              </Button>
            ) : null}
            {isLast ? (
              <Button size="sm" onClick={() => close(true)}>
                Terminer
              </Button>
            ) : (
              <Button size="sm" onClick={() => setIndex((i) => i + 1)}>
                Suivant
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
