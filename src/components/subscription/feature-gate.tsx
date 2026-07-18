"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { FeatureId } from "@/config/plans";
import { hasFeature } from "@/lib/stripe/entitlements";
import { useAppStore } from "@/lib/store";

/**
 * Verrou d'affichage par fonctionnalité de plan.
 * Affichage uniquement : la contrainte dure reste côté serveur
 * (routes API, triggers, RLS) — ce composant informe et guide vers
 * la page Abonnement au lieu de montrer une fonction inutilisable.
 */
export function FeatureGate({
  feature,
  title,
  children,
}: {
  feature: FeatureId;
  /** Nom lisible de la fonction verrouillée (affiché dans le message). */
  title: string;
  children: React.ReactNode;
}) {
  const { profile, isLive } = useAppStore();
  // Mode démo (Supabase non configuré) : tout est visible.
  const check = isLive ? hasFeature(profile?.plan, feature) : { allowed: true, reason: null };
  if (check.allowed) return <>{children}</>;

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Lock className="size-4" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="mx-auto max-w-md text-xs leading-relaxed text-muted-foreground">
            {check.reason}
          </p>
        </div>
        <Link href="/abonnement" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Voir les plans
        </Link>
      </CardContent>
    </Card>
  );
}
