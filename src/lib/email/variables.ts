/**
 * Variables des e-mails rédigés depuis l'administration.
 *
 * Ce fichier ne contient AUCUN code serveur : il est importé à la fois par
 * l'éditeur (client, pour l'aperçu) et par l'action d'envoi (serveur, pour le
 * rendu réel). Une seule implémentation du remplacement = l'aperçu montre
 * exactement ce qui partira.
 *
 * Le remplacement se fait sur du TEXTE BRUT. L'échappement HTML a lieu
 * ensuite, dans `customEmail()` : un destinataire dont le nom contiendrait
 * « <b> » ne peut donc rien injecter dans l'e-mail.
 */

export interface EmailVariable {
  /** Jeton tel qu'il s'écrit dans le sujet ou le corps. */
  token: string;
  label: string;
  /** Ce qui s'affichera si la donnée est absente. */
  fallback: string;
}

export const EMAIL_VARIABLES: EmailVariable[] = [
  { token: "{{prenom}}", label: "Prénom", fallback: "" },
  { token: "{{nom_complet}}", label: "Nom complet", fallback: "" },
  { token: "{{email}}", label: "Adresse e-mail", fallback: "" },
  { token: "{{offre}}", label: "Offre en cours", fallback: "" },
];

export interface EmailVariableValues {
  prenom: string;
  nom_complet: string;
  email: string;
  offre: string;
}

/**
 * Valeurs pour un destinataire. Le prénom est le premier mot du nom complet
 * — s'il est vide, la formule « Bonjour {{prenom}} » donnerait « Bonjour , »,
 * donc on retombe sur un mot neutre plutôt que sur un blanc.
 */
export function variableValues(recipient: {
  full_name?: string | null;
  email?: string | null;
  plan_label?: string | null;
}): EmailVariableValues {
  const fullName = (recipient.full_name ?? "").trim();
  const first = fullName.split(/\s+/)[0] ?? "";
  return {
    prenom: first || "bonjour",
    nom_complet: fullName || (recipient.email ?? ""),
    email: (recipient.email ?? "").trim(),
    offre: (recipient.plan_label ?? "").trim(),
  };
}

/**
 * Remplace les jetons connus. Un jeton inconnu est laissé TEL QUEL : mieux
 * vaut qu'un « {{prnom}} » mal orthographié saute aux yeux dans l'aperçu
 * qu'il ne disparaisse silencieusement de l'e-mail envoyé.
 */
export function fillVariables(text: string, values: EmailVariableValues): string {
  return text
    .replace(/\{\{\s*prenom\s*\}\}/g, values.prenom)
    .replace(/\{\{\s*nom_complet\s*\}\}/g, values.nom_complet)
    .replace(/\{\{\s*email\s*\}\}/g, values.email)
    .replace(/\{\{\s*offre\s*\}\}/g, values.offre);
}

/** Jetons présents dans un texte mais qui ne correspondent à rien de connu. */
export function unknownVariables(text: string): string[] {
  const known = new Set(EMAIL_VARIABLES.map((v) => v.token.replace(/[{}\s]/g, "")));
  const found = new Set<string>();
  for (const match of text.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) {
    const name = match[1]!;
    if (!known.has(name)) found.add(name);
  }
  return [...found];
}
