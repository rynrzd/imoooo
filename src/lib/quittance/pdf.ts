import type { QuittanceDocument } from "./document";
import { formatEuros } from "./document";

/**
 * Rendu PDF de la quittance — 100 % NAVIGATEUR.
 *
 * Aucune donnée ne quitte le poste de l'utilisateur : pas d'appel réseau, pas
 * d'écriture en base, aucun envoi à Supabase. Le fichier est construit en
 * mémoire puis remis directement au navigateur.
 *
 * jsPDF est chargé en import dynamique : la bibliothèque n'est téléchargée
 * qu'au moment où l'utilisateur demande son document, jamais à l'affichage de
 * la page.
 *
 * Encodage : les polices standard du PDF utilisent WinAnsiEncoding, qui
 * couvre tous les accents français ainsi que le signe € (jsPDF transpose
 * U+20AC vers 0x80). C'est pourquoi `formatEuros` sépare les milliers par une
 * espace insécable U+00A0 — présente dans WinAnsi — et non par l'espace fine
 * U+202F, qui en est absente.
 */

/* ---- Géométrie de la page (millimètres) --------------------------- */

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 18;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const RIGHT = PAGE_WIDTH - MARGIN;

/* ---- Encres ------------------------------------------------------- */

const INK = [24, 24, 27] as const;
const MUTED = [110, 114, 124] as const;
const RULE = [214, 216, 222] as const;
const BOX = [246, 247, 249] as const;

export async function renderQuittancePdf(doc: QuittanceDocument): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  pdf.setProperties({
    title: doc.kind === "quittance" ? `Quittance de loyer — ${doc.periodLabel}` : `Reçu de paiement partiel — ${doc.periodLabel}`,
    subject: `Logement : ${doc.propertyAddress}`,
    author: doc.landlordName,
    creator: "Nireo",
  });

  const setInk = (color: readonly [number, number, number]) =>
    pdf.setTextColor(color[0], color[1], color[2]);

  /** Petite étiquette de rubrique, en capitales grises. */
  const label = (text: string, x: number, y: number) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    setInk(MUTED);
    pdf.text(text.toUpperCase(), x, y);
  };

  /** Bloc de lignes de texte ; renvoie l'ordonnée atteinte. */
  const block = (lines: string[], x: number, y: number, width: number, size = 10) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(size);
    setInk(INK);
    let cursor = y;
    for (const line of lines) {
      for (const wrapped of pdf.splitTextToSize(line, width) as string[]) {
        pdf.text(wrapped, x, cursor);
        cursor += size * 0.48;
      }
    }
    return cursor;
  };

  const rule = (y: number) => {
    pdf.setDrawColor(RULE[0], RULE[1], RULE[2]);
    pdf.setLineWidth(0.2);
    pdf.line(MARGIN, y, RIGHT, y);
  };

  /* ---- Titre ----------------------------------------------------- */

  let y = 30;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  setInk(INK);
  pdf.text(doc.title, PAGE_WIDTH / 2, y, { align: "center" });

  y += 7;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10.5);
  setInk(MUTED);
  pdf.text(`Période : ${doc.periodLabel}`, PAGE_WIDTH / 2, y, { align: "center" });

  y += 8;
  rule(y);

  /* ---- Bailleur / Locataire -------------------------------------- */

  y += 9;
  const columnWidth = (CONTENT_WIDTH - 10) / 2;
  const rightColumnX = MARGIN + columnWidth + 10;

  label("Bailleur", MARGIN, y);
  label("Locataire", rightColumnX, y);

  const afterLeft = block(
    [doc.landlordName, ...doc.landlordAddress.split("\n")],
    MARGIN,
    y + 5.5,
    columnWidth
  );
  const afterRight = block([doc.tenantNames], rightColumnX, y + 5.5, columnWidth);

  y = Math.max(afterLeft, afterRight) + 4;

  /* ---- Logement --------------------------------------------------- */

  label("Logement loué", MARGIN, y);
  y = block(doc.propertyAddress.split("\n"), MARGIN, y + 5.5, CONTENT_WIDTH) + 4;

  /* ---- Détail des montants ---------------------------------------- */

  const rows: { text: string; value: string; strong?: boolean }[] = [
    { text: "Loyer hors charges", value: formatEuros(doc.rentCents) },
    { text: "Provision pour charges", value: formatEuros(doc.chargesCents) },
    { text: "Total dû pour la période", value: formatEuros(doc.totalCents), strong: true },
    { text: "Montant réellement payé", value: formatEuros(doc.paidCents), strong: true },
  ];
  if (doc.remainingCents > 0) {
    rows.push({ text: "Solde restant dû", value: formatEuros(doc.remainingCents), strong: true });
  }

  const rowHeight = 7.6;
  const boxHeight = rowHeight * rows.length + 5;

  pdf.setFillColor(BOX[0], BOX[1], BOX[2]);
  pdf.setDrawColor(RULE[0], RULE[1], RULE[2]);
  pdf.setLineWidth(0.2);
  pdf.rect(MARGIN, y, CONTENT_WIDTH, boxHeight, "FD");

  let rowY = y + 7.5;
  rows.forEach((row, index) => {
    if (index > 0) {
      pdf.setDrawColor(RULE[0], RULE[1], RULE[2]);
      pdf.line(MARGIN + 4, rowY - 5.2, RIGHT - 4, rowY - 5.2);
    }
    pdf.setFont("helvetica", row.strong ? "bold" : "normal");
    pdf.setFontSize(10);
    setInk(row.strong ? INK : MUTED);
    pdf.text(row.text, MARGIN + 5, rowY);
    setInk(INK);
    pdf.text(row.value, RIGHT - 5, rowY, { align: "right" });
    rowY += rowHeight;
  });

  y += boxHeight + 9;

  /* ---- Corps ------------------------------------------------------ */

  y = block(doc.statement, MARGIN, y, CONTENT_WIDTH, 10) + 3;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  setInk(MUTED);
  pdf.text(`Paiement reçu le ${doc.paymentDateLabel}.`, MARGIN, y);

  /* ---- Lieu, date et signature ------------------------------------ */

  y += 16;
  pdf.setFontSize(10);
  setInk(INK);
  pdf.text(`Fait à ${doc.place}, le ${doc.issueDateLabel}`, RIGHT, y, { align: "right" });

  y += 7;
  setInk(MUTED);
  pdf.setFontSize(9);
  pdf.text("Signature du bailleur", RIGHT, y, { align: "right" });

  pdf.setDrawColor(RULE[0], RULE[1], RULE[2]);
  pdf.line(RIGHT - 60, y + 20, RIGHT, y + 20);

  /* ---- Pied de page — mention discrète ---------------------------- */

  const footerY = PAGE_HEIGHT - 16;
  rule(footerY - 5);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  setInk(MUTED);
  pdf.text(
    "Document établi par le bailleur à l’aide du générateur gratuit Nireo — nireo.fr",
    PAGE_WIDTH / 2,
    footerY,
    { align: "center" }
  );
  pdf.text(
    "Modèle générique, sans valeur de conseil juridique : vérifiez les informations au regard de votre situation.",
    PAGE_WIDTH / 2,
    footerY + 4,
    { align: "center" }
  );

  return pdf.output("blob");
}
