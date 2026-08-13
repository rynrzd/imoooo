"use client";

import Link from "next/link";
import { Rocket } from "lucide-react";
import {
  SettingsPageShell,
  SettingsSection,
} from "@/components/profile/settings-shell";
import { CONTACT_EMAIL } from "@/components/marketing/site-footer";
import { ONBOARDING_EVENT } from "@/lib/onboarding";
import { useAppStore } from "@/lib/store";

/**
 * Guide de démarrage et aide.
 *
 * Le guide se relance ici, exactement là où l'utilisateur l'avait laissé :
 * l'étape courante est lue depuis Supabase (`onboarding_current_step`), donc la
 * reprise fonctionne aussi depuis un autre appareil.
 */

const APP_VERSION = "0.1.0 (bêta)";

export default function HelpPage() {
  const { data, profile } = useAppStore();

  const step = profile?.onboardingCurrentStep ?? 0;
  const finished = Boolean(profile?.onboardingCompleted);
  const hasProperty = data.properties.length > 0;

  // Ce que l'on annonce doit être vrai : sans logement, le guide repart du
  // début ; sinon il reprend à l'étape enregistrée.
  const resumeLabel = !hasProperty
    ? "Commencer le guide"
    : finished
      ? "Refaire le guide"
      : step > 0
        ? "Reprendre le guide"
        : "Commencer le guide";

  return (
    <SettingsPageShell
      title="Aide et guide"
      description="Reprendre la mise en route, ou nous joindre si quelque chose bloque."
    >
      <SettingsSection
        title="Guide de démarrage"
        description="Il ne raconte rien : il crée réellement votre logement, sa location et son bail. Vous pouvez le quitter à tout moment, il reprendra où vous en étiez."
      >
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(new CustomEvent(ONBOARDING_EVENT))
          }
          className="inline-flex min-h-12 items-center gap-2 rounded-[0.625rem] bg-primary px-5 text-[0.95rem] font-semibold text-primary-foreground transition-opacity hover:opacity-95"
        >
          <Rocket className="size-4" aria-hidden />
          {resumeLabel}
        </button>
      </SettingsSection>

      <SettingsSection
        title="Support"
        description={`Nireo version ${APP_VERSION}.`}
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href="/tarifs#faq"
            className="inline-flex min-h-11 items-center rounded-[0.625rem] border border-input bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Questions fréquentes
          </Link>
          <Link
            href="/contact"
            className="inline-flex min-h-11 items-center rounded-[0.625rem] border border-input bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Nous contacter
          </Link>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("[Nireo] Signalement de bug")}`}
            className="inline-flex min-h-11 items-center rounded-[0.625rem] border border-input bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Signaler un problème
          </a>
        </div>
      </SettingsSection>
    </SettingsPageShell>
  );
}
