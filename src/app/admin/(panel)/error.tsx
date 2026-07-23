"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

/**
 * Error boundary de l'espace d'administration. Le détail technique part
 * dans les logs serveur/console (digest) — jamais affiché : aucun message
 * d'erreur brut, aucune requête, aucune clé.
 */
export default function AdminPanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    logger.error("admin/error-boundary", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-5 text-destructive" />
      </span>
      <h1 className="text-lg font-semibold tracking-tight">
        Service temporairement indisponible
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Cette page d&apos;administration n&apos;a pas pu être chargée. L&apos;erreur a été
        journalisée côté serveur{error.digest ? ` (référence ${error.digest})` : ""}.
      </p>
      <Button onClick={reset} variant="outline" size="sm" className="mt-1">
        Réessayer
      </Button>
    </div>
  );
}
