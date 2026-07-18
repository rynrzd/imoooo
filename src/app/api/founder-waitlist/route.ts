import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const waitlistSchema = z.object({
  email: z.string().trim().email("E-mail invalide.").max(200).optional(),
  // Champ piège anti-spam (traité silencieusement s'il est rempli).
  website: z.string().max(500).optional(),
});

/**
 * POST /api/founder-waitlist — inscription à la liste prioritaire de
 * l'offre Fondateur (tant que le paiement Stripe n'est pas actif).
 * N'attribue AUCUNE place, ne donne AUCUN accès : simple intention datée.
 */
export async function POST(request: Request) {
  if (!isAdminConfigured) {
    return NextResponse.json(
      { error: "Inscription momentanément indisponible. Réessayez plus tard." },
      { status: 503 }
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(`founder-waitlist:${ip}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans quelques minutes." },
      { status: 429 }
    );
  }

  let raw: unknown = {};
  try {
    raw = await request.json();
  } catch {
    // Corps vide accepté : l'e-mail vient alors de la session.
  }
  const parsed = waitlistSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." },
      { status: 400 }
    );
  }
  if (parsed.data.website) {
    return NextResponse.json({ joined: true }); // piège anti-spam : rien traité
  }

  // Utilisateur connecté : son adresse fait foi. Sinon, e-mail requis.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? parsed.data.email;
  if (!email) {
    return NextResponse.json(
      { error: "Indiquez votre adresse e-mail pour rejoindre la liste." },
      { status: 400 }
    );
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("founder_waitlist")
      .upsert(
        { email: email.toLowerCase(), user_id: user?.id ?? null },
        { onConflict: "email" }
      );
    if (error) throw new Error(error.message);
    return NextResponse.json({ joined: true });
  } catch (e) {
    logger.error("founder-waitlist", e);
    return NextResponse.json(
      { error: "Inscription impossible pour le moment. Réessayez." },
      { status: 502 }
    );
  }
}
