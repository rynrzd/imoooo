import { NextResponse } from "next/server";
import { isUserAdmin } from "@/lib/admin/auth";
import { getSiteSettings } from "@/lib/admin/settings";
import { logger } from "@/lib/logger";
import { FOUNDER_TOTAL_PLACES, founderTierForPlace } from "@/config/plans";
import { getFounderPriceId, isStripeConfigured } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/server";
import { getUserSubscription } from "@/lib/stripe/subscription";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST /api/stripe/founder-checkout — Checkout Stripe en paiement UNIQUE
 * pour l'offre Fondateur. Le palier (1 : 299 €, 2 : 499 €) est déterminé
 * CÔTÉ SERVEUR d'après les places déjà confirmées — jamais par le client.
 * Aucune place n'est réservée ici : la place n'est attribuée (atomiquement)
 * que par le webhook après paiement réellement confirmé.
 */
export async function POST() {
  if (!isStripeConfigured) {
    return NextResponse.json(
      {
        error:
          "Le paiement en ligne n'est pas encore disponible. " +
          "Rejoignez la liste prioritaire depuis la page Tarifs.",
      },
      { status: 503 }
    );
  }
  if (!isAdminConfigured) {
    return NextResponse.json({ error: "Service momentanément indisponible." }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Connectez-vous pour continuer." }, { status: 401 });
  }

  // Un administrateur n'est pas un client Nireo : aucun achat possible.
  if (await isUserAdmin(user.id)) {
    return NextResponse.json(
      { error: "Un compte administrateur ne peut pas souscrire d'offre." },
      { status: 403 }
    );
  }

  try {
    const admin = createAdminClient();

    // Réglages de l'offre gérés depuis /admin/fondateurs : activation et
    // nombre de places (toujours plafonné à 100 par le serveur).
    const settings = await getSiteSettings();
    if (!settings.founder_enabled) {
      return NextResponse.json(
        { error: "L'offre Fondateur est momentanément désactivée." },
        { status: 410 }
      );
    }
    const maxPlaces = Math.min(FOUNDER_TOTAL_PLACES, settings.founder_max_places);

    // Déjà Fondateur confirmé, ou déjà accès à vie : rien à acheter.
    const subscription = await getUserSubscription(admin, user.id);
    const { data: existingPurchase } = await admin
      .from("founder_purchases")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (subscription?.lifetime_access || existingPurchase?.status === "confirmed") {
      return NextResponse.json(
        { error: "Votre compte dispose déjà d'un accès à vie." },
        { status: 409 }
      );
    }

    // Prochaine place d'après les achats CONFIRMÉS (source de vérité).
    const { count, error: countError } = await admin
      .from("founder_purchases")
      .select("id", { count: "exact", head: true })
      .eq("status", "confirmed");
    if (countError) throw new Error(countError.message);
    const confirmed = count ?? 0;
    if (confirmed >= maxPlaces) {
      return NextResponse.json(
        { error: "L'offre Fondateur est épuisée : toutes les places ont été attribuées." },
        { status: 410 }
      );
    }
    const tierInfo = founderTierForPlace(confirmed + 1);
    if (!tierInfo) {
      return NextResponse.json({ error: "Offre Fondateur indisponible." }, { status: 410 });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      line_items: [{ price: getFounderPriceId(tierInfo.tier), quantity: 1 }],
      metadata: { immopilot_founder: "1", user_id: user.id, tier: String(tierInfo.tier) },
      success_url: `${SITE_URL}/fondateur/bienvenue`,
      cancel_url: `${SITE_URL}/tarifs?founder=cancelled`,
    });
    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe n'a pas retourné d'URL de paiement." },
        { status: 502 }
      );
    }

    // Trace d'intention (status pending, AUCUNE place réservée).
    await admin.from("founder_purchases").upsert(
      {
        user_id: user.id,
        status: "pending",
        stripe_checkout_session_id: session.id,
        amount_cents: Math.round(tierInfo.price * 100),
        currency: "eur",
      },
      { onConflict: "user_id" }
    );

    return NextResponse.json({ url: session.url });
  } catch (e) {
    logger.error("[stripe/founder-checkout]", e);
    return NextResponse.json(
      { error: "Création de la session de paiement impossible. Réessayez." },
      { status: 500 }
    );
  }
}
