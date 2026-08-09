"use server";

import { revalidatePath } from "next/cache";
import { CHECK_ANSWERS, CHECK_DETAIL_POINTS, MANAGING_ROLES, type CheckAnswer } from "../constants";
import { planHasEntitlement } from "../plans";
import { campaignSchema, checkAnswerSchema, checkScheduleSchema, sendCheckSchema } from "../schemas";
import type { ActionResult } from "../types";
import {
  answerCheckup,
  answerOwnCheckup,
  createCheckRequest,
  resolveRecipient,
  startCampaign,
  updateSchedule,
  type CampaignOutcome,
} from "../server/checkups";
import { nidService } from "../server/client";
import { getNidSession, requireNidUser } from "../server/guards";
import { requireWorkspaceRole } from "../server/workspaces";
import { fail, list, ok, parseInput, run, text } from "./helpers";

/**
 * Server Actions des bilans.
 *
 * La réponse à un bilan ne nécessite PAS de reconnexion : le jeton du lien
 * suffit (il est limité à un téléphone, expirant, révocable et à usage
 * unique). Aucun envoi d'e-mail n'est jamais annoncé sans confirmation du
 * fournisseur.
 */

/* ------------------------------------------------------------------ */
/*  Réponse à un bilan                                                 */
/* ------------------------------------------------------------------ */

export async function answerCheckupAction(
  form: FormData
): Promise<ActionResult<{ answer: CheckAnswer }>> {
  return run("checkups/answer", async () => {
    const details: Record<string, string> = {};
    for (const point of CHECK_DETAIL_POINTS) {
      const value = text(form, `detail_${point.key}`);
      if (value) details[point.key] = value;
    }

    const parsed = parseInput(checkAnswerSchema, {
      token: text(form, "token"),
      answer: text(form, "answer"),
      details,
      comment: text(form, "comment"),
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    // Le jeton fait foi ; la session, si elle existe, sert seulement à
    // attribuer la réponse à un compte.
    const session = await getNidSession();

    const result = await answerCheckup(parsed.value.token, session?.user.id ?? null, {
      answer: parsed.value.answer,
      details: parsed.value.details,
      comment: parsed.value.comment,
    });

    switch (result.state) {
      case "enregistre":
        return ok({ answer: parsed.value.answer });
      case "deja_repondu":
        return fail("Ce bilan a déjà été enregistré. Merci !");
      case "expire":
        return fail("Ce lien a expiré. Demandez un nouveau bilan depuis votre espace.");
      case "revoque":
        return fail("Ce lien a été révoqué.");
      case "introuvable":
        return fail("Ce lien de bilan n'existe pas.");
      default:
        return fail("Ce bilan n'a pas pu être enregistré.");
    }
  });
}

/** Bilan rempli depuis l'application (« Faire le bilan »). */
export async function selfCheckupAction(
  form: FormData
): Promise<ActionResult<{ answer: CheckAnswer }>> {
  return run("checkups/self", async () => {
    const session = await requireNidUser();
    const assetId = text(form, "asset_id");
    if (!assetId) return fail("Téléphone introuvable.");

    const details: Record<string, string> = {};
    for (const point of CHECK_DETAIL_POINTS) {
      const value = text(form, `detail_${point.key}`);
      if (value) details[point.key] = value;
    }

    const answer = text(form, "answer") as CheckAnswer;
    if (!CHECK_ANSWERS.includes(answer)) return fail("Réponse invalide.", "answer");

    const result = await answerOwnCheckup(session.user.id, assetId, {
      answer,
      details,
      comment: text(form, "comment"),
    });

    if (result.state === "non_autorise") {
      return fail("Vous ne pouvez pas enregistrer de bilan pour ce téléphone.");
    }
    if (result.state !== "enregistre") return fail("Ce bilan n'a pas pu être enregistré.");

    revalidatePath(`/id/app/objets/${assetId}`);
    revalidatePath("/id/app");
    return ok({ answer });
  });
}

/* ------------------------------------------------------------------ */
/*  Planification                                                      */
/* ------------------------------------------------------------------ */

export async function updateScheduleAction(form: FormData): Promise<ActionResult> {
  return run("checkups/schedule", async () => {
    const session = await requireNidUser();
    const parsed = parseInput(checkScheduleSchema, {
      asset_id: text(form, "asset_id"),
      frequency_months: text(form, "frequency_months") || "1",
      enabled: text(form, "enabled") !== "false",
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    await updateSchedule(
      session.user.id,
      parsed.value.asset_id,
      parsed.value.frequency_months,
      parsed.value.enabled
    );
    revalidatePath(`/id/app/objets/${parsed.value.asset_id}`);
    return ok();
  });
}

/* ------------------------------------------------------------------ */
/*  Envoi manuel d'un bilan                                            */
/* ------------------------------------------------------------------ */

export async function sendCheckAction(
  form: FormData
): Promise<ActionResult<{ url: string | null; email_sent: boolean; already: boolean }>> {
  return run("checkups/send", async () => {
    const session = await requireNidUser();
    const parsed = parseInput(sendCheckSchema, {
      asset_id: text(form, "asset_id"),
      scope: text(form, "scope") || "mini",
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    const service = nidService();
    const { data: asset } = await service
      .from("nid_assets")
      .select("id, brand, model, current_owner_id, workspace_id")
      .eq("id", parsed.value.asset_id)
      .maybeSingle();
    const row = asset as {
      id: string;
      brand: string;
      model: string;
      current_owner_id: string | null;
      workspace_id: string | null;
    } | null;
    if (!row) return fail("Téléphone introuvable.");

    // Propriétaire, ou responsable de l'espace propriétaire.
    if (row.current_owner_id !== session.user.id) {
      if (!row.workspace_id) return fail("Ce téléphone ne vous appartient pas.");
      await requireWorkspaceRole(session.user.id, row.workspace_id, MANAGING_ROLES);
    }

    const recipient = await resolveRecipient(row.id, row.current_owner_id, row.workspace_id);
    if (!recipient) {
      return fail(
        "Aucune adresse e-mail connue pour ce téléphone. Affectez-le à une personne avec son adresse."
      );
    }

    let companyName: string | null = null;
    if (row.workspace_id) {
      const { data: workspace } = await service
        .from("nid_workspaces")
        .select("name, kind")
        .eq("id", row.workspace_id)
        .maybeSingle();
      const ws = workspace as { name: string; kind: string } | null;
      companyName = ws && ws.kind !== "personnel" ? ws.name : null;
    }

    const outcome = await createCheckRequest({
      assetId: row.id,
      workspaceId: row.workspace_id,
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      recipientUserId: recipient.userId,
      scope: parsed.value.scope,
      createdBy: session.user.id,
      deviceLabel: `${row.brand} ${row.model}`,
      companyName,
    });

    revalidatePath(`/id/app/objets/${row.id}`);
    if (row.workspace_id) revalidatePath(`/id/entreprise/${row.workspace_id}/bilans`);

    return ok({
      url: outcome.url,
      email_sent: outcome.email_sent,
      already: outcome.state === "existante",
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Campagne d'entreprise                                              */
/* ------------------------------------------------------------------ */

export async function startCampaignAction(
  form: FormData
): Promise<ActionResult<CampaignOutcome>> {
  return run("checkups/campaign", async () => {
    const session = await requireNidUser();
    const parsed = parseInput(campaignSchema, {
      workspace_id: text(form, "workspace_id"),
      label: text(form, "label"),
      asset_ids: list(form, "asset_ids"),
      scope: text(form, "scope") || "mini",
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    const context = await requireWorkspaceRole(
      session.user.id,
      parsed.value.workspace_id,
      MANAGING_ROLES
    );
    if (!planHasEntitlement(context.workspace.plan, "campagnes")) {
      return fail(
        "Les campagnes de bilan sont incluses à partir de l'offre Entreprise Équipe. " +
          "Vous pouvez envoyer les bilans téléphone par téléphone avec votre offre actuelle."
      );
    }

    const outcome = await startCampaign(
      session.user.id,
      parsed.value.workspace_id,
      context.workspace.name,
      parsed.value.asset_ids,
      parsed.value.label,
      parsed.value.scope
    );

    revalidatePath(`/id/entreprise/${parsed.value.workspace_id}/bilans`);
    return ok(outcome);
  });
}
