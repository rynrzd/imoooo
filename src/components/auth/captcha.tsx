"use client";

import * as React from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

/**
 * Protection anti-force brute des formulaires d'authentification.
 *
 * POURQUOI ICI, ET PAS DANS UNE ROUTE NIREO
 * -----------------------------------------
 * La connexion part du NAVIGATEUR vers GoTrue (`signInWithPassword`) : elle
 * ne traverse aucun serveur Nireo. Une limite posée dans une route `/api`
 * se contournerait donc en appelant Supabase directement, avec la clé
 * publishable qui est publique par construction. Le seul verrou qui tienne
 * est celui que GoTrue applique lui-même.
 *
 * Une fois la protection CAPTCHA activée dans le projet Supabase, GoTrue
 * REFUSE toute tentative d'authentification sans jeton valide — y compris
 * les appels directs à son API. C'est ce qui la rend non contournable, là
 * où un compteur applicatif ne l'aurait jamais été.
 *
 * ÉTAT PAR DÉFAUT : INACTIF
 * -------------------------
 * Sans `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, ce composant ne rend RIEN et
 * `useCaptcha` renvoie un jeton `undefined` : les pages d'authentification
 * se comportent exactement comme avant, au pixel près. Activer la
 * protection = renseigner la clé, puis l'activer côté Supabase. Les deux
 * doivent aller ensemble (voir .env.example).
 *
 * En mode « Managed », Turnstile ne demande aucune interaction à un
 * visiteur normal : rien n'apparaît, rien n'est à cocher.
 */

/** Clé publique du site Turnstile. Vide = protection désactivée. */
export const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "";

/** La protection est-elle configurée ? */
export const isCaptchaEnabled = TURNSTILE_SITE_KEY.length > 0;

/**
 * Délai maximal d'attente du jeton Cloudflare, en millisecondes.
 *
 * Le défi n'est PAS résolu à l'instant où la page s'affiche : le script de
 * Cloudflare doit d'abord être chargé, puis exécuté. Toute soumission plus
 * rapide que lui partait sans jeton, et GoTrue la refusait — c'est exactement
 * l'erreur « captcha protection: request disallowed (no captcha_token found) ».
 *
 * Passé ce délai, la tentative part quand même : une panne de Cloudflare doit
 * se solder par un message clair (voir auth-errors.ts), jamais par un
 * formulaire qui ne répond plus.
 */
const TOKEN_TIMEOUT_MS = 15_000;

export interface CaptchaState {
  /** Élément à insérer dans le formulaire (null si inactif). */
  widget: React.ReactNode;
  /**
   * Jeton à joindre à l'appel Supabase, à lire DANS le gestionnaire d'envoi.
   *
   * Attend que Cloudflare ait résolu le défi — y compris lorsque celui-ci
   * réclame un clic — au lieu de lire un état qui n'est peut-être pas encore
   * arrivé. Renvoie `undefined` si la protection est inactive ou si le défi
   * n'a pas abouti dans le délai imparti.
   */
  getToken: () => Promise<string | undefined>;
  /**
   * À appeler après CHAQUE tentative : un jeton Turnstile est à usage
   * unique. Sans cela, une seconde tentative depuis le même écran (mot de
   * passe erroné, par exemple) serait refusée par GoTrue pour jeton déjà
   * consommé — l'utilisateur verrait un échec incompréhensible.
   */
  reset: () => void;
}

/**
 * Branche la protection sur un formulaire d'authentification.
 *
 * Le bouton d'envoi n'est JAMAIS désactivé en attendant le jeton. C'était la
 * première version de ce code, et elle était dangereuse : un bloqueur de
 * publicité, un réseau lent ou une panne de Cloudflare laissait l'utilisateur
 * devant un bouton mort, sans explication et sans recours. L'attente a lieu au
 * moment de l'envoi (`getToken`), pendant que le bouton affiche déjà sa
 * progression : la tentative attend le jeton au lieu de partir sans lui, et
 * elle finit toujours par partir.
 */
export function useCaptcha(): CaptchaState {
  const widgetRef = React.useRef<TurnstileInstance | null>(null);
  // Le jeton vit dans une RÉFÉRENCE, pas dans un état. Un état aurait deux
  // défauts ici : il réaffiche le formulaire à chaque défi résolu, et surtout
  // il est capturé au rendu — le gestionnaire d'envoi aurait lu une valeur
  // figée, `undefined` tant que Cloudflare n'avait pas répondu avant le
  // premier rendu.
  const tokenRef = React.useRef<string | undefined>(undefined);

  const reset = React.useCallback(() => {
    if (!isCaptchaEnabled) return;
    tokenRef.current = undefined;
    widgetRef.current?.reset();
  }, []);

  const getToken = React.useCallback(async () => {
    if (!isCaptchaEnabled) return undefined;
    // Défi déjà résolu : aucun délai pour l'utilisateur.
    if (tokenRef.current) return tokenRef.current;
    try {
      // Sinon on interroge le widget lui-même, qui répond dès que le défi
      // aboutit. C'est la seule façon d'obtenir le jeton d'une tentative
      // envoyée avant que Cloudflare ait fini.
      return await widgetRef.current?.getResponsePromise(TOKEN_TIMEOUT_MS);
    } catch {
      // Délai dépassé, script bloqué ou défi en erreur : on laisse partir la
      // tentative sans jeton, GoTrue expliquera pourquoi elle est refusée.
      return undefined;
    }
  }, []);

  const widget = isCaptchaEnabled ? (
    <Turnstile
      ref={widgetRef}
      siteKey={TURNSTILE_SITE_KEY}
      onSuccess={(token) => {
        tokenRef.current = token;
      }}
      // Défi expiré ou en erreur : on repart d'un jeton vide plutôt que
      // d'envoyer un jeton périmé que GoTrue rejetterait.
      onExpire={() => {
        tokenRef.current = undefined;
      }}
      onError={() => {
        tokenRef.current = undefined;
      }}
      options={{
        // « Managed » laisse Cloudflare décider : invisible pour un humain.
        appearance: "interaction-only",
        size: "flexible",
        language: "fr",
      }}
      className="flex justify-center"
    />
  ) : null;

  return { widget, getToken, reset };
}

/**
 * Options d'authentification Supabase portant le jeton.
 *
 * Renvoie un objet VIDE quand la protection est inactive : l'appel à
 * Supabase reste alors identique à ce qu'il était, sans champ superflu.
 */
export function captchaOptions(token: string | undefined): { captchaToken?: string } {
  return token ? { captchaToken: token } : {};
}
