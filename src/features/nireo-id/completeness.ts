/**
 * Nireo ID — niveau de COMPLÉTUDE d'un téléphone.
 *
 * Ce n'est PAS un score de fiabilité : il mesure uniquement ce qui a été
 * renseigné dans le dossier. Les règles sont fixes, publiques et affichées
 * telles quelles à l'utilisateur — aucun calcul opaque.
 */

export interface CompletenessInput {
  hasPhoto: boolean;
  hasPurchaseDate: boolean;
  hasPurchaseProof: boolean;
  hasIdentifier: boolean;
  hasDeclaredCondition: boolean;
  hasProfessionalEvent: boolean;
}

export interface CompletenessRule {
  key: keyof CompletenessInput;
  label: string;
  points: number;
  done: boolean;
}

const RULES: { key: keyof CompletenessInput; label: string; points: number }[] = [
  { key: "hasPhoto", label: "Photo principale du smartphone", points: 20 },
  { key: "hasIdentifier", label: "Numéro de série ou IMEI enregistré", points: 20 },
  { key: "hasPurchaseDate", label: "Date d'achat renseignée", points: 15 },
  { key: "hasPurchaseProof", label: "Preuve d'achat ajoutée", points: 20 },
  { key: "hasDeclaredCondition", label: "État déclaré du smartphone", points: 15 },
  { key: "hasProfessionalEvent", label: "Au moins une intervention professionnelle", points: 10 },
];

export interface Completeness {
  percent: number;
  rules: CompletenessRule[];
}

export function computeCompleteness(input: CompletenessInput): Completeness {
  const rules = RULES.map((rule) => ({ ...rule, done: input[rule.key] }));
  const percent = rules.reduce((total, rule) => total + (rule.done ? rule.points : 0), 0);
  return { percent, rules };
}
