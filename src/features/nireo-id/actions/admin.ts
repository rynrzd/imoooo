"use server";

import { revalidatePath } from "next/cache";
import { adminDisputeDecisionSchema, adminProDecisionSchema, revokeEventSchema } from "../schemas";
import type { ActionResult } from "../types";
import { adminRevokeEvent, decideDispute, decideProfessional } from "../server/admin";
import { requireNidAdminAction } from "../server/guards";
import { bool, fail, ok, parseInput, run, text } from "./helpers";

/**
 * Server Actions de l'ADMINISTRATION Nireo ID.
 *
 * Le rôle est relu en base à chaque appel (`nid_admins`, clé secrète) :
 * aucun bouton côté client ne suffit à déclencher ces opérations. Chaque
 * décision exige un motif et laisse une trace dans le journal d'audit.
 */

const ADMIN = "/id/admin";

export async function decideProfessionalAction(
  form: FormData
): Promise<ActionResult<{ email_sent: boolean }>> {
  return run("admin/professional", async () => {
    const admin = await requireNidAdminAction();
    const parsed = parseInput(adminProDecisionSchema, {
      professional_id: text(form, "professional_id"),
      decision: text(form, "decision"),
      reason: text(form, "reason"),
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    const result = await decideProfessional(admin, parsed.value);
    revalidatePath(`${ADMIN}/professionnels`);
    revalidatePath(ADMIN);
    return ok(result);
  });
}

export async function decideDisputeAction(form: FormData): Promise<ActionResult> {
  return run("admin/dispute", async () => {
    const admin = await requireNidAdminAction();
    const parsed = parseInput(adminDisputeDecisionSchema, {
      dispute_id: text(form, "dispute_id"),
      decision: text(form, "decision"),
      resolution: text(form, "resolution"),
      mark_event_disputed: bool(form, "mark_event_disputed"),
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    await decideDispute(admin, parsed.value);
    revalidatePath(`${ADMIN}/signalements`);
    revalidatePath(ADMIN);
    return ok();
  });
}

export async function adminRevokeEventAction(form: FormData): Promise<ActionResult> {
  return run("admin/revoke-event", async () => {
    const admin = await requireNidAdminAction();
    const parsed = parseInput(revokeEventSchema, {
      event_id: text(form, "event_id"),
      reason: text(form, "reason"),
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    await adminRevokeEvent(admin, parsed.value.event_id, parsed.value.reason);
    revalidatePath(`${ADMIN}/signalements`);
    return ok();
  });
}
