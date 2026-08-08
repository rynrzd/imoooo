import { logger } from "@/lib/logger";
import { isEmailProviderConfigured, sendEmail } from "@/lib/email/provider";
import { SITE_URL } from "@/lib/supabase/config";

/**
 * E-mails Nireo ID — gabarit sobre et autonome (l'univers Nireo ID a sa
 * propre identité, sans toucher aux templates de Nireo Immo).
 *
 * Règle absolue : AUCUN envoi simulé. Si aucun fournisseur n'est
 * configuré, `notify*` retourne `false` et l'appelant affiche le lien
 * copiable — jamais « e-mail envoyé ».
 */

const ACCENT = "#0FAF9B";

function esc(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? esc(url) : "#";
}

function layout(title: string, body: string, cta?: { label: string; url: string }): string {
  const button = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td style="border-radius:12px;background:${ACCENT}">
         <a href="${escUrl(cta.url)}" style="display:inline-block;padding:12px 22px;font:600 14px/1 -apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#04211d;text-decoration:none">${esc(cta.label)}</a>
       </td></tr></table>`
    : "";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#F6F8FB">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8FB;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #E3E8EF;border-radius:16px;overflow:hidden">
        <tr><td style="padding:22px 28px;border-bottom:1px solid #EEF1F6">
          <span style="vertical-align:middle;font:600 16px/1 -apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#0B1220">Nireo</span>
          <span style="display:inline-block;vertical-align:middle;margin-left:7px;padding:3px 7px;border-radius:6px;background:#E6F7F4;color:#087F73;font:600 11px/1 Arial,sans-serif">ID</span>
        </td></tr>
        <tr><td style="padding:28px;font:400 14px/1.65 -apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#3D4A5C">
          <h1 style="margin:0 0 14px;font-size:19px;line-height:1.35;color:#0B1220">${esc(title)}</h1>
          ${body}
          ${button}
        </td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #EEF1F6;font:400 11px/1.7 -apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#667085">
          Nireo ID — l'historique suit l'objet, pas le propriétaire.<br>
          <a href="${SITE_URL}/confidentialite" style="color:#667085;text-decoration:underline">Confidentialité</a>
          &nbsp;·&nbsp;
          <a href="${SITE_URL}/cgu" style="color:#667085;text-decoration:underline">CGU</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * Invitation à reprendre un passeport. Retourne `true` UNIQUEMENT si le
 * fournisseur a accepté l'envoi.
 */
export async function notifyTransferInvitation(options: {
  to: string;
  deviceLabel: string;
  url: string;
  expiresLabel: string;
}): Promise<boolean> {
  if (!isEmailProviderConfigured) return false;
  try {
    await sendEmail({
      to: options.to,
      subject: `Un passeport Nireo ID vous est transmis — ${options.deviceLabel}`,
      html: layout(
        "Un smartphone vous est transmis",
        `<p style="margin:0 0 12px">Le propriétaire actuel d'un <strong>${esc(options.deviceLabel)}</strong>
          vous propose de reprendre son passeport Nireo ID : historique, état déclaré et documents
          explicitement transmis.</p>
         <p style="margin:0 0 12px">Vous devez être connecté avec <strong>cette adresse e-mail</strong>
          pour accepter. La demande expire le ${esc(options.expiresLabel)}.</p>
         <p style="margin:0;color:#667085;font-size:13px">Si vous n'attendiez pas ce transfert, ignorez ce message :
          rien ne sera transféré sans votre acceptation.</p>`,
        { label: "Voir la demande de transfert", url: options.url }
      ),
    });
    return true;
  } catch (error) {
    logger.error("nireo-id/email transfer", error);
    return false;
  }
}

/** Informe un professionnel qu'un propriétaire lui ouvre un passeport. */
export async function notifyProfessionalInvitation(options: {
  to: string;
  deviceLabel: string;
  url: string;
}): Promise<boolean> {
  if (!isEmailProviderConfigured) return false;
  try {
    await sendEmail({
      to: options.to,
      subject: "Un client vous donne accès à un passeport Nireo ID",
      html: layout(
        "Accès à un passeport Nireo ID",
        `<p style="margin:0 0 12px">Un client vous autorise à consulter le passeport d'un
          <strong>${esc(options.deviceLabel)}</strong> et à y enregistrer votre intervention.</p>
         <p style="margin:0;color:#667085;font-size:13px">Cet accès est limité dans le temps et
          révocable à tout moment par le propriétaire.</p>`,
        { label: "Ouvrir l'espace professionnel", url: options.url }
      ),
    });
    return true;
  } catch (error) {
    logger.error("nireo-id/email pro-invite", error);
    return false;
  }
}

/** Informe un professionnel de la décision prise sur sa candidature. */
export async function notifyProfessionalDecision(options: {
  to: string;
  decision: "approuve" | "refuse" | "suspendu";
  reason: string;
}): Promise<boolean> {
  if (!isEmailProviderConfigured) return false;
  const titles = {
    approuve: "Votre compte professionnel est approuvé",
    refuse: "Votre demande de compte professionnel n'a pas été retenue",
    suspendu: "Votre compte professionnel est suspendu",
  } as const;
  try {
    await sendEmail({
      to: options.to,
      subject: `Nireo ID — ${titles[options.decision]}`,
      html: layout(
        titles[options.decision],
        `<p style="margin:0 0 12px">Motif communiqué par l'équipe Nireo :</p>
         <p style="margin:0 0 12px;padding:12px 14px;background:#F6F8FB;border-radius:10px">${esc(options.reason)}</p>`,
        options.decision === "approuve"
          ? { label: "Ouvrir l'espace professionnel", url: `${SITE_URL}/id/pro` }
          : undefined
      ),
    });
    return true;
  } catch (error) {
    logger.error("nireo-id/email pro-decision", error);
    return false;
  }
}
