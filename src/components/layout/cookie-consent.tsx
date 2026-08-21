"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  parseConsent,
  type ConsentChoice,
} from "@/lib/consent";

/**
 * Bandeau de consentement — il COMMANDE réellement le dépôt des cookies.
 *
 * Ce n'est pas un bandeau d'apparence : tant que « Accepter » n'a pas été
 * choisi, le proxy ne pose ni `nireo_vid`, ni `nireo_vst`, ni `nireo_ref`
 * (voir src/proxy.ts et src/lib/consent.ts). Refuser refuse pour de bon.
 *
 * Choix d'implémentation :
 *  • rendu à `null` au premier passage, puis lecture du cookie dans un effet :
 *    le serveur ne connaît pas encore le choix au moment du rendu, et rendre
 *    le bandeau côté serveur provoquerait un décalage d'hydratation visible ;
 *  • les deux boutons ont le MÊME poids visuel : présenter « Refuser » comme
 *    un lien discret à côté d'un bouton plein rendrait le refus plus coûteux
 *    que l'acceptation, ce que la CNIL refuse explicitement ;
 *  • aucune fermeture par croix ni par clic à côté : ni acceptation ni refus
 *    ne peuvent être déduits d'un geste ambigu.
 *
 * Le bandeau ne s'affiche jamais dans l'espace administrateur ni dans les
 * parcours d'authentification : aucun cookie de mesure n'y est posé, et il
 * masquerait des actions critiques.
 */

function readConsentCookie(): string | undefined {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`))
    ?.split("=")[1];
}

function writeChoice(choice: ConsentChoice): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${choice}; Path=/; Max-Age=${CONSENT_MAX_AGE}; SameSite=Lax${secure}`;
}

/** Zones où le bandeau ne doit jamais apparaître. */
const HIDDEN_PREFIXES = [
  "/admin",
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
  "/reinitialiser-mot-de-passe",
  "/verification-email",
  "/partenaire",
];

export function CookieConsent() {
  const pathname = usePathname();
  const [choice, setChoice] = React.useState<ConsentChoice | null | undefined>(undefined);

  React.useEffect(() => {
    // Lecture différée d'un tick — même idiome que le reste du projet
    // (cf. `useTenantNotes`) : un `setState` synchrone dans un effet est une
    // erreur bloquante ici, et rendrait la cascade de rendus visible.
    const id = window.setTimeout(() => {
      const raw = readConsentCookie();
      setChoice(parseConsent(raw));
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  // `undefined` = pas encore lu (rendu serveur et première image) ;
  // une valeur = choix déjà exprimé. Dans les deux cas, rien à afficher.
  if (choice !== null) return null;
  // Aucun cookie de mesure n'est posé dans ces zones : y demander un
  // consentement n'aurait aucun objet, et le bandeau masquerait des actions.
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  const decide = (value: ConsentChoice) => {
    writeChoice(value);
    setChoice(value);
    // Rechargement : c'est le PROXY qui pose les cookies (ils sont HttpOnly,
    // donc hors de portée du JavaScript), et il ne s'exécute qu'à la requête
    // suivante. Sans cela, « Accepter » resterait sans effet jusqu'à la
    // prochaine navigation — et « Refuser » ne retirerait pas ce qui a
    // éventuellement déjà été posé.
    window.location.reload();
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-title"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:p-5"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="space-y-1">
          <p id="consent-title" className="text-sm font-medium text-foreground">
            Cookies de mesure
          </p>
          <p className="text-sm text-muted-foreground">
            Nous aimerions mesurer la fréquentation du site et adapter la page
            d&apos;accueil. Ces cookies ne sont pas nécessaires au
            fonctionnement de Nireo : le service marche exactement pareil si
            vous refusez.{" "}
            <Link href="/cookies" className="underline underline-offset-4 hover:text-foreground">
              En savoir plus
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {/* Même taille, même hiérarchie : refuser doit être aussi simple
              qu'accepter. */}
          <Button variant="outline" size="sm" onClick={() => decide("essential")}>
            Refuser
          </Button>
          <Button size="sm" onClick={() => decide("all")}>
            Accepter
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Réglage permanent, affiché sur /cookies : permet de REVENIR sur son choix
 * à tout moment — sans quoi le consentement ne serait pas révocable.
 */
export function CookiePreferences() {
  const [choice, setChoice] = React.useState<ConsentChoice | null | undefined>(undefined);

  React.useEffect(() => {
    // Lecture différée d'un tick — même idiome que le reste du projet
    // (cf. `useTenantNotes`) : un `setState` synchrone dans un effet est une
    // erreur bloquante ici, et rendrait la cascade de rendus visible.
    const id = window.setTimeout(() => {
      const raw = readConsentCookie();
      setChoice(parseConsent(raw));
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  if (choice === undefined) return null;

  const apply = (value: ConsentChoice) => {
    writeChoice(value);
    setChoice(value);
    window.location.reload();
  };

  const label =
    choice === "all"
      ? "Vous avez accepté les cookies de mesure."
      : choice === "essential"
        ? "Vous avez refusé les cookies de mesure. Seuls les cookies indispensables sont déposés."
        : "Vous n'avez pas encore fait de choix. Aucun cookie de mesure n'est déposé pour l'instant.";

  return (
    <div className="mt-4 rounded-xl border border-border p-4">
      <p className="text-sm text-foreground">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant={choice === "essential" ? "default" : "outline"}
          size="sm"
          onClick={() => apply("essential")}
        >
          Refuser les cookies de mesure
        </Button>
        <Button
          variant={choice === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => apply("all")}
        >
          Accepter les cookies de mesure
        </Button>
      </div>
    </div>
  );
}
