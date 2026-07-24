import QRCode from "qrcode";

/**
 * Génération réelle de QR codes (librairie `qrcode`) — SERVEUR uniquement.
 * Le contenu encodé est TOUJOURS le lien unique du partenaire
 * (`https://nireo.fr/?ref=slug`) : scanner le QR = cliquer le lien,
 * le clic est enregistré par le proxy comme n'importe quelle visite.
 *
 * Correction d'erreur « M » : bon compromis lisibilité/densité, le QR
 * reste scannable imprimé en petit (carte de visite) ou abîmé.
 */

export type QrFormat = "png" | "svg";

/** Tailles autorisées (px) — 512 écran, 1024 standard, 2048 impression HD. */
const ALLOWED_SIZES = [256, 512, 1024, 2048] as const;
export type QrSize = (typeof ALLOWED_SIZES)[number];

export function sanitizeQrSize(raw: string | null): QrSize {
  const value = Number(raw);
  return (ALLOWED_SIZES as readonly number[]).includes(value) ? (value as QrSize) : 1024;
}

/** QR code PNG (Buffer) — haute résolution pour impression. */
export async function generateQrPng(content: string, size: QrSize = 1024): Promise<Buffer> {
  return QRCode.toBuffer(content, {
    type: "png",
    width: size,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#0f172a", light: "#ffffff" },
  });
}

/** QR code SVG (vectoriel — parfait pour l'imprimeur). */
export async function generateQrSvg(content: string): Promise<string> {
  return QRCode.toString(content, {
    type: "svg",
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#0f172a", light: "#ffffff" },
  });
}

/** Data-URL PNG (aperçu dans l'admin, supports marketing). */
export async function generateQrDataUrl(content: string, size: QrSize = 512): Promise<string> {
  return QRCode.toDataURL(content, {
    width: size,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#0f172a", light: "#ffffff" },
  });
}

/**
 * Vérification après génération : on relit les segments encodés par la
 * librairie et on reconstruit le contenu (octets → UTF-8) pour s'assurer
 * qu'il correspond EXACTEMENT au lien attendu. create() est déterministe :
 * même entrée → même QR, donc ce que l'on télécharge redirige bien vers
 * le lien du partenaire.
 */
export function verifyQrContent(expected: string): boolean {
  try {
    const generated = QRCode.create(expected, { errorCorrectionLevel: "M" });
    const decoded = generated.segments
      .map((segment) => {
        const data = segment.data as unknown;
        if (typeof data === "string") return data;
        // Mode « byte » : data est un tableau d'octets → chaîne UTF-8.
        return Buffer.from(data as ArrayLike<number>).toString("utf8");
      })
      .join("");
    return decoded === expected;
  } catch {
    return false;
  }
}
