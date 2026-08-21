"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

/**
 * Filet des erreurs que les error boundaries ne voient PAS.
 *
 * `error.tsx` n'attrape que ce qui casse pendant le rendu React. Restaient
 * invisibles : les exceptions déclenchées par un gestionnaire d'événement
 * (un `onClick` qui lève), les promesses rejetées sans `catch`, et les
 * erreurs de chargement de fragment JavaScript après un déploiement. Ce
 * sont précisément les pannes qu'un utilisateur subit sans jamais les
 * signaler — la page « a l'air » normale, seul le bouton ne répond plus.
 *
 * Le composant ne rend rien et n'ajoute aucune requête tant qu'aucune erreur
 * ne survient. Sans `MONITORING_WEBHOOK_URL`, le relais serveur répond 204
 * sans rien conserver : le coût est alors nul.
 */
export function ErrorReporter() {
  useEffect(() => {
    // Une même erreur peut se répéter à chaque image d'animation : sans
    // ce garde-fou, une boucle de rendu enverrait des milliers de rapports.
    const seen = new Set<string>();
    const MAX_DISTINCT = 10;

    const send = (scope: string, error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      const key = `${scope}:${message}`;
      if (seen.has(key) || seen.size >= MAX_DISTINCT) return;
      seen.add(key);
      logger.error(scope, error);
    };

    const onError = (event: ErrorEvent) => {
      // `event.error` porte la pile ; `message` seul quand le script est
      // servi par une autre origine (« Script error. » — inexploitable,
      // mais sa fréquence reste un signal).
      send("browser/uncaught", event.error ?? event.message);
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      send("browser/unhandled-rejection", event.reason);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
