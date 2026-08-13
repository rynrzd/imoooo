"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { FeatureId } from "@/config/plans";
import { hasFeature } from "@/lib/stripe/entitlements";
import { useAppStore } from "@/lib/store";

/**
 * VERROU DE FONCTIONNALITÉ — une ligne, plus un écran entier.
 *
 * Avant, une fonction non incluse dans le plan remplaçait tout le contenu par
 * une grande carte pointillée avec un cadenas : l'utilisateur payant pour
 * Starter voyait la moitié de sa page Statistiques occupée par une publicité.
 *
 * Ici, la fonction verrouillée devient une ligne discrète qui dit le BÉNÉFICE
 * réel (pas « Statistiques avancées » mais ce qu'elles apportent) et propose
 * « Découvrir Pro ». Le reste de la page continue de vivre.
 *
 * Affichage uniquement : la contrainte dure reste côté serveur (routes API,
 * triggers, RLS).
 */
export function FeatureGate({
  feature,
  benefit,
  children,
}: {
  feature: FeatureId;
  /** Ce que la fonction apporte, en une phrase concrète. */
  benefit: string;
  children: React.ReactNode;
}) {
  const { profile, isLive } = useAppStore();
  // Mode démo (Supabase non configuré) : tout est visible.
  const check = isLive
    ? hasFeature(profile?.plan, feature)
    : { allowed: true, reason: null };
  if (check.allowed) return <>{children}</>;

  return <UpgradeLine benefit={benefit} />;
}

/** La ligne seule, réutilisable là où il n'y a rien à envelopper. */
export function UpgradeLine({ benefit }: { benefit: string }) {
  return (
    <Link
      href="/abonnement"
      className="flex min-h-12 items-center justify-between gap-4 rounded-[0.625rem] bg-primary-soft px-3.5 py-2.5 transition-opacity duration-200 hover:opacity-90"
    >
      <span className="min-w-0 text-sm text-foreground">{benefit}</span>
      <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
        Découvrir Pro
        <ArrowRight className="size-4" aria-hidden />
      </span>
    </Link>
  );
}
