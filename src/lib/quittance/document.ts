/**
 * Générateur de quittance de loyer — LOGIQUE MÉTIER.
 *
 * Module pur : aucune dépendance à React, à jsPDF ou au navigateur. Il est la
 * SOURCE UNIQUE du document — l'aperçu HTML et le PDF consomment tous les deux
 * le même objet `QuittanceDocument`, ce qui rend impossible une divergence
 * entre ce que l'utilisateur voit et ce qu'il télécharge.
 *
 * Règle centrale : un paiement complet donne une QUITTANCE, un paiement
 * inférieur au total dû donne un REÇU DE PAIEMENT PARTIEL — jamais une
 * quittance. C'est ce que dit la loi du 6 juillet 1989 (article 21) : le
 * bailleur ne peut donner quittance que de ce qu'il a réellement reçu.
 *
 * Les montants sont manipulés en CENTIMES (entiers) : aucune addition en
 * virgule flottante, donc aucun « 1234,5700000000001 » possible.
 */

export const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
] as const;

/** Bornes raisonnables : au-delà, c'est une faute de frappe, pas une intention. */
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
/** 1 000 000 € par ligne : garde-fou contre un montant saisi sans virgule. */
const MAX_CENTS = 100_000_000;

/* ------------------------------------------------------------------ */
/*  Montants                                                           */
/* ------------------------------------------------------------------ */

/**
 * Lit un montant saisi à la française OU à l'anglaise : « 1 234,56 »,
 * « 1234.56 », « 1234 ». Les espaces (y compris insécables et fines) et le
 * symbole € sont ignorés. Retourne des centimes, ou `null` si ce n'est pas
 * un nombre exploitable.
 */
export function parseAmount(raw: string): number | null {
  const cleaned = raw
    .replace(/[\s\u00A0\u202F\u2009]/g, "")
    .replace(/€/g, "")
    .replace(",", ".")
    .trim();
  if (cleaned === "") return null;
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  // Arrondi au centime le plus proche, en évitant le piège du binaire
  // (2.675 * 100 = 267.49999… en IEEE 754).
  return Math.round((value + Number.EPSILON) * 100);
}

/**
 * « 1 234,56 € » — séparateur de milliers en espace INSÉCABLE (U+00A0) et
 * non en espace fine insécable (U+202F) : U+00A0 existe dans WinAnsiEncoding,
 * l'encodage des polices standard du PDF. U+202F, lui, ne s'y trouve pas et
 * casserait le rendu du document.
 */
export function formatEuros(cents: number): string {
  const negative = cents < 0;
  const absolute = Math.abs(Math.round(cents));
  const units = Math.floor(absolute / 100);
  const decimals = String(absolute % 100).padStart(2, "0");
  const grouped = String(units).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${negative ? "-" : ""}${grouped},${decimals} €`;
}

/* ------------------------------------------------------------------ */
/*  Dates                                                              */
/* ------------------------------------------------------------------ */

/** Découpe une date « aaaa-mm-jj » en vérifiant qu'elle existe vraiment. */
function parseIsoDate(raw: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < MIN_YEAR || year > MAX_YEAR) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** « 1er mars 2026 » / « 12 mars 2026 » — sans dépendre de l'`Intl` du poste. */
export function formatFrenchDate(year: number, month: number, day: number): string {
  const dayLabel = day === 1 ? "1er" : String(day);
  return `${dayLabel} ${MONTHS[month - 1]} ${year}`;
}

/**
 * Date du jour au format « aaaa-mm-jj », dans le fuseau indiqué.
 *
 * Appelée CÔTÉ SERVEUR et transmise au formulaire en propriété : si le client
 * la recalculait lui-même, le HTML rendu par le serveur (UTC) et celui de
 * l'hydratation (fuseau du visiteur) différeraient autour de minuit.
 */
export function todayIso(timeZone = "Europe/Paris", now: Date = new Date()): string {
  // « fr-CA » produit nativement le format ISO aaaa-mm-jj.
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/* ------------------------------------------------------------------ */
/*  Formulaire                                                         */
/* ------------------------------------------------------------------ */

export interface QuittanceForm {
  landlordName: string;
  landlordAddress: string;
  tenantNames: string;
  propertyAddress: string;
  /** « 1 » à « 12 ». */
  month: string;
  year: string;
  /** Loyer hors charges, saisi librement. */
  rent: string;
  charges: string;
  paid: string;
  /** « aaaa-mm-jj ». */
  paymentDate: string;
  place: string;
  /** « aaaa-mm-jj ». */
  issueDate: string;
}

export type QuittanceField = keyof QuittanceForm;

export type QuittanceErrors = Partial<Record<QuittanceField, string>>;

/**
 * Formulaire vierge : période = mois en cours, dates = aujourd'hui.
 * `today` (« aaaa-mm-jj ») est fourni par l'appelant — jamais lu depuis
 * l'horloge ici, pour que serveur et client produisent le même formulaire.
 */
export function emptyForm(today: string): QuittanceForm {
  const [year, month] = today.split("-");
  return {
    landlordName: "",
    landlordAddress: "",
    tenantNames: "",
    propertyAddress: "",
    month: String(Number(month)),
    year,
    rent: "",
    charges: "",
    paid: "",
    paymentDate: today,
    place: "",
    issueDate: today,
  };
}

/* ------------------------------------------------------------------ */
/*  Document résolu                                                    */
/* ------------------------------------------------------------------ */

export type QuittanceKind = "quittance" | "recu_partiel";

export interface QuittanceDocument {
  kind: QuittanceKind;
  /** Titre du document, en capitales. */
  title: string;
  landlordName: string;
  landlordAddress: string;
  tenantNames: string;
  propertyAddress: string;
  /** « mars 2026 ». */
  periodLabel: string;
  /** « du 1er mars 2026 au 31 mars 2026 ». */
  periodRange: string;
  rentCents: number;
  chargesCents: number;
  totalCents: number;
  paidCents: number;
  /** Toujours ≥ 0 : nul pour une quittance. */
  remainingCents: number;
  /** « 12 mars 2026 ». */
  paymentDateLabel: string;
  place: string;
  issueDateLabel: string;
  /** Le corps du document, en une ou deux phrases. */
  statement: string[];
  /** Nom de fichier proposé au téléchargement (ASCII, sans espace). */
  fileName: string;
}

/** Total dû à partir des saisies, pour l'affichage en direct du formulaire. */
export function computeTotal(form: QuittanceForm): number | null {
  const rent = parseAmount(form.rent);
  const charges = form.charges.trim() === "" ? 0 : parseAmount(form.charges);
  if (rent === null || charges === null) return null;
  return rent + charges;
}

/** Slug ASCII sûr pour un nom de fichier (accents retirés, pas d'espace). */
function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function requireText(value: string, message: string): string | null {
  return value.trim().length === 0 ? message : null;
}

/**
 * Valide le formulaire et construit le document.
 *
 * Refus explicites : montant illisible, montant négatif, total nul, paiement
 * nul, et paiement SUPÉRIEUR au total dû (une quittance ne peut pas attester
 * plus que ce qui était dû pour la période — c'est une incohérence, pas une
 * avance à documenter ici).
 */
export function buildDocument(
  form: QuittanceForm
): { ok: true; document: QuittanceDocument } | { ok: false; errors: QuittanceErrors } {
  const errors: QuittanceErrors = {};

  const landlordName = form.landlordName.trim();
  const landlordAddress = form.landlordAddress.trim();
  const tenantNames = form.tenantNames.trim();
  const propertyAddress = form.propertyAddress.trim();
  const place = form.place.trim();

  errors.landlordName = requireText(landlordName, "Indiquez le nom ou la raison sociale du bailleur.") ?? undefined;
  errors.landlordAddress = requireText(landlordAddress, "Indiquez l’adresse du bailleur.") ?? undefined;
  errors.tenantNames = requireText(tenantNames, "Indiquez le nom du ou des locataires.") ?? undefined;
  errors.propertyAddress = requireText(propertyAddress, "Indiquez l’adresse complète du logement.") ?? undefined;
  errors.place = requireText(place, "Indiquez le lieu d’établissement du document.") ?? undefined;

  // --- Période -----------------------------------------------------
  const month = Number(form.month);
  const year = Number(form.year);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    errors.month = "Choisissez un mois.";
  }
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    errors.year = `Indiquez une année entre ${MIN_YEAR} et ${MAX_YEAR}.`;
  }

  // --- Montants ----------------------------------------------------
  const rentCents = parseAmount(form.rent);
  const chargesCents = form.charges.trim() === "" ? 0 : parseAmount(form.charges);
  const paidCents = parseAmount(form.paid);

  if (rentCents === null) {
    errors.rent = "Indiquez le loyer hors charges, par exemple 750 ou 750,50.";
  } else if (rentCents < 0) {
    errors.rent = "Le loyer ne peut pas être négatif.";
  } else if (rentCents > MAX_CENTS) {
    errors.rent = "Ce montant paraît erroné. Vérifiez la virgule.";
  }

  if (chargesCents === null) {
    errors.charges = "Indiquez un montant, par exemple 60, ou laissez vide s’il n’y a pas de charges.";
  } else if (chargesCents < 0) {
    errors.charges = "Les charges ne peuvent pas être négatives.";
  } else if (chargesCents > MAX_CENTS) {
    errors.charges = "Ce montant paraît erroné. Vérifiez la virgule.";
  }

  if (paidCents === null) {
    errors.paid = "Indiquez le montant réellement payé.";
  } else if (paidCents < 0) {
    errors.paid = "Le montant payé ne peut pas être négatif.";
  } else if (paidCents === 0) {
    errors.paid = "Sans paiement reçu, aucun document ne peut être établi.";
  } else if (paidCents > MAX_CENTS) {
    errors.paid = "Ce montant paraît erroné. Vérifiez la virgule.";
  }

  const totalCents =
    rentCents !== null && chargesCents !== null && rentCents >= 0 && chargesCents >= 0
      ? rentCents + chargesCents
      : null;

  if (totalCents !== null && totalCents === 0 && !errors.rent) {
    errors.rent = "Le total dû est nul : il n’y a rien à quittancer.";
  }
  if (totalCents !== null && paidCents !== null && paidCents > totalCents && !errors.paid) {
    errors.paid = `Le montant payé dépasse le total dû (${formatEuros(totalCents)}). Corrigez le loyer, les charges ou le paiement.`;
  }

  // --- Dates -------------------------------------------------------
  const paymentDate = parseIsoDate(form.paymentDate);
  if (!paymentDate) errors.paymentDate = "Indiquez une date de paiement valide.";
  const issueDate = parseIsoDate(form.issueDate);
  if (!issueDate) errors.issueDate = "Indiquez une date d’établissement valide.";

  // `requireText` renvoie `undefined` quand tout va bien : on retire les clés
  // vides pour que `Object.keys` reflète les vraies erreurs.
  for (const key of Object.keys(errors) as QuittanceField[]) {
    if (errors[key] === undefined) delete errors[key];
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  // À ce stade, toutes les valeurs sont validées.
  const rent = rentCents!;
  const charges = chargesCents!;
  const paid = paidCents!;
  const total = rent + charges;
  const remaining = total - paid;
  const kind: QuittanceKind = remaining === 0 ? "quittance" : "recu_partiel";

  const periodLabel = `${MONTHS[month - 1]} ${year}`;
  const periodRange = `du ${formatFrenchDate(year, month, 1)} au ${formatFrenchDate(
    year,
    month,
    daysInMonth(year, month)
  )}`;
  const paymentDateLabel = formatFrenchDate(paymentDate!.year, paymentDate!.month, paymentDate!.day);
  const issueDateLabel = formatFrenchDate(issueDate!.year, issueDate!.month, issueDate!.day);

  const statement =
    kind === "quittance"
      ? [
          `Je soussigné(e) ${landlordName}, bailleur du logement désigné ci-dessus, déclare avoir reçu de ${tenantNames} la somme de ${formatEuros(
            total
          )} au titre du loyer et des charges pour la période ${periodRange}, et lui en donne quittance sous réserve de tous mes droits.`,
          "La présente quittance annule tous les reçus qui auraient pu être établis auparavant pour la même période.",
        ]
      : [
          `Je soussigné(e) ${landlordName}, bailleur du logement désigné ci-dessus, déclare avoir reçu de ${tenantNames} la somme de ${formatEuros(
            paid
          )} à valoir sur le loyer et les charges de la période ${periodRange}.`,
          `Ce document est un reçu : il ne vaut pas quittance de loyer. Le solde restant dû pour cette période s’élève à ${formatEuros(
            remaining
          )}.`,
        ];

  const prefix = kind === "quittance" ? "quittance-loyer" : "recu-paiement-partiel";
  const tenantSlug = slugify(tenantNames);
  const fileName = [prefix, `${year}-${String(month).padStart(2, "0")}`, tenantSlug]
    .filter(Boolean)
    .join("-");

  return {
    ok: true,
    document: {
      kind,
      title: kind === "quittance" ? "QUITTANCE DE LOYER" : "REÇU DE PAIEMENT PARTIEL",
      landlordName,
      landlordAddress,
      tenantNames,
      propertyAddress,
      periodLabel,
      periodRange,
      rentCents: rent,
      chargesCents: charges,
      totalCents: total,
      paidCents: paid,
      remainingCents: remaining,
      paymentDateLabel,
      place,
      issueDateLabel,
      statement,
      fileName: `${fileName}.pdf`,
    },
  };
}
