/**
 * Envoi d'e-mails — architecture multi-fournisseurs, SERVEUR uniquement.
 *
 * Fournisseur choisi par variables d'environnement (aucune clé = aucun
 * envoi, jamais de simulation) :
 * - EMAIL_PROVIDER=resend   + RESEND_API_KEY
 * - EMAIL_PROVIDER=brevo    + BREVO_API_KEY
 * - EMAIL_PROVIDER=postmark + POSTMARK_SERVER_TOKEN
 * - EMAIL_FROM_NAME + EMAIL_FROM_ADDRESS  expéditeur (ex. ImmoPilot + no-reply@domaine.fr)
 *   (EMAIL_FROM « Nom <adresse> » reste accepté pour compatibilité)
 * - SUPPORT_EMAIL           boîte de réception du support (formulaire contact)
 *
 * Les trois APIs sont appelées en HTTP direct : aucune dépendance ajoutée.
 * Aucune clé n'est jamais loguée ni renvoyée au navigateur.
 */

import { logger } from "@/lib/logger";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  /** Copie facultative (ex. propriétaire en copie d'un rappel locataire). */
  cc?: string;
  /** Adresse de réponse facultative (ex. visiteur du formulaire contact). */
  replyTo?: string;
}

type Provider = "resend" | "brevo" | "postmark";

const VALID_PROVIDERS: readonly Provider[] = ["resend", "brevo", "postmark"];

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/** Valide EMAIL_PROVIDER : valeur inconnue = configuration invalide (pas d'envoi). */
function resolveProvider(): Provider | undefined {
  const raw = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (!raw) return undefined;
  if (!(VALID_PROVIDERS as readonly string[]).includes(raw)) {
    logger.error("email/config", `EMAIL_PROVIDER invalide « ${raw} » (attendu : resend | brevo | postmark).`);
    return undefined;
  }
  return raw as Provider;
}

/**
 * Expéditeur : EMAIL_FROM_NAME + EMAIL_FROM_ADDRESS en priorité,
 * sinon EMAIL_FROM (« Nom <adresse@domaine.fr> » ou adresse seule).
 * Adresse invalide = configuration invalide (aucun envoi, jamais de crash build).
 */
function resolveFrom(): string | undefined {
  const address = process.env.EMAIL_FROM_ADDRESS?.trim();
  const name = process.env.EMAIL_FROM_NAME?.trim();
  if (address) {
    if (!EMAIL_RE.test(address)) {
      logger.error("email/config", "EMAIL_FROM_ADDRESS n'est pas une adresse e-mail valide.");
      return undefined;
    }
    return name ? `${name.replace(/[<>"]/g, "")} <${address}>` : address;
  }
  const legacy = process.env.EMAIL_FROM?.trim();
  if (!legacy) return undefined;
  const bare = legacy.replace(/^.*<|>$/g, "").trim();
  if (!EMAIL_RE.test(bare)) {
    logger.error("email/config", "EMAIL_FROM n'est pas une adresse e-mail valide.");
    return undefined;
  }
  return legacy;
}

const PROVIDER = resolveProvider();
const FROM = resolveFrom();

function apiKey(provider: Provider): string | undefined {
  switch (provider) {
    case "resend":
      return process.env.RESEND_API_KEY?.trim() || undefined;
    case "brevo":
      return process.env.BREVO_API_KEY?.trim() || undefined;
    case "postmark":
      return process.env.POSTMARK_SERVER_TOKEN?.trim() || undefined;
  }
}

/** Boîte support (formulaire contact). null si absente ou invalide. */
export function getSupportEmail(): string | null {
  const raw = process.env.SUPPORT_EMAIL?.trim();
  return raw && EMAIL_RE.test(raw) ? raw : null;
}

/** true si un fournisseur est entièrement configuré (clé + expéditeur). */
export const isEmailConfigured = Boolean(
  PROVIDER && FROM && apiKey(PROVIDER as Provider)
);

/** Alias explicite. */
export const isEmailProviderConfigured = isEmailConfigured;

/** Résultat structuré quand aucun fournisseur n'est configuré. */
export const PROVIDER_NOT_CONFIGURED = "provider_not_configured" as const;

/** Version texte brut dérivée du HTML (clients mail sans HTML). */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Envoie un e-mail via le fournisseur configuré.
 * Lève une erreur claire si aucun fournisseur n'est configuré : les
 * appelants doivent vérifier `isEmailConfigured` avant tout envoi
 * automatique — jamais de succès simulé.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  if (typeof window !== "undefined") {
    throw new Error("sendEmail est réservé au serveur.");
  }
  if (!PROVIDER || !FROM || !apiKey(PROVIDER)) {
    throw new Error(
      "Aucun fournisseur e-mail configuré (EMAIL_PROVIDER, EMAIL_FROM et la clé associée)."
    );
  }
  const key = apiKey(PROVIDER) as string;

  const fromAddress = FROM.replace(/^.*<|>$/g, "").trim();
  const fromName = FROM.includes("<") ? FROM.replace(/<.*$/, "").trim() : undefined;

  let response: Response;
  switch (PROVIDER) {
    case "resend":
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [message.to],
          cc: message.cc ? [message.cc] : undefined,
          reply_to: message.replyTo,
          subject: message.subject,
          html: message.html,
          text: htmlToText(message.html),
        }),
      });
      break;
    case "brevo":
      response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: { email: fromAddress, name: fromName },
          to: [{ email: message.to }],
          cc: message.cc ? [{ email: message.cc }] : undefined,
          replyTo: message.replyTo ? { email: message.replyTo } : undefined,
          subject: message.subject,
          htmlContent: message.html,
          textContent: htmlToText(message.html),
        }),
      });
      break;
    case "postmark":
      response = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: { "X-Postmark-Server-Token": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          From: FROM,
          To: message.to,
          Cc: message.cc,
          ReplyTo: message.replyTo,
          Subject: message.subject,
          HtmlBody: message.html,
          TextBody: htmlToText(message.html),
        }),
      });
      break;
  }

  if (!response.ok) {
    // Corps d'erreur du fournisseur (tronqué) : utile au diagnostic, sans secret.
    const detail = await response.text().then((t) => t.slice(0, 300)).catch(() => "");
    logger.error("email/send", `${PROVIDER} HTTP ${response.status} ${detail}`);
    throw new Error(`L'envoi de l'e-mail a échoué (fournisseur : HTTP ${response.status}).`);
  }
}
