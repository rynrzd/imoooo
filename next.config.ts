import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content-Security-Policy — construite à partir des domaines RÉELLEMENT
 * appelés par Nireo, pas d'une liste recopiée.
 *
 * Inventaire (vérifié dans src/) :
 *  • `*.supabase.co`            base, authentification, Storage (URL signées),
 *                               temps réel (wss) et vidéo publique de /a-propos ;
 *  • `images.unsplash.com`      photos du mode démo (déjà dans `images.remotePatterns`) ;
 *  • `tile.openstreetmap.org`   fonds de carte du Pilotage (Leaflet) ;
 *  • `nominatim.openstreetmap.org` géocodage d'une adresse (fetch) ;
 *  • rien d'autre : Stripe se fait par REDIRECTION (aucun script tiers chargé),
 *    les polices sont locales, l'analytique est first-party.
 *
 * `script-src` conserve `'unsafe-inline'` : Next.js injecte ses propres
 * scripts en ligne (bootstrap, flight data) et `next-themes` pose le thème
 * avant peinture. S'en passer imposerait un nonce par requête, donc un rendu
 * DYNAMIQUE de toutes les pages — la vitrine statique et son référencement en
 * feraient les frais. La CSP reste donc une couche de défense (elle borne
 * strictement OÙ les données peuvent partir via `connect-src`, `form-action`
 * et `base-uri`), pas un remède complet contre l'injection de script.
 *
 * `'unsafe-eval'` est ajouté en développement UNIQUEMENT : React s'en sert
 * pour reconstruire les piles d'erreur serveur dans le navigateur.
 */
/**
 * Cloudflare Turnstile — protège les formulaires d'authentification contre
 * la force brute (voir src/components/auth/captcha.tsx).
 *
 * Le domaine n'est ouvert QUE si la clé est réellement configurée : tant
 * que la protection dort, la CSP reste aussi stricte qu'avant. Élargir une
 * politique « au cas où » revient à ne pas la resserrer du tout.
 *
 * `frame-src` est nécessaire : Turnstile rend son défi dans une iframe.
 */
const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());
const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${
    turnstileEnabled ? ` ${TURNSTILE_ORIGIN}` : ""
  }`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://*.supabase.co https://images.unsplash.com https://*.tile.openstreetmap.org https://tile.openstreetmap.org",
  "media-src 'self' blob: https://*.supabase.co",
  "font-src 'self' data:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://nominatim.openstreetmap.org${
    turnstileEnabled ? ` ${TURNSTILE_ORIGIN}` : ""
  }`,
  "worker-src 'self' blob:",
  // Aucune iframe n'est permise tant que Turnstile n'est pas activé.
  turnstileEnabled ? `frame-src ${TURNSTILE_ORIGIN}` : "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

/**
 * En-têtes de sécurité.
 *
 * `Strict-Transport-Security` n'est posé qu'en production : en développement,
 * il condamnerait `http://localhost` dans le navigateur pour six mois, y
 * compris pour d'autres projets servis sur le même hôte.
 *
 * `camera=(self)` — et non `camera=()` : le scanner de Nireo ID
 * (src/components/nireo-id/identifier-scanner.tsx et box-scanner.tsx) appelle
 * `getUserMedia`. `camera=()` refusait l'accès à TOUT LE MONDE, y compris à
 * Nireo lui-même : la fonctionnalité ne pouvait pas marcher en ligne. Les
 * origines tierces restent interdites (aucune iframe n'hérite du droit).
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  /**
   * `Cross-Origin-Opener-Policy` — isole le contexte de navigation.
   *
   * Un site tiers qui ouvre Nireo (ou que Nireo ouvre) ne partage plus le
   * même groupe de contextes : plus de `window.opener`, donc plus de fuite
   * d'état entre onglets, et l'isolation par processus redevient effective.
   *
   * Aucune fonctionnalité n'en dépend : Nireo n'ouvre AUCUNE fenêtre
   * surgissante — Stripe se fait par redirection (`checkout.sessions` →
   * `session.url`), et Turnstile rend son défi dans une IFRAME, que la
   * politique ne concerne pas. Voilà pourquoi `same-origin` peut être posé
   * ici sans le dégrader en `same-origin-allow-popups`.
   *
   * `Cross-Origin-Resource-Policy` n'est volontairement PAS posé : il
   * empêcherait les robots sociaux (Facebook, X, LinkedIn) de charger
   * `/opengraph-image` depuis leur propre origine — l'aperçu des partages
   * deviendrait vide, pour un gain nul sur des ressources déjà publiques.
   */
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=15552000; includeSubDomains",
        },
      ]),
];

/**
 * Anciens chemins publics « Produit », « Sécurité » et « FAQ ».
 *
 * Ces contenus vivent désormais DANS la landing, sous forme d'ancres. Les URL
 * correspondantes ne doivent pour autant jamais mourir : un lien externe, un
 * signet ou une saisie directe atterrit sur la bonne section.
 *
 * Sans ces règles, le proxy (src/proxy.ts) traiterait ces chemins comme des
 * pages privées et renverrait un visiteur anonyme vers /connexion — un lien
 * mort silencieux. Les redirections de `next.config` sont évaluées AVANT le
 * proxy : elles priment donc dans tous les cas.
 *
 * `permanent: false` (307) volontairement : ces ancres sont jeunes, et une
 * 308 se grave dans le cache des navigateurs.
 */
const legacyAnchorRedirects = [
  { from: "/produit", to: "/#produit" },
  { from: "/fonctionnalites", to: "/#produit" },
  { from: "/securite", to: "/#securite" },
  { from: "/faq", to: "/#faq" },
  { from: "/questions-frequentes", to: "/#faq" },
  { from: "/decouvrir", to: "/#decouvrir" },
];

const nextConfig: NextConfig = {
  /**
   * `X-Powered-By: Next.js` — retiré. Cet en-tête n'apporte rien au
   * fonctionnement et annonce le framework ET sa famille de versions à
   * qui balaie le web à la recherche d'une cible. Le supprimer ne protège
   * de rien à lui seul (le reste de la réponse trahit Next.js), mais il n'y
   * a aucune raison de tendre l'information.
   */
  poweredByHeader: false,
  images: {
    remotePatterns: [
      // Photos de démonstration (mode démo uniquement).
      { protocol: "https", hostname: "images.unsplash.com" },
      // URLs signées du Storage Supabase (photos des logements).
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  async redirects() {
    return legacyAnchorRedirects.map(({ from, to }) => ({
      source: from,
      destination: to,
      permanent: false,
    }));
  },
};

export default nextConfig;
