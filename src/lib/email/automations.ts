import { getPlan } from "@/config/plans";
import { logger } from "@/lib/logger";
import { readSiteSettingRaw } from "@/lib/admin/settings";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/supabase/config";
import { isEmailConfigured, sendEmail } from "./provider";
import { customEmail } from "./templates";
import { fillVariables, variableValues } from "./variables";

/**
 * Automatisations e-mail — les quatre messages que Nireo envoie tout seul.
 *
 * Une automatisation, ici, c'est trois choses et pas une de plus : un
 * déclencheur défini dans le code (là où l'événement est CERTAIN), un texte
 * modifiable depuis l'administration, et une trace dans `email_logs`. Ce
 * n'est délibérément pas un constructeur de scénarios : personne n'a besoin
 * de dessiner un graphe pour envoyer quatre e-mails.
 *
 * RÈGLE CENTRALE — chaque envoi est réservé par `dedupe_key` AVANT l'appel
 * au fournisseur. La contrainte `unique (user_id, dedupe_key)` de la table
 * fait office de verrou : un webhook rejoué, un double-clic ou deux
 * instances du serveur ne peuvent pas produire deux e-mails. Et l'ordre est
 * toujours le même : réserver en « échec », envoyer, puis confirmer — pour
 * qu'aucune ligne ne dise « envoyé » avant que le fournisseur l'ait accepté.
 */

export type AutomationKind =
  | "welcome"
  | "subscription_started"
  | "subscription_changed"
  | "subscription_cancelled";

export const AUTOMATION_KINDS: AutomationKind[] = [
  "welcome",
  "subscription_started",
  "subscription_changed",
  "subscription_cancelled",
];

export interface AutomationDefinition {
  kind: AutomationKind;
  name: string;
  /** Ce qui déclenche l'envoi, en clair — affiché tel quel dans l'admin. */
  trigger: string;
  subject: string;
  body: string;
  /** Bouton du courriel : défini par le code, pas modifiable. */
  cta: { label: string; url: string } | null;
}

/**
 * Textes par défaut. Ils sont utilisés tels quels tant que personne n'a
 * réécrit le message dans l'administration — l'écran d'édition les affiche
 * donc pré-remplis, jamais un champ vide qui laisserait croire qu'aucun
 * e-mail ne part.
 */
export const AUTOMATION_DEFAULTS: Record<AutomationKind, AutomationDefinition> = {
  welcome: {
    kind: "welcome",
    name: "Bienvenue",
    trigger:
      "À la première confirmation de l’adresse e-mail, une fois le compte réellement créé. Jamais à une simple connexion.",
    subject: "Bienvenue sur Nireo",
    body:
      "Bonjour {{prenom}},\n\n" +
      "Votre compte Nireo est prêt. Centralisez vos logements, locataires, loyers, documents et travaux dans un seul espace.\n\n" +
      "Commencez par créer votre premier logement : tout le reste — bail, loyers, dossier — s’articule autour de lui.",
    cta: { label: "Ouvrir mon tableau de bord", url: `${SITE_URL}/` },
  },
  subscription_started: {
    kind: "subscription_started",
    name: "Nouvel abonnement",
    trigger:
      "Au premier paiement RÉELLEMENT encaissé, signalé par le webhook Stripe (facture payée). Jamais à l’arrivée sur la page de confirmation.",
    subject: "Votre abonnement Nireo est actif",
    body:
      "Bonjour {{prenom}},\n\n" +
      "Votre abonnement {{offre}} est actif. Merci de votre confiance.\n\n" +
      "Vos factures et votre moyen de paiement restent accessibles à tout moment depuis votre espace.",
    cta: { label: "Voir mon abonnement", url: `${SITE_URL}/abonnement` },
  },
  subscription_changed: {
    kind: "subscription_changed",
    name: "Changement d’offre",
    trigger:
      "Quand Stripe signale que l’abonnement a changé de plan. Aucun e-mail si seul le statut change.",
    subject: "Votre offre Nireo a changé",
    body:
      "Bonjour {{prenom}},\n\n" +
      "Votre abonnement est désormais l’offre {{offre}}. Le changement est déjà appliqué à votre espace.\n\n" +
      "Si vous n’êtes pas à l’origine de cette modification, répondez à cet e-mail.",
    cta: { label: "Voir mon abonnement", url: `${SITE_URL}/abonnement` },
  },
  subscription_cancelled: {
    kind: "subscription_cancelled",
    name: "Résiliation",
    trigger:
      "Quand l’abonnement prend réellement fin côté Stripe — pas au moment de la demande de résiliation, tant que la période payée court encore.",
    subject: "Votre abonnement Nireo a pris fin",
    body:
      "Bonjour {{prenom}},\n\n" +
      "Votre abonnement est terminé. Vos données restent conservées et votre espace reste accessible avec les limites de l’offre gratuite.\n\n" +
      "Vous pouvez reprendre un abonnement à tout moment, sans rien ressaisir.",
    cta: { label: "Revenir sur Nireo", url: `${SITE_URL}/abonnement` },
  },
};

/* ------------------------------------------------------------------ */
/* Configuration (site_settings)                                       */
/* ------------------------------------------------------------------ */

export const AUTOMATIONS_KEY = "email_automations";

export interface AutomationConfig {
  enabled: boolean;
  subject: string;
  body: string;
}

export type AutomationConfigMap = Record<AutomationKind, AutomationConfig>;

/** Une valeur JSON quelconque devient une configuration exploitable. */
export function coerceAutomations(value: unknown): AutomationConfigMap {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const out = {} as AutomationConfigMap;
  for (const kind of AUTOMATION_KINDS) {
    const entry = (raw[kind] && typeof raw[kind] === "object" ? raw[kind] : {}) as Record<
      string,
      unknown
    >;
    const fallback = AUTOMATION_DEFAULTS[kind];
    out[kind] = {
      // Par défaut ACTIVÉ : ces e-mails partaient déjà avant cet écran, on ne
      // les coupe pas silencieusement en introduisant la configuration.
      enabled: typeof entry.enabled === "boolean" ? entry.enabled : true,
      subject: typeof entry.subject === "string" && entry.subject.trim()
        ? entry.subject
        : fallback.subject,
      body:
        typeof entry.body === "string" && entry.body.trim() ? entry.body : fallback.body,
    };
  }
  return out;
}

export async function getAutomations(): Promise<AutomationConfigMap> {
  return coerceAutomations(await readSiteSettingRaw<unknown>(AUTOMATIONS_KEY, null));
}

/* ------------------------------------------------------------------ */
/* Exécution                                                           */
/* ------------------------------------------------------------------ */

interface RunOptions {
  kind: AutomationKind;
  userId: string;
  /**
   * Ce qui rend CET envoi unique. Deux appels avec la même clé ne produisent
   * qu'un e-mail, quoi qu'il arrive (rejeu Stripe, double requête, reprise).
   */
  dedupeKey: string;
  /** Plan à afficher dans {{offre}} si on le connaît mieux que le profil. */
  planId?: string | null;
  /**
   * Destinataire connu de l'appelant. Sert de filet quand le profil n'est
   * pas encore lisible : à la toute première confirmation d'un compte, la
   * session d'authentification connaît l'adresse avec certitude, et il
   * serait absurde de renoncer à l'e-mail de bienvenue pour un profil
   * créé une fraction de seconde plus tôt.
   */
  recipient?: { email: string; full_name?: string | null };
}

/**
 * Exécute une automatisation. Ne lève JAMAIS : un e-mail raté ne doit pas
 * faire échouer la confirmation d'un compte ni le traitement d'un webhook
 * Stripe (qui serait alors rejoué indéfiniment). Tout est journalisé.
 */
export async function runAutomation(options: RunOptions): Promise<void> {
  if (!isEmailConfigured || !isAdminConfigured) return;
  const admin = createAdminClient();
  let logId: string | null = null;

  try {
    const config = (await getAutomations())[options.kind];
    if (!config.enabled) return;

    const { data: profile } = await admin
      .from("profiles")
      .select("email, full_name, plan")
      .eq("id", options.userId)
      .maybeSingle();
    const email =
      (profile?.email as string | undefined)?.trim() || options.recipient?.email.trim();
    if (!email) return;

    const values = variableValues({
      full_name:
        (profile?.full_name as string | undefined) || options.recipient?.full_name || "",
      email,
      plan_label: getPlan(options.planId ?? (profile?.plan as string | undefined)).name,
    });
    const subject = fillVariables(config.subject, values);
    const content = customEmail(
      subject,
      fillVariables(config.body, values),
      AUTOMATION_DEFAULTS[options.kind].cta ?? undefined
    );

    // Réservation : c'est ELLE qui garantit l'unicité, pas une vérification
    // « ai-je déjà envoyé ? » qui laisserait passer deux appels simultanés.
    const { data: reservation, error: reserveError } = await admin
      .from("email_logs")
      .insert({
        user_id: options.userId,
        kind: options.kind,
        recipient: email,
        subject,
        status: "failed",
        error: "Envoi non confirmé.",
        dedupe_key: options.dedupeKey,
      })
      .select("id")
      .single();

    if (reserveError) {
      // 23505 : déjà envoyé (ou déjà en cours). Rien à faire, et surtout
      // pas un second e-mail.
      if (reserveError.code !== "23505") {
        logger.error(`email/automation ${options.kind}`, reserveError.message);
      }
      return;
    }
    logId = reservation.id as string;

    await sendEmail({ to: email, subject: content.subject, html: content.html });

    await admin.from("email_logs").update({ status: "sent", error: null }).eq("id", logId);
  } catch (e) {
    const detail = e instanceof Error ? e.message : "Erreur inconnue.";
    logger.error(`email/automation ${options.kind}`, e);
    if (logId) {
      // La ligne reste en échec ET garde sa clé : une automatisation ne se
      // rejoue pas toute seule, on ne veut pas d'un envoi en boucle.
      await admin
        .from("email_logs")
        .update({ error: detail })
        .eq("id", logId)
        .then(undefined, () => undefined);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Statistiques (lecture admin)                                        */
/* ------------------------------------------------------------------ */

export interface AutomationStats {
  sent: number;
  failed: number;
  lastSentAt: string | null;
  lastError: string | null;
}

/**
 * Ce que chaque automatisation a réellement fait. Compté dans `email_logs` :
 * si une automatisation n'a jamais tourné, l'écran affiche zéro — il
 * n'invente pas un « fonctionne correctement » rassurant.
 */
export async function getAutomationStats(): Promise<Record<AutomationKind, AutomationStats>> {
  const empty: AutomationStats = { sent: 0, failed: 0, lastSentAt: null, lastError: null };
  const out = {} as Record<AutomationKind, AutomationStats>;
  for (const kind of AUTOMATION_KINDS) out[kind] = { ...empty };
  if (!isAdminConfigured) return out;

  const admin = createAdminClient();
  await Promise.all(
    AUTOMATION_KINDS.map(async (kind) => {
      const [sent, failed, last, lastFailure] = await Promise.all([
        admin
          .from("email_logs")
          .select("id", { count: "exact", head: true })
          .eq("kind", kind)
          .eq("status", "sent"),
        admin
          .from("email_logs")
          .select("id", { count: "exact", head: true })
          .eq("kind", kind)
          .eq("status", "failed"),
        admin
          .from("email_logs")
          .select("created_at")
          .eq("kind", kind)
          .eq("status", "sent")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        admin
          .from("email_logs")
          .select("error")
          .eq("kind", kind)
          .eq("status", "failed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      out[kind] = {
        sent: sent.count ?? 0,
        failed: failed.count ?? 0,
        lastSentAt: (last.data?.created_at as string | undefined) ?? null,
        lastError: (lastFailure.data?.error as string | undefined) ?? null,
      };
    })
  );
  return out;
}
