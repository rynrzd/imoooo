import { CreditCard, Download, Lock, Server, Sparkle } from "lucide-react";
import { getPlan } from "@/config/plans";

/**
 * Bande de confiance — cinq engagements, et RIEN qui dépasse ce que le
 * produit tient réellement. Chaque ligne est vérifiable dans le projet :
 *
 * - plan gratuit sans limite de durée, sans carte bancaire → src/config/plans.ts
 *   et FAQ « Comment fonctionne l'essai ? ». Nireo n'a AUCUN essai limité dans
 *   le temps : écrire « essai gratuit » serait faux, on nomme donc le plan ;
 * - exports JSON et CSV À PARTIR DU PLAN STARTER → FAQ « Puis-je exporter mes
 *   données ? ». La restriction de plan fait partie de l'engagement : elle est
 *   écrite, jamais sous-entendue ;
 * - hébergement européen et isolation par compte → FAQ « Mes données sont-
 *   elles sécurisées ? ».
 *
 * Aucun chiffre client, aucun logo d'entreprise, aucune note : Nireo n'en a
 * pas de vérifiable.
 */

const FREE_PLAN = getPlan("free");
const STARTER_PLAN = getPlan("starter");

const COMMITMENTS = [
  {
    icon: Sparkle,
    label: "Plan gratuit, sans limite de durée",
    detail: `${FREE_PLAN.limits.maxProperties} logement inclus`,
  },
  { icon: CreditCard, label: "Sans carte bancaire", detail: "Aucun moyen de paiement demandé" },
  { icon: Server, label: "Hébergement en Europe", detail: "Infrastructure et fichiers" },
  { icon: Lock, label: "Données isolées", detail: "Un compte ne voit jamais un autre" },
  {
    icon: Download,
    label: "Données exportables",
    detail: `JSON et CSV à partir du plan ${STARTER_PLAN.name}`,
  },
];

export function TrustStrip() {
  return (
    <div className="border-y border-border bg-[color-mix(in_srgb,var(--land-paper)_60%,var(--land-ivory))]">
      {/* Une seule bande : liste divisée jusqu'à la tablette, cinq colonnes
          séparées par un filet à partir de « lg » (en dessous, les libellés
          seraient serrés sur trois lignes). Jamais une carte par engagement. */}
      <ul className="mx-auto flex w-full max-w-[76rem] flex-col divide-y divide-border px-4 sm:px-6 lg:flex-row lg:divide-y-0">
        {COMMITMENTS.map((item) => (
          <li
            key={item.label}
            className="flex items-start gap-2.5 py-3.5 lg:flex-1 lg:border-l lg:border-border lg:px-5 lg:py-5 lg:first:border-l-0 lg:first:pl-0 lg:last:pr-0"
          >
            <item.icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0">
              <span className="block text-[0.82rem] leading-snug font-medium text-foreground">
                {item.label}
              </span>
              <span className="mt-0.5 block text-[0.72rem] leading-snug text-muted-foreground">
                {item.detail}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
