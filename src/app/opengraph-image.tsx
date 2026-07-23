import { ImageResponse } from "next/og";

/**
 * Image Open Graph / Twitter du site (1200 × 630), générée au build.
 * Convention de fichier Next.js : ajoute automatiquement og:image et
 * twitter:image (avec dimensions) sur toutes les pages.
 */
export const alt =
  "Nireo — Le logiciel de gestion locative des propriétaires bailleurs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          background: "linear-gradient(180deg, #0c0c0d 0%, #1a1a1c 100%)",
          color: "#fafafa",
        }}
      >
        <div style={{ fontSize: 110, fontWeight: 700, letterSpacing: -4 }}>
          Nireo
        </div>
        <div
          style={{
            fontSize: 34,
            color: "#d4d4d8",
            maxWidth: 900,
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          Gérez tout votre patrimoine immobilier depuis une seule plateforme
        </div>
        <div style={{ fontSize: 24, color: "#8f8f96" }}>nireo.fr</div>
      </div>
    ),
    { ...size }
  );
}
