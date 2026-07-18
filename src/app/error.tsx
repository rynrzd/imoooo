"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

/**
 * Error boundary globale. Message français simple pour l'utilisateur ;
 * le détail technique part dans les logs (jamais affiché).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    logger.error("app/error-boundary", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
        Erreur
      </p>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Une erreur inattendue est survenue
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Vos données n&apos;ont pas été perdues. Réessayez ; si le problème
        persiste, reconnectez-vous.
      </p>
      <Button onClick={reset} className="mt-2">
        Réessayer
      </Button>
    </div>
  );
}
