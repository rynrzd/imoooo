import type { NextConfig } from "next";

/** Headers de sécurité sobres — pas de CSP stricte non testée. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
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
