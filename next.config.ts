import type { NextConfig } from "next";

/** Headers de sécurité sobres — pas de CSP stricte non testée. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
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
};

export default nextConfig;
