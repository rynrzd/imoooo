import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/auth";
import { logger } from "@/lib/logger";
import { getPartner } from "@/lib/marketing/partners";
import { generateQrPng, generateQrSvg, sanitizeQrSize, verifyQrContent } from "@/lib/marketing/qr";
import { buildPartnerLink } from "@/lib/marketing/referral";

export const runtime = "nodejs";

/**
 * GET /api/admin/marketing/qr?partner=ID&format=png|svg&size=256|512|1024|2048
 * &download=1
 *
 * QR code RÉEL du lien unique d'un partenaire. Réservé aux administrateurs
 * actifs (vérification en base) : le QR encode une URL publique mais la
 * génération reste une fonction d'admin. Le contenu encodé est vérifié
 * après génération (il doit correspondre exactement au lien du partenaire).
 */
export async function GET(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx) {
    return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const partnerId = searchParams.get("partner") ?? "";
  const format = searchParams.get("format") === "svg" ? "svg" : "png";
  const size = sanitizeQrSize(searchParams.get("size"));
  const download = searchParams.get("download") === "1";

  try {
    const partner = await getPartner(partnerId);
    if (!partner) {
      return NextResponse.json({ error: "Partenaire introuvable." }, { status: 404 });
    }

    const link = buildPartnerLink(partner.referral_slug);
    if (!verifyQrContent(link)) {
      return NextResponse.json(
        { error: "Vérification du QR code impossible pour ce lien." },
        { status: 500 }
      );
    }

    const baseName = `qr-nireo-${partner.referral_slug}${format === "png" ? `-${size}px` : ""}`;
    const disposition = (ext: string) =>
      `${download ? "attachment" : "inline"}; filename="${baseName}.${ext}"`;

    if (format === "svg") {
      const svg = await generateQrSvg(link);
      return new NextResponse(svg, {
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Content-Disposition": disposition("svg"),
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    const png = await generateQrPng(link, size);
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": disposition("png"),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    logger.error("api/admin/marketing/qr", e);
    return NextResponse.json({ error: "Génération du QR code impossible." }, { status: 500 });
  }
}
