import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { isNireoIdConfigured, nidUserClient } from "@/features/nireo-id/server/client";
import { getNidSession } from "@/features/nireo-id/server/guards";

/**
 * Export structuré des données personnelles Nireo ID (JSON).
 *
 * Lecture faite avec la SESSION de l'utilisateur : la RLS garantit qu'un
 * export ne contient que ses propres données. Les fichiers eux-mêmes ne
 * sont pas inclus (le format resterait un JSON) : leurs métadonnées le
 * sont, et chaque document reste téléchargeable depuis son passeport.
 */
export async function GET() {
  const session = await getNidSession();
  if (!session) {
    return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  }
  if (!isNireoIdConfigured) {
    return NextResponse.json({ error: "Nireo ID indisponible." }, { status: 503 });
  }
  if (!checkRateLimit(`nid-export:${session.user.id}`, 5, 60_000)) {
    return NextResponse.json(
      { error: "Trop de demandes. Réessayez dans une minute." },
      { status: 429 }
    );
  }

  try {
    const supabase = await nidUserClient();
    const [assets, events, documents, media, shares, transfers, ownerships] = await Promise.all([
      supabase.from("nid_assets").select("*"),
      supabase.from("nid_events").select("*"),
      supabase
        .from("nid_documents")
        .select("id, asset_id, event_id, kind, original_name, mime_type, size_bytes, transfer_policy, status, created_at"),
      supabase.from("nid_media").select("id, asset_id, event_id, kind, caption, position, created_at"),
      supabase
        .from("nid_share_links")
        .select("id, asset_id, label, sections, allow_download, expires_at, revoked_at, access_count, created_at"),
      supabase.from("nid_transfers").select("*"),
      supabase.from("nid_ownerships").select("*"),
    ]);

    const payload = {
      produit: "Nireo ID",
      genere_le: new Date().toISOString(),
      compte: { id: session.user.id, email: session.email },
      passeports: assets.data ?? [],
      evenements: events.data ?? [],
      documents: documents.data ?? [],
      photos: media.data ?? [],
      liens_de_partage: shares.data ?? [],
      transferts: transfers.data ?? [],
      proprietes: ownerships.data ?? [],
      note:
        "Les fichiers (documents, photos) ne sont pas inclus dans ce JSON : " +
        "ils restent téléchargeables individuellement depuis chaque passeport.",
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="nireo-id-export-${new Date()
          .toISOString()
          .slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logger.error("nireo-id/export", error);
    return NextResponse.json({ error: "Export impossible pour le moment." }, { status: 500 });
  }
}
