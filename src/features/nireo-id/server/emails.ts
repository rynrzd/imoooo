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

const ACCENT = "#1F5C43";
const PAPER = "#FAF7F2";
const INK = "#191713";

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

/**
 * Gabarit d'e-mail Nireo ID — papier crème, encre chaude, un seul accent
 * vert. Pile humaniste (Calibri / Seravek), aucune image, aucune ombre.
 */
function layout(title: string, body: string, cta?: { label: string; url: string }): string {
  const font = "Seravek,'Gill Sans Nova',Calibri,'Segoe UI',Ubuntu,Arial,sans-serif";
  const button = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td style="border-radius:8px;background:${ACCENT}">
         <a href="${escUrl(cta.url)}" style="display:inline-block;padding:12px 22px;font:600 15px/1 ${font};color:${PAPER};text-decoration:none">${esc(cta.label)}</a>
       </td></tr></table>`
    : "";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${PAPER}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFDFA;border:1px solid #DED6C9;border-radius:10px;overflow:hidden">
        <tr><td style="padding:22px 28px;border-bottom:1px solid #DED6C9">
          <span style="font:600 17px/1 ${font};color:${INK}">Nireo</span>
          <span style="margin-left:7px;font:500 11px/1 ${font};letter-spacing:.16em;color:${ACCENT}">ID</span>
        </td></tr>
        <tr><td style="padding:28px;font:400 15px/1.65 ${font};color:#6B6459">
          <h1 style="margin:0 0 14px;font:600 21px/1.25 ${font};color:${INK}">${esc(title)}</h1>
          ${body}
          ${button}
        </td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #DED6C9;font:400 12px/1.7 ${font};color:#6B6459">
          Nireo ID — le suivi simple de votre téléphone.<br>
          <a href="${SITE_URL}/confidentialite" style="color:#6B6459;text-decoration:underline">Confidentialité</a>
          &nbsp;·&nbsp;
          <a href="${SITE_URL}/cgu" style="color:#6B6459;text-decoration:underline">CGU</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * Invitation à reprendre un téléphone. Retourne `true` UNIQUEMENT si le
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
      subject: `Un téléphone Nireo ID vous est transmis — ${options.deviceLabel}`,
      html: layout(
        "Un téléphone vous est transmis",
        `<p style="margin:0 0 12px">Le propriétaire actuel d'un <strong>${esc(options.deviceLabel)}</strong>
          vous propose de reprendre son téléphone Nireo ID : historique, état déclaré et documents
          explicitement transmis.</p>
         <p style="margin:0 0 12px">Vous devez être connecté avec <strong>cette adresse e-mail</strong>
          pour accepter. La demande expire le ${esc(options.expiresLabel)}.</p>
         <p style="margin:0;color:#6B6459;font-size:13px">Si vous n'attendiez pas ce transfert, ignorez ce message :
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

/** Informe un professionnel qu'un propriétaire lui ouvre un téléphone. */
export async function notifyProfessionalInvitation(options: {
  to: string;
  deviceLabel: string;
  url: string;
}): Promise<boolean> {
  if (!isEmailProviderConfigured) return false;
  try {
    await sendEmail({
      to: options.to,
      subject: "Un client vous donne accès à un téléphone Nireo ID",
      html: layout(
        "Accès à un téléphone Nireo ID",
        `<p style="margin:0 0 12px">Un client vous autorise à consulter le téléphone d'un
          <strong>${esc(options.deviceLabel)}</strong> et à y enregistrer votre intervention.</p>
         <p style="margin:0;color:#6B6459;font-size:13px">Cet accès est limité dans le temps et
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

/* ------------------------------------------------------------------ */
/*  V2 — bilans, invitations, réparations, garantie                    */
/* ------------------------------------------------------------------ */

/**
 * Bilan périodique. Les quatre réponses sont des liens directs vers la
 * page à jeton : un clic suffit pour « tout va bien ».
 */
export async function notifyCheckRequest(options: {
  to: string;
  deviceLabel: string;
  url: string;
  companyName?: string | null;
  recipientName?: string;
}): Promise<boolean> {
  if (!isEmailProviderConfigured) return false;
  const intro = options.companyName
    ? `<p style="margin:0 0 12px">${esc(options.companyName)} suit l'état des téléphones professionnels
        avec Nireo ID. Ce message ne concerne que l'état matériel de l'appareil :
        aucune donnée d'usage personnel n'est consultée.</p>`
    : "";
  const answers: [string, string][] = [
    ["Oui, tout va bien", "tout_fonctionne"],
    ["J'ai remarqué un problème", "probleme"],
    ["Il a été réparé", "repare"],
    ["Je ne possède plus ce téléphone", "plus_detenu"],
  ];
  const list = answers
    .map(
      ([label, value]) =>
        `<p style="margin:0 0 8px"><a href="${escUrl(`${options.url}?reponse=${value}`)}" style="color:${ACCENT};text-decoration:underline">${esc(label)}</a></p>`
    )
    .join("");

  try {
    await sendEmail({
      to: options.to,
      subject: "Un rapide point sur votre téléphone",
      html: layout(
        "Un rapide point sur votre téléphone",
        `${intro}
         <p style="margin:0 0 16px">Depuis votre dernier bilan, tout fonctionne normalement sur votre
          <strong>${esc(options.deviceLabel)}</strong> ?</p>
         ${list}
         <p style="margin:16px 0 0;color:#6B6459;font-size:13px">Ce lien est personnel et limité à ce téléphone.
          Il expire automatiquement.</p>`,
        { label: "Répondre au bilan", url: options.url }
      ),
    });
    return true;
  } catch (error) {
    logger.error("nireo-id/email checkup", error);
    return false;
  }
}

/** Invitation à rejoindre un espace entreprise ou atelier. */
export async function notifyWorkspaceInvitation(options: {
  to: string;
  workspaceName: string;
  url: string;
}): Promise<boolean> {
  if (!isEmailProviderConfigured) return false;
  try {
    await sendEmail({
      to: options.to,
      subject: `Rejoindre ${options.workspaceName} sur Nireo ID`,
      html: layout(
        "Vous êtes invité à rejoindre un espace",
        `<p style="margin:0 0 12px"><strong>${esc(options.workspaceName)}</strong> vous invite à rejoindre
          son espace Nireo ID.</p>
         <p style="margin:0;color:#6B6459;font-size:13px">Vous devez accepter avec cette adresse e-mail.
          L'invitation expire automatiquement.</p>`,
        { label: "Accepter l'invitation", url: options.url }
      ),
    });
    return true;
  } catch (error) {
    logger.error("nireo-id/email invite", error);
    return false;
  }
}

/** Lien remis à l'atelier pour compléter une intervention. */
export async function notifyRepairInvitation(options: {
  to: string;
  deviceLabel: string;
  url: string;
}): Promise<boolean> {
  if (!isEmailProviderConfigured) return false;
  try {
    await sendEmail({
      to: options.to,
      subject: "Une intervention vous est confiée — Nireo ID",
      html: layout(
        "Une intervention vous est confiée",
        `<p style="margin:0 0 12px">Un client vous confie la réparation d'un
          <strong>${esc(options.deviceLabel)}</strong> et vous autorise à compléter son historique.</p>
         <p style="margin:0;color:#6B6459;font-size:13px">Cet accès est limité à cette intervention
          et expire automatiquement.</p>`,
        { label: "Ouvrir l'intervention", url: options.url }
      ),
    });
    return true;
  } catch (error) {
    logger.error("nireo-id/email repair-invite", error);
    return false;
  }
}

/** Le client doit valider l'intervention soumise par l'atelier. */
export async function notifyRepairSubmitted(options: {
  to: string;
  deviceLabel: string;
  repairerLabel: string;
  url: string;
}): Promise<boolean> {
  if (!isEmailProviderConfigured) return false;
  try {
    await sendEmail({
      to: options.to,
      subject: "Une réparation attend votre validation",
      html: layout(
        "Une réparation attend votre validation",
        `<p style="margin:0 0 12px"><strong>${esc(options.repairerLabel)}</strong> a enregistré une
          intervention sur votre <strong>${esc(options.deviceLabel)}</strong>.</p>
         <p style="margin:0 0 12px">Vérifiez le détail, puis validez pour l'ajouter à l'historique.</p>`,
        { label: "Voir l'intervention", url: options.url }
      ),
    });
    return true;
  } catch (error) {
    logger.error("nireo-id/email repair-submitted", error);
    return false;
  }
}

/** L'atelier est informé de la validation du client. */
export async function notifyRepairValidated(options: {
  to: string;
  deviceLabel: string;
  attested: boolean;
}): Promise<boolean> {
  if (!isEmailProviderConfigured) return false;
  try {
    await sendEmail({
      to: options.to,
      subject: "Intervention validée par le client — Nireo ID",
      html: layout(
        "Intervention validée",
        `<p style="margin:0 0 12px">Le client a validé votre intervention sur un
          <strong>${esc(options.deviceLabel)}</strong>.</p>
         <p style="margin:0;color:#6B6459;font-size:13px">${
           options.attested
             ? "Elle apparaît comme « Attestée par un réparateur » dans l'historique."
             : "Elle apparaît comme « Intervention déclarée par l'atelier » : faites approuver votre identité professionnelle pour qu'elle soit attestée."
         }</p>`
      ),
    });
    return true;
  } catch (error) {
    logger.error("nireo-id/email repair-validated", error);
    return false;
  }
}

/** Un problème a été déclaré lors d'un bilan. */
export async function notifyProblemDeclared(options: {
  to: string;
  deviceLabel: string;
  holderLabel: string;
  comment: string;
  url: string;
}): Promise<boolean> {
  if (!isEmailProviderConfigured) return false;
  try {
    await sendEmail({
      to: options.to,
      subject: `Problème déclaré sur un téléphone — ${options.deviceLabel}`,
      html: layout(
        "Un problème a été déclaré",
        `<p style="margin:0 0 12px"><strong>${esc(options.holderLabel)}</strong> signale un problème sur un
          <strong>${esc(options.deviceLabel)}</strong>.</p>
         ${
           options.comment
             ? `<p style="margin:0 0 12px;padding:12px 14px;background:#F2EDE4;border-radius:8px">${esc(options.comment)}</p>`
             : ""
         }`,
        { label: "Voir le téléphone", url: options.url }
      ),
    });
    return true;
  } catch (error) {
    logger.error("nireo-id/email problem", error);
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
         <p style="margin:0 0 12px;padding:12px 14px;background:#F2EDE4;border-radius:8px">${esc(options.reason)}</p>`,
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
