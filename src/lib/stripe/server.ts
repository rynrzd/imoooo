import Stripe from "stripe";
import { getStripeSecretKey } from "./config";

/**
 * Client Stripe côté serveur — instancié paresseusement, une seule fois.
 * À n'importer que depuis des routes API / code serveur : la clé secrète
 * ne doit jamais atteindre le bundle navigateur.
 */

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (typeof window !== "undefined") {
    throw new Error("Le client Stripe serveur ne doit jamais être utilisé côté navigateur.");
  }
  if (!stripe) {
    stripe = new Stripe(getStripeSecretKey(), {
      appInfo: { name: "Nireo", version: "0.1.0" },
    });
  }
  return stripe;
}
