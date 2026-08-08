import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { SITE_URL } from "@/lib/supabase/config";
import { isPublicId } from "@/features/nireo-id/constants";
import { nidUserClient } from "@/features/nireo-id/server/client";
import { getNidSession } from "@/features/nireo-id/server/guards";

/**
 * Génération du QR code d'un passeport — fichier RÉEL (PNG ou SVG).
 *
 * Deux cibles possibles, toutes deux vérifiées côté serveur :
 *  • `public`  : l'aperçu public permanent, pour un passeport dont
 *    l'appelant est le propriétaire (contrôle via la RLS) ;
 *  • `partage` : un dossier partagé temporaire, dont l'appelant fournit
 *    le jeton qu'il vient de recevoir.
 *
 * Aucune donnée arbitraire n'est encodée : l'URL est toujours reconstruite
 * par le serveur à partir de valeurs validées.
 */

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,100}$/;

export async function GET(request: NextRequest) {
  const session = await getNidSession();
  if (!session) {
    return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  }

  if (!checkRateLimit(`nid-qr:${session.user.id}`, 60, 60_000)) {
    return NextResponse.json(
      { error: "Trop de demandes. Réessayez dans une minute." },
      { status: 429 }
    );
  }

  const { searchParams } = request.nextUrl;
  const format = searchParams.get("format") === "svg" ? "svg" : "png";
  const target = searchParams.get("cible") === "partage" ? "partage" : "public";

  let url: string;
  let fileName: string;

  if (target === "partage") {
    const token = searchParams.get("jeton") ?? "";
    if (!TOKEN_PATTERN.test(token)) {
      return NextResponse.json({ error: "Jeton de partage invalide." }, { status: 400 });
    }
    url = `${SITE_URL}/id/s/${token}`;
    fileName = `nireo-id-partage.${format}`;
  } else {
    const assetId = searchParams.get("objet") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(assetId)) {
      return NextResponse.json({ error: "Passeport invalide." }, { status: 400 });
    }
    // La RLS garantit qu'un utilisateur ne lit que SES passeports.
    const supabase = await nidUserClient();
    const { data } = await supabase
      .from("nid_assets")
      .select("public_id")
      .eq("id", assetId)
      .maybeSingle();
    const publicId = (data as { public_id: string } | null)?.public_id;
    if (!publicId || !isPublicId(publicId)) {
      return NextResponse.json({ error: "Passeport introuvable." }, { status: 404 });
    }
    url = `${SITE_URL}/id/p/${publicId}`;
    fileName = `nireo-id-${publicId}.${format}`;
  }

  try {
    if (format === "svg") {
      const svg = await QRCode.toString(url, {
        type: "svg",
        margin: 1,
        width: 512,
        errorCorrectionLevel: "M",
      });
      return new NextResponse(svg, {
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const buffer = await QRCode.toBuffer(url, {
      type: "png",
      margin: 1,
      width: 1024,
      errorCorrectionLevel: "M",
    });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logger.error("nireo-id/qr", error);
    return NextResponse.json({ error: "Génération du QR code impossible." }, { status: 500 });
  }
}
