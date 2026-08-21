import { redirect } from "next/navigation";
import { NireoLogo } from "@/components/marketing/nireo-logo";
import { PlanRecommendation } from "@/components/onboarding/plan-recommendation";
import { isUserAdmin } from "@/lib/admin/auth";
import { logger } from "@/lib/logger";
import { isStripeConfigured } from "@/lib/stripe/config";
import { getUserSubscription, resolvePlan } from "@/lib/stripe/subscription";
import { isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Étape de bienvenue — PLUS AUCUN PARCOURS N'Y MÈNE.
 *
 * Elle s'intercalait entre la validation du compte et le tableau de bord pour
 * demander « Combien de logements gérez-vous ? » et recommander un plan. Un
 * compte fraîchement créé va maintenant DIRECTEMENT à son espace, où la seule
 * action proposée est l'ajout du premier logement : on ne parle d'abonnement
 * qu'au moment où la limite du plan Gratuit est réellement atteinte
 * (page /abonnement). Plus aucun lien, plus aucune redirection ne pointe ici ;
 * la route reste servie (et gardée) pour ne casser aucun favori.
 *
 * Elle pose UNE question — « Combien de logements gérez-vous ? » — et en
 * déduit le plus petit plan compatible à partir de `src/config/plans.ts`.
 *
 * Elle n'est JAMAIS montrée :
 * - sans session ou sans e-mail confirmé (le proxy s'en charge : la route
 *   n'est pas publique) ;
 * - à un administrateur (ce n'est pas un client Nireo) ;
 * - à un compte qui a déjà un abonnement actif ou un accès à vie ;
 * - à un compte qui a déjà franchi l'étape, entamé ou terminé le guide ;
 * - à un compte qui a déjà des logements (son espace est lancé).
 *
 * Aucune colonne ni migration n'a été ajoutée pour cela : le franchissement
 * est mémorisé par la route d'onboarding existante (`onboarding_started_at`).
 * Le pire cas d'une écriture manquée est de revoir l'étape une fois — jamais
 * un compte bloqué, jamais un paiement déclenché.
 */

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  // Mode démo (sans Supabase) : il n'y a ni compte ni abonnement à configurer.
  if (!isSupabaseConfigured) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?next=/bienvenue");

  if (isAdminConfigured && (await isUserAdmin(user.id))) redirect("/admin");

  // Abonnement réel : un plan payant actif (ou l'accès à vie Fondateur) rend
  // l'étape sans objet. Une lecture en échec ne bloque pas : on montre l'étape,
  // qui ne peut de toute façon rien déclencher sans action explicite.
  let hasPaidPlan = false;
  try {
    hasPaidPlan = resolvePlan(await getUserSubscription(supabase, user.id)).id !== "free";
  } catch (e) {
    logger.error("bienvenue/abonnement", e);
  }
  if (hasPaidPlan) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, onboarding_started_at, onboarding_completed, onboarding_skipped")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profile?.onboarding_started_at ||
    profile?.onboarding_completed ||
    profile?.onboarding_skipped
  ) {
    redirect("/");
  }

  // Un espace déjà rempli n'a plus rien à configurer.
  const { count } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);
  if ((count ?? 0) > 0) redirect("/");

  const fullName =
    (profile?.full_name as string | null) ??
    ((user.user_metadata?.full_name as string | undefined) || "");

  return (
    <main id="contenu" tabIndex={-1} className="flex min-h-svh flex-col bg-muted/40">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        <div className="mb-8 flex justify-center">
          <NireoLogo href="/" />
        </div>

        <div className="rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8">
          <PlanRecommendation
            firstName={fullName.split(" ")[0] ?? ""}
            stripeEnabled={isStripeConfigured}
          />
        </div>
      </div>
    </main>
  );
}
