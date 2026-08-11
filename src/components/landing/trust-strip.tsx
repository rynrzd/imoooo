import { getPlan } from "@/config/plans";

/**
 * Petite ligne de confiance — quatre engagements, une seule ligne, aucune
 * carte, aucun encadré, aucune icône décorative.
 *
 * Chaque point est vérifiable dans le projet :
 * - plan gratuit sans limite de durée → `src/config/plans.ts` (le plan Gratuit
 *   n'a aucune date de fin). Nireo n'a AUCUN essai limité dans le temps :
 *   écrire « essai gratuit » serait faux, on nomme donc le plan ;
 * - sans carte bancaire → aucun moyen de paiement n'est demandé à l'inscription ;
 * - données privées → RLS par compte + stockage privé à liens signés ;
 * - données exportables selon le plan → la fonctionnalité `simple_exports`
 *   démarre au plan Starter ; la restriction est écrite, jamais sous-entendue.
 */

const STARTER = getPlan("starter");

const POINTS = [
  "Plan gratuit sans limite de durée",
  "Sans carte bancaire",
  "Données privées, isolées par compte",
  `Données exportables selon le plan (JSON et CSV dès ${STARTER.name})`,
];

export function TrustStrip() {
  return (
    <ul className="mx-auto flex w-full max-w-[76rem] flex-wrap items-center gap-x-6 gap-y-2 px-5 text-[0.85rem] text-muted-foreground sm:px-6">
      {POINTS.map((point) => (
        <li key={point} className="flex items-center gap-2">
          <span aria-hidden className="h-px w-4 shrink-0 bg-[var(--land-stone)]" />
          {point}
        </li>
      ))}
    </ul>
  );
}
