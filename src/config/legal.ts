/**
 * Identité légale de l'éditeur — SOURCE DE VÉRITÉ UNIQUE.
 *
 * Les mentions légales, les CGU, la politique de confidentialité et le pied
 * de page doivent annoncer EXACTEMENT la même identité. Les tenir à jour
 * dans quatre fichiers séparés, c'est se garantir qu'un jour l'un des quatre
 * mentira. Tout part donc d'ici.
 *
 * RÈGLE DE CE FICHIER : on n'y écrit que des informations FOURNIES ou
 * VÉRIFIÉES. Rien n'est déduit, rien n'est complété « logiquement ».
 * Une information manquante vaut `null` et se voit à l'écran comme
 * manquante — un numéro plausible mais faux dans des mentions légales est
 * pire que pas de numéro : il trompe le client tout en donnant l'illusion
 * de la conformité.
 *
 * ⚠ Le SIRET ne se fabrique JAMAIS à partir du SIREN (SIREN + 5 chiffres de
 * l'établissement, que nous n'avons pas). `siret: null` tant qu'il n'est pas
 * communiqué.
 */

export interface LegalIdentity {
  /** Personne physique exploitant en nom propre. */
  operatorName: string;
  /** Forme juridique, en clair. */
  legalForm: string;
  /** Nom commercial du service. */
  tradeName: string;
  /** Rue et numéro tels que communiqués. */
  addressLine: string;
  /** Code postal + ville — `null` tant qu'ils ne sont pas confirmés. */
  addressCityLine: string | null;
  country: string;
  email: string;
  phone: string;
  /** SIREN officiel (9 chiffres). */
  siren: string;
  /** SIRET (14 chiffres) — `null` tant qu'il n'est pas communiqué. */
  siret: string | null;
  /** TVA intracommunautaire — `null` : régime non confirmé. */
  vatNumber: string | null;
  /** Régime de TVA — `null` : à confirmer, jamais supposé. */
  vatRegime: string | null;
  directorOfPublication: string;
}

export const LEGAL_IDENTITY: LegalIdentity = {
  operatorName: "Nouh Tifouti",
  legalForm: "Entrepreneur individuel (micro-entreprise)",
  tradeName: "Nireo",
  addressLine: "1 avenue d'Alsace",
  addressCityLine: null,
  country: "France",
  email: "nireo.contacte@gmail.com",
  phone: "07 81 69 74 77",
  siren: "979 992 443",
  siret: null,
  vatNumber: null,
  vatRegime: null,
  directorOfPublication: "Nouh Tifouti",
};

/**
 * Hébergeurs — coordonnées RECOPIÉES depuis leurs documents officiels
 * (vérifiées le 20/08/2026 sur vercel.com/legal/privacy-policy et
 * vercel.com/legal/terms), jamais reconstituées de mémoire.
 *
 * Vercel ne publie aucun numéro de téléphone : `phone: null` le dit, plutôt
 * que d'inventer une ligne. Supabase ne publie pas d'adresse postale.
 */
export interface HostingProvider {
  name: string;
  addressLines: string[];
  phone: string | null;
  contact: string;
  role: string;
}

/**
 * Région d'hébergement du projet Supabase — `null` tant qu'elle n'est pas
 * relevée dans la console (Settings → General → Region).
 *
 * Elle est citée à DEUX endroits (mentions légales et confidentialité) parce
 * qu'elle répond à deux questions différentes : où sont les serveurs, et si
 * un transfert hors Union européenne a lieu. Elle vit donc ici, et non
 * recopiée dans chaque page — sinon le jour où elle sera renseignée, on
 * risquerait d'en corriger une et d'oublier l'autre, laissant un « à
 * compléter » en ligne.
 */
export const SUPABASE_REGION: string | null = null;

/** Phrase sur la région d'hébergement, ou l'emplacement à compléter. */
export function hostingRegionSentence(): string {
  return SUPABASE_REGION
    ? `La base de données et les fichiers sont hébergés dans la région ${SUPABASE_REGION}.`
    : MISSING(
        "région d'hébergement du projet Supabase, à relever dans la console (Settings → General → Region) — elle conditionne l'exactitude de la mention « hébergement en Europe » affichée sur les pages publiques, et détermine si un transfert hors Union européenne doit être encadré"
      );
}

export const HOSTING_PROVIDERS: HostingProvider[] = [
  {
    name: "Vercel Inc.",
    addressLines: ["440 N Barranca Avenue #4133", "Covina, CA 91723", "États-Unis"],
    phone: null,
    contact: "https://vercel.com",
    role: "Hébergement du site et de l'application",
  },
  {
    name: "Supabase, Inc.",
    addressLines: [],
    phone: null,
    contact: "https://supabase.com",
    role: "Hébergement de la base de données et des fichiers",
  },
];

/** Marqueur visible et uniforme pour une information non encore fournie. */
export const MISSING = (what: string): string => `[À COMPLÉTER : ${what}]`;

/** Adresse postale sur une ligne, avec la partie manquante signalée. */
export function formattedAddress(): string {
  const city = LEGAL_IDENTITY.addressCityLine ?? MISSING("code postal et ville");
  return `${LEGAL_IDENTITY.addressLine}, ${city}, ${LEGAL_IDENTITY.country}`;
}

/** Identification de l'entreprise : SIREN certain, SIRET seulement s'il existe. */
export function companyNumbers(): string {
  const siret = LEGAL_IDENTITY.siret
    ? `SIRET : ${LEGAL_IDENTITY.siret}`
    : MISSING("SIRET (14 chiffres) — à renseigner dès réception ; il ne peut pas être déduit du SIREN");
  return `SIREN : ${LEGAL_IDENTITY.siren} — ${siret}`;
}
