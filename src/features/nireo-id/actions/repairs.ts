"use server";

import { revalidatePath } from "next/cache";
import type { PartsType } from "../constants";
import { createRepairSchema, submitRepairSchema, validateRepairSchema } from "../schemas";
import type { ActionResult } from "../types";
import { requireNidUser } from "../server/guards";
import {
  cancelRepairOrder,
  claimErrorMessage,
  claimRepairOrder,
  createRepairOrder,
  sendRepairLink,
  submitRepairOrder,
  validateRepairOrder,
} from "../server/repairs";
import { ensurePersonalWorkspace } from "../server/workspaces";
import { fail, numberOrNull, ok, parseInput, run, text } from "./helpers";

/**
 * Server Actions du parcours réparation.
 *
 * Un atelier invité peut compléter une intervention sans abonnement : il
 * lui faut seulement un compte Nireo (l'accès reste limité à CETTE
 * intervention et expire).
 */

export async function createRepairAction(
  form: FormData
): Promise<ActionResult<{ url: string; email_sent: boolean; expires_at: string }>> {
  return run("repairs/create", async () => {
    const session = await requireNidUser();
    const parsed = parseInput(createRepairSchema, {
      asset_id: text(form, "asset_id"),
      reported_problem: text(form, "reported_problem"),
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    const created = await createRepairOrder(
      session.user.id,
      parsed.value.asset_id,
      parsed.value.reported_problem
    );

    // L'envoi du lien à l'atelier est facultatif : sans fournisseur
    // e-mail configuré, l'interface affiche le lien à transmettre.
    const repairerEmail = text(form, "repairer_email");
    let emailSent = false;
    if (repairerEmail) {
      emailSent = await sendRepairLink(created.order_id, created.url, repairerEmail);
    }

    revalidatePath(`/id/app/objets/${parsed.value.asset_id}`);
    return ok({ url: created.url, email_sent: emailSent, expires_at: created.expires_at });
  });
}

export async function claimRepairAction(
  form: FormData
): Promise<ActionResult<{ order_id: string }>> {
  return run("repairs/claim", async () => {
    const session = await requireNidUser();
    await ensurePersonalWorkspace(session.user.id, session.email);

    const token = text(form, "token");
    if (!token) return fail("Lien introuvable.");

    const result = await claimRepairOrder(token, session.user.id);
    if (result.state !== "ouvert") return fail(claimErrorMessage(result.state));

    revalidatePath("/id/pro");
    return ok({ order_id: result.id as string });
  });
}

export async function submitRepairAction(form: FormData): Promise<ActionResult> {
  return run("repairs/submit", async () => {
    const session = await requireNidUser();
    const parsed = parseInput(submitRepairSchema, {
      order_id: text(form, "order_id"),
      visual_state: text(form, "visual_state"),
      diagnosis: text(form, "diagnosis"),
      operation: text(form, "operation"),
      parts: text(form, "parts"),
      parts_type: text(form, "parts_type") || "inconnu",
      amount_euros: numberOrNull(form, "amount_euros"),
      warranty_months: numberOrNull(form, "warranty_months"),
      intervened_on: text(form, "intervened_on"),
      comment: text(form, "comment"),
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    await submitRepairOrder(session.user.id, {
      order_id: parsed.value.order_id,
      visual_state: parsed.value.visual_state,
      diagnosis: parsed.value.diagnosis,
      operation: parsed.value.operation,
      parts: parsed.value.parts,
      parts_type: parsed.value.parts_type as PartsType,
      amount_euros: parsed.value.amount_euros,
      warranty_months: parsed.value.warranty_months,
      intervened_on: parsed.value.intervened_on || "",
      comment: parsed.value.comment,
    });

    revalidatePath("/id/pro");
    revalidatePath(`/id/pro/interventions/${parsed.value.order_id}`);
    return ok();
  });
}

export async function validateRepairAction(
  form: FormData
): Promise<ActionResult<{ attested: boolean }>> {
  return run("repairs/validate", async () => {
    const session = await requireNidUser();
    const parsed = parseInput(validateRepairSchema, {
      order_id: text(form, "order_id"),
      decision: text(form, "decision"),
      reason: text(form, "reason"),
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    const result = await validateRepairOrder(
      session.user.id,
      parsed.value.order_id,
      parsed.value.decision,
      parsed.value.reason
    );

    const assetId = text(form, "asset_id");
    if (assetId) revalidatePath(`/id/app/objets/${assetId}`);
    return ok({ attested: result.attested });
  });
}

export async function cancelRepairAction(form: FormData): Promise<ActionResult> {
  return run("repairs/cancel", async () => {
    const session = await requireNidUser();
    const orderId = text(form, "order_id");
    if (!orderId) return fail("Intervention introuvable.");
    await cancelRepairOrder(session.user.id, orderId);
    const assetId = text(form, "asset_id");
    if (assetId) revalidatePath(`/id/app/objets/${assetId}`);
    return ok();
  });
}
