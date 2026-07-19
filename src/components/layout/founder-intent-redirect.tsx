"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { consumeFounderIntent } from "@/lib/founder-intent";

/**
 * Reprise du tunnel Fondateur : si le compte a été créé depuis /fondateur,
 * la première ouverture de l'application (après confirmation de l'e-mail)
 * renvoie automatiquement vers le paiement — l'utilisateur n'a jamais à
 * rechercher l'offre. L'intention est consommée : une seule reprise.
 */
export function FounderIntentRedirect() {
  const router = useRouter();
  React.useEffect(() => {
    if (consumeFounderIntent()) router.replace("/fondateur");
  }, [router]);
  return null;
}
