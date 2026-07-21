/**
 * Templates d'e-mails Nireo — centralisés, HTML responsive inline
 * (compatible clients mail), alignés sur l'identité sobre du produit
 * (noir profond #111827, neutres chauds, footer légal) — même design que
 * les templates Supabase Auth (supabase/email-templates/).
 * Chaque fabrique retourne { subject, html }.
 */

import { SITE_URL } from "@/lib/supabase/config";

export interface EmailContent {
  subject: string;
  html: string;
}

const BRAND = "#111827";

/**
 * Échappe toute valeur dynamique injectée dans le HTML (noms de logements,
 * messages personnalisés, sujets de contact…) : aucune entrée utilisateur
 * ne doit pouvoir injecter de balise dans un e-mail.
 */
function esc(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Échappe une URL pour un attribut href ; refuse tout schéma non http(s). */
function escUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? esc(url) : "#";
}

const FOOTER_LINKS = [
  { label: "Confidentialité", path: "/confidentialite" },
  { label: "CGU", path: "/cgu" },
  { label: "Mentions légales", path: "/mentions-legales" },
];

/** Gabarit commun : logo, contenu, bouton facultatif, footer légal. */
function layout(title: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  const button = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto"><tr><td style="border-radius:10px;background:${BRAND}">
         <a href="${escUrl(cta.url)}" style="display:inline-block;padding:11px 22px;font:600 14px/1 -apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#ffffff;text-decoration:none">${esc(cta.label)}</a>
       </td></tr></table>`
    : "";
  const footerLinks = FOOTER_LINKS.map(
    (l) => `<a href="${SITE_URL}${l.path}" style="color:#898781;text-decoration:underline">${l.label}</a>`
  ).join(" &nbsp;·&nbsp; ");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f2">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f2;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e1e0d9;border-radius:14px;overflow:hidden">
        <tr><td style="padding:22px 28px;border-bottom:1px solid #eeede8">
          <span style="display:inline-block;vertical-align:middle;width:26px;height:26px;border-radius:8px;background:${BRAND};color:#fff;text-align:center;font:700 13px/26px Arial,sans-serif">IP</span>
          <span style="vertical-align:middle;padding-left:9px;font:600 16px/1 -apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a18">Nireo</span>
        </td></tr>
        <tr><td style="padding:28px;font:400 14px/1.65 -apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#3a3935">
          <h1 style="margin:0 0 14px;font-size:19px;line-height:1.35;color:#1a1a18">${esc(title)}</h1>
          ${bodyHtml}
          ${button}
        </td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #eeede8;font:400 11px/1.7 -apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#898781">
          Nireo — gestion locative pour propriétaires bailleurs.<br>${footerLinks}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const p = (text: string) => `<p style="margin:0 0 12px">${text}</p>`;

/* ------------------------------------------------------------------ */
/* Cycle de vie du compte                                              */
/* ------------------------------------------------------------------ */

export function welcomeEmail(fullName: string): EmailContent {
  return {
    subject: "Bienvenue sur Nireo",
    html: layout(
      `Bienvenue${fullName ? ` ${fullName}` : ""} !`, // esc() appliqué par layout()
      p("Votre compte Nireo est prêt. Centralisez vos logements, locataires, loyers, documents et travaux dans un seul espace.") +
        p("Commencez par créer votre premier logement : tout le reste (bail, loyers, dossier) s'articule autour de lui."),
      { label: "Ouvrir mon tableau de bord", url: `${SITE_URL}/` }
    ),
  };
}

export function signupConfirmationEmail(confirmUrl: string): EmailContent {
  return {
    subject: "Confirmez votre inscription",
    html: layout(
      "Confirmez votre adresse e-mail",
      p("Merci de votre inscription sur Nireo. Cliquez sur le bouton ci-dessous pour activer votre compte.") +
        p("Si vous n'êtes pas à l'origine de cette inscription, ignorez cet e-mail."),
      { label: "Confirmer mon inscription", url: confirmUrl }
    ),
  };
}

export function emailChangeEmail(confirmUrl: string, newEmail: string): EmailContent {
  return {
    subject: "Confirmez votre nouvelle adresse e-mail",
    html: layout(
      "Changement d'adresse e-mail",
      p(`Une demande de changement d'adresse vers <strong>${esc(newEmail)}</strong> a été effectuée.`) +
        p("Confirmez ce changement en cliquant ci-dessous. Sinon, ignorez cet e-mail : rien ne sera modifié."),
      { label: "Confirmer le changement", url: confirmUrl }
    ),
  };
}

export function passwordResetEmail(resetUrl: string): EmailContent {
  return {
    subject: "Réinitialisez votre mot de passe",
    html: layout(
      "Réinitialisation du mot de passe",
      p("Vous avez demandé la réinitialisation de votre mot de passe Nireo.") +
        p("Ce lien est à usage unique et expire rapidement. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail."),
      { label: "Choisir un nouveau mot de passe", url: resetUrl }
    ),
  };
}

export function passwordChangedEmail(): EmailContent {
  return {
    subject: "Votre mot de passe a été modifié",
    html: layout(
      "Mot de passe modifié",
      p("Le mot de passe de votre compte Nireo vient d'être modifié.") +
        p("Si vous n'êtes pas à l'origine de ce changement, réinitialisez immédiatement votre mot de passe et contactez le support."),
      { label: "Sécuriser mon compte", url: `${SITE_URL}/mot-de-passe-oublie` }
    ),
  };
}

export function accountDeletedEmail(): EmailContent {
  return {
    subject: "Votre compte Nireo a été supprimé",
    html: layout(
      "Compte supprimé",
      p("Votre compte Nireo et l'ensemble de vos données (logements, baux, loyers, documents, photos) ont été définitivement supprimés.") +
        p("Merci d'avoir utilisé Nireo. Vous pouvez créer un nouveau compte à tout moment.")
    ),
  };
}

export function subscriptionConfirmedEmail(planName: string): EmailContent {
  return {
    subject: `Votre abonnement ${planName} est actif`,
    html: layout(
      "Abonnement confirmé",
      p(`Votre abonnement <strong>${esc(planName)}</strong> est maintenant actif. Merci de votre confiance !`) +
        p("Gérez votre facturation, votre moyen de paiement ou votre résiliation à tout moment depuis votre espace."),
      { label: "Gérer mon abonnement", url: `${SITE_URL}/abonnement` }
    ),
  };
}

export function contactCopyEmail(
  name: string,
  email: string,
  subject: string,
  message: string
): EmailContent {
  return {
    subject: `[Contact] ${subject}`,
    html: layout(
      "Nouveau message de contact",
      p(`<strong>De :</strong> ${esc(name)} (${esc(email)})`) +
        p(`<strong>Sujet :</strong> ${esc(subject)}`) +
        p(esc(message).replace(/\n/g, "<br>"))
    ),
  };
}

/** Accusé de réception envoyé au visiteur du formulaire contact. */
export function contactConfirmationEmail(name: string, subject: string): EmailContent {
  return {
    subject: "Nous avons bien reçu votre message",
    html: layout(
      "Message bien reçu",
      p(`Bonjour${name ? ` ${esc(name)}` : ""},`) +
        p(`Votre message « ${esc(subject)} » a bien été transmis à l'équipe Nireo. Nous vous répondons dans les meilleurs délais.`) +
        p("Ceci est un accusé de réception automatique : inutile d'y répondre.")
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Alertes de gestion (envoi automatique futur)                        */
/* ------------------------------------------------------------------ */

export function rentDueSoonEmail(propertyName: string, amount: string, dueLabel: string): EmailContent {
  return {
    subject: `Loyer bientôt dû — ${propertyName}`,
    html: layout(
      "Loyer bientôt dû",
      p(`Le loyer de <strong>${esc(propertyName)}</strong> (${esc(amount)}) est attendu ${esc(dueLabel)}.`),
      { label: "Voir mes loyers", url: `${SITE_URL}/loyers` }
    ),
  };
}

/** Confirmation d'encaissement d'un loyer (au propriétaire). */
export function paymentReceivedEmail(propertyName: string, amount: string, month: string): EmailContent {
  return {
    subject: `Paiement reçu — ${propertyName}`,
    html: layout(
      "Paiement reçu",
      p(`Le loyer de <strong>${esc(propertyName)}</strong> (${esc(amount)}) pour ${esc(month)} a bien été encaissé.`),
      { label: "Voir mes loyers", url: `${SITE_URL}/loyers` }
    ),
  };
}

/** Rappel de loyer impayé — au propriétaire ou au locataire (message personnalisable). */
export function rentLateEmail(options: {
  recipient: "owner" | "tenant";
  propertyName: string;
  amount: string;
  daysLate: number;
  customMessage?: string | null;
}): EmailContent {
  const { recipient, propertyName, amount, daysLate, customMessage } = options;
  const body =
    recipient === "tenant"
      ? p(`Le loyer du logement <strong>${esc(propertyName)}</strong> (${esc(amount)}) est en attente de règlement depuis ${daysLate} jour${daysLate > 1 ? "s" : ""}.`) +
        (customMessage ? p(esc(customMessage).replace(/\n/g, "<br>")) : p("Merci de régulariser la situation dès que possible. En cas de difficulté, contactez votre propriétaire."))
      : p(`Le loyer de <strong>${esc(propertyName)}</strong> (${esc(amount)}) est impayé depuis ${daysLate} jour${daysLate > 1 ? "s" : ""}.`);
  return {
    subject: `Loyer en retard — ${propertyName}`,
    html: layout(
      "Loyer en retard",
      body,
      recipient === "owner" ? { label: "Voir le détail", url: `${SITE_URL}/loyers` } : undefined
    ),
  };
}

export function leaseExpiringEmail(propertyName: string, endDate: string): EmailContent {
  return {
    subject: `Bail arrivant à échéance — ${propertyName}`,
    html: layout(
      "Bail arrivant à échéance",
      p(`Le bail du logement <strong>${esc(propertyName)}</strong> se termine le ${esc(endDate)}.`),
      { label: "Voir le bail", url: `${SITE_URL}/locataires` }
    ),
  };
}

export function documentExpiringEmail(documentName: string, propertyName: string, date: string): EmailContent {
  return {
    subject: `Document bientôt expiré — ${propertyName}`,
    html: layout(
      "Document bientôt expiré",
      p(`« ${esc(documentName)} » (${esc(propertyName)}) expire le ${esc(date)}. Pensez à le renouveler.`),
      { label: "Ouvrir mes documents", url: `${SITE_URL}/documents` }
    ),
  };
}

export function maintenanceOverdueEmail(title: string, propertyName: string): EmailContent {
  return {
    subject: `Chantier en retard — ${propertyName}`,
    html: layout(
      "Chantier en retard",
      p(`Le chantier « ${esc(title)} » (${esc(propertyName)}) a dépassé sa date prévue.`),
      { label: "Voir mes travaux", url: `${SITE_URL}/travaux` }
    ),
  };
}

export interface MonthlyReportInput {
  /** Mois couvert, libellé français (ex. « juin 2026 »). */
  monthLabel: string;
  revenue: string;
  expenses: string;
  net: string;
  /** Taux d'occupation en % (déjà formaté). */
  occupancy: string;
  propertiesCount: number;
  latePayments: number;
  lateAmount: string;
  newWorks: number;
}

/** Ligne du tableau récapitulatif (libellé + valeur alignée à droite). */
function reportRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:7px 0;border-bottom:1px solid #eeede8;color:#3a3935">${esc(label)}</td>
    <td style="padding:7px 0;border-bottom:1px solid #eeede8;text-align:right;font-weight:600;color:#1a1a18">${esc(value)}</td>
  </tr>`;
}

export function monthlyReportEmail(input: MonthlyReportInput): EmailContent {
  const summary =
    input.latePayments > 0
      ? `${input.latePayments} loyer${input.latePayments > 1 ? "s" : ""} en retard (${input.lateAmount}) à suivre en priorité.`
      : "Aucun loyer en retard sur le mois : patrimoine à jour.";
  return {
    subject: `Votre rapport Nireo — ${input.monthLabel}`,
    html: layout(
      `Rapport mensuel — ${input.monthLabel}`,
      p(`Le résumé de votre patrimoine (${input.propertiesCount} logement${input.propertiesCount > 1 ? "s" : ""}) pour ${esc(input.monthLabel)} :`) +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 14px;font-size:14px">
          ${reportRow("Revenus encaissés", input.revenue)}
          ${reportRow("Dépenses", input.expenses)}
          ${reportRow("Cash-flow", input.net)}
          ${reportRow("Taux d'occupation", input.occupancy)}
          ${reportRow("Loyers en retard", String(input.latePayments))}
          ${reportRow("Nouveaux travaux", String(input.newWorks))}
        </table>` +
        p(summary),
      { label: "Voir mes statistiques", url: `${SITE_URL}/statistiques` }
    ),
  };
}
