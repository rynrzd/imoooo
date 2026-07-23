import type { Metadata } from "next";
import { FounderSignup } from "@/components/marketing/founder-signup";
import { isStripeConfigured } from "@/lib/stripe/config";

export const metadata: Metadata = {
  title: "Devenir Fondateur",
  description:
    "Rejoignez les 100 premiers utilisateurs de Nireo : accès Business+ à vie, paiement unique, place numérotée.",
  alternates: { canonical: "/fondateur" },
};

/**
 * Tunnel Fondateur — page dédiée :
 * - visiteur : création de compte Fondateur (l'intention est conservée, le
 *   paiement démarre automatiquement après confirmation de l'e-mail) ;
 * - connecté : redirection immédiate vers le Stripe Checkout Fondateur.
 */
export default function FounderPage() {
  return <FounderSignup stripeEnabled={isStripeConfigured} />;
}
