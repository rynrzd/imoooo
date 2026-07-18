"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore } from "@/lib/store";

/** Affiche le chargement / l'erreur globale avant de rendre les pages. */
export function AppDataBoundary({ children }: { children: React.ReactNode }) {
  const { loading, error, refresh } = useAppStore();

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Chargement des données">
        <div className="space-y-2">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card px-6 py-14 text-center">
        <span className="flex size-10 items-center justify-center rounded-lg bg-red-500/10 text-red-700">
          <AlertCircle className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Impossible de charger vos données
          </p>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{error}</p>
        </div>
        <Button variant="outline" onClick={() => void refresh()}>
          <RefreshCw data-icon="inline-start" />
          Réessayer
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
