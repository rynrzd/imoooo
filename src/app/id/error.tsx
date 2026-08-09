"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

/**
 * Frontière d'erreur du produit Nireo ID.
 * Le détail technique n'est jamais montré à l'utilisateur : il part dans le
 * journal serveur, l'écran propose une action concrète.
 */
export default function NireoIdError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    logger.error("nireo-id/boundary", error);
  }, [error]);

  return (
    <div className="flex min-h-svh items-center justify-center px-4 py-16">
      <div className="nid-panel w-full max-w-md rounded-lg p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-lg bg-muted text-[var(--nid-warning)]">
          <AlertTriangle className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-foreground">
          Cette page n’a pas pu s’afficher
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Une erreur est survenue pendant le chargement. Vos données ne sont
          pas affectées : rien n’est modifié tant qu’une action n’a pas été
          confirmée.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button data-touch onClick={reset}>
            Réessayer
          </Button>
          <Button variant="outline" data-touch render={<Link href="/id/app" />}>
            Revenir à mes objets
          </Button>
        </div>
      </div>
    </div>
  );
}
