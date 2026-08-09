/**
 * Téléphone de DÉMONSTRATION — contenu d'illustration, jamais des données
 * réelles et jamais présenté comme telles.
 *
 * Il sert à deux endroits, toujours accompagné d'une mention « Exemple » :
 *  • la composition du hero de la vitrine ;
 *  • la page publique /id/exemple (bouton « Voir un exemple »).
 *
 * Aucune écriture en base, aucun identifiant réel : `NIR-PH-EXEM-PLE0`
 * n'est pas générable par le produit (l'alphabet exclut le 0 et le L).
 */

import type { EventType, TrustLevel } from "./constants";

export interface ExampleEvent {
  type: EventType;
  date: string;
  title: string;
  description: string;
  author: string;
  trust_level: TrustLevel;
}

export const EXAMPLE_PASSPORT = {
  public_id: "NIR-PH-EXEM-PLE0",
  brand: "Marque",
  model: "Modèle 13",
  color: "Bleu nuit",
  storage_capacity: "128 Go",
  purchase_year: 2023,
  purchase_condition: "neuf" as const,
  events_total: 3,
  events_professional: 1,
  owners: 2,
};

export const EXAMPLE_EVENTS: ExampleEvent[] = [
  {
    type: "reparation",
    date: "2026-03-18",
    title: "Remplacement de l'écran",
    description:
      "Écran d'origine remplacé, test tactile et luminosité conformes. Garantie d'intervention : 12 mois.",
    author: "Atelier partenaire (exemple)",
    trust_level: 2,
  },
  {
    type: "garantie",
    date: "2025-11-02",
    title: "Extension de garantie",
    description: "Contrat d'extension ajouté au dossier, document joint.",
    author: "Propriétaire",
    trust_level: 1,
  },
  {
    type: "achat",
    date: "2023-09-24",
    title: "Achat déclaré",
    description: "Acheté neuf en boutique, facture conservée dans le dossier privé.",
    author: "Propriétaire",
    trust_level: 0,
  },
];
