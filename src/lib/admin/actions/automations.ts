"use server";

import { revalidatePath } from "next/cache";
import { getPlan } from "@/config/plans";
import {
  AUTOMATION_DEFAULTS,
  AUTOMATION_KINDS,
  AUTOMATIONS_KEY,
  getAutomations,
  type AutomationKind,
} from "@/lib/email/automations";
import { isEmailConfigured, sendEmail } from "@/lib/email/provider";
import { customEmail } from "@/lib/email/templates";
import { fillVariables, variableValues } from "@/lib/email/variables";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "../audit";
import { requireAdminAction } from "../auth";
import { writeSiteSettingRaw, type SettingValue } from "../settings";
import type { ActionResult } from "../types";

/**
 * Server Actions des automatisations e-mail.
 *
 * On ne modifie ici QUE le texte et l'activation. Les déclencheurs restent
 * dans le code, à l'endroit où l'événement est certain (callback
 * d'authentification, webhook Stripe signé) : les rendre configurables
 * reviendrait à laisser régler depuis une interface le moment où l'on croit
 * qu'un paiement a eu lieu.
 */

const SUBJECT_MAX = 150;
const BODY_MAX = 5000;

function isAutomationKind(value: string): value is AutomationKind {
  return (AUTOMATION_KINDS as string[]).includes(value);
}

export interface SaveAutomationInput {
  kind: string;
  enabled: boolean;
  subject: string;
  body: string;
}

export async function saveAutomation(input: SaveAutomationInput): Promise<ActionResult> {
  let ctx = null;
  try {
    ctx = await requireAdminAction(["admin"]);
    if (!isAutomationKind(input.kind)) {
      return { ok: false, error: "Automatisation inconnue." };
    }
    const subject = input.subject.trim().slice(0, SUBJECT_MAX);
    const body = input.body.trim().slice(0, BODY_MAX);
    if (!subject) return { ok: false, error: "Le sujet est obligatoire." };
    if (!body) return { ok: false, error: "Le message est vide." };

    const before = await getAutomations();
    const next = {
      ...before,
      [input.kind]: { enabled: Boolean(input.enabled), subject, body },
    };
    await writeSiteSettingRaw(
      AUTOMATIONS_KEY,
      next as unknown as SettingValue,
      ctx.admin.id
    );

    await logAdminAction(ctx, {
      action: "automation.update",
      targetLabel: AUTOMATION_DEFAULTS[input.kind].name,
      oldValue: before[input.kind],
      newValue: next[input.kind],
    });
    revalidatePath("/admin/automatisations");
    return { ok: true, message: "Automatisation enregistrée." };
  } catch (e) {
    logger.error("admin/automations", e);
    await logAdminAction(ctx, {
      action: "automation.update",
      result: "error",
      detail: e instanceof Error ? e.message : "Erreur inconnue",
    });
    return { ok: false, error: e instanceof Error ? e.message : "Enregistrement impossible." };
  }
}

/** Réactive ou coupe une automatisation sans toucher à son texte. */
export async function toggleAutomation(
  kind: string,
  enabled: boolean
): Promise<ActionResult> {
  try {
    if (!isAutomationKind(kind)) return { ok: false, error: "Automatisation inconnue." };
    const current = await getAutomations();
    return await saveAutomation({
      kind,
      enabled,
      subject: current[kind].subject,
      body: current[kind].body,
    });
  } catch (e) {
    logger.error("admin/automations", e);
    return { ok: false, error: e instanceof Error ? e.message : "Modification impossible." };
  }
}

/**
 * Envoie l'automatisation, telle qu'elle est enregistrée, à l'adresse de
 * l'administrateur connecté — et à personne d'autre.
 *
 * L'envoi est journalisé en `test_email` : un test ne doit jamais gonfler
 * le compteur d'exécutions d'une automatisation, sans quoi le tableau
 * mentirait sur ce que le système a réellement fait tout seul.
 */
export async function sendAutomationTest(kind: string): Promise<ActionResult> {
  let ctx = null;
  try {
    ctx = await requireAdminAction(["admin"]);
    if (!isAutomationKind(kind)) return { ok: false, error: "Automatisation inconnue." };
    if (!isEmailConfigured) {
      return {
        ok: false,
        error: "Aucun fournisseur e-mail n'est configuré : l'envoi est impossible.",
      };
    }
    const email = ctx.user.email;
    if (!email) return { ok: false, error: "Votre compte admin n'a pas d'adresse e-mail." };

    const config = (await getAutomations())[kind];
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, plan")
      .eq("id", ctx.user.id)
      .maybeSingle();

    const values = variableValues({
      full_name: (profile?.full_name as string | undefined) ?? "",
      email,
      plan_label: getPlan(profile?.plan as string | undefined).name,
    });
    const subject = `[Test] ${fillVariables(config.subject, values)}`;
    const content = customEmail(
      subject,
      fillVariables(config.body, values),
      AUTOMATION_DEFAULTS[kind].cta ?? undefined
    );

    const { data: reservation, error: reserveError } = await admin
      .from("email_logs")
      .insert({
        user_id: ctx.user.id,
        kind: "test_email",
        recipient: email,
        subject,
        status: "failed",
        error: "Envoi non confirmé.",
      })
      .select("id")
      .single();
    if (reserveError) throw new Error(reserveError.message);
    const logId = reservation.id as string;

    try {
      await sendEmail({ to: email, subject: content.subject, html: content.html });
    } catch (sendError) {
      const detail =
        sendError instanceof Error ? sendError.message : "Erreur inconnue du fournisseur.";
      await admin.from("email_logs").update({ error: detail }).eq("id", logId);
      return { ok: false, error: `L'envoi a échoué : ${detail}` };
    }

    await admin.from("email_logs").update({ status: "sent", error: null }).eq("id", logId);
    await logAdminAction(ctx, {
      action: "automation.test",
      targetLabel: AUTOMATION_DEFAULTS[kind].name,
    });
    revalidatePath("/admin/automatisations");
    return { ok: true, message: `Test envoyé à ${email}.` };
  } catch (e) {
    logger.error("admin/automations test", e);
    return { ok: false, error: e instanceof Error ? e.message : "Envoi impossible." };
  }
}
