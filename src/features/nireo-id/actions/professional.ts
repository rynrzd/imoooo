"use server";

import { revalidatePath } from "next/cache";
import {
  proAccessRequestSchema,
  proEventSchema,
  professionalApplicationSchema,
  revokeEventSchema,
} from "../schemas";
import type { ActionResult } from "../types";
import { revokeEventAsProfessional } from "../server/events";
import { requireApprovedProfessional, requireNidUser } from "../server/guards";
import {
  addProfessionalEvent,
  requestAccessByPublicId,
  submitApplication,
} from "../server/professionals";
import { bool, fail, file, files, numberOrNull, ok, parseInput, run, text } from "./helpers";

/**
 * Server Actions de l'espace PROFESSIONNEL.
 *
 * Le statut du compte est revérifié à chaque action, puis une seconde fois
 * en base dans `nid_pro_add_event` : un compte en attente, refusé ou
 * suspendu ne peut jamais produire un événement « validé par un
 * professionnel ».
 */

const PRO = "/id/pro";

export async function submitApplicationAction(form: FormData): Promise<ActionResult> {
  return run("pro/application", async () => {
    const session = await requireNidUser();
    const parsed = parseInput(professionalApplicationSchema, {
      trade_name: text(form, "trade_name"),
      legal_name: text(form, "legal_name"),
      siret: text(form, "siret"),
      address: text(form, "address"),
      postal_code: text(form, "postal_code"),
      city: text(form, "city"),
      manager_name: text(form, "manager_name"),
      contact_email: text(form, "contact_email"),
      contact_phone: text(form, "contact_phone"),
      activity: text(form, "activity"),
      accept_rules: bool(form, "accept_rules"),
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    await submitApplication(session.user.id, parsed.value);
    revalidatePath(PRO);
    revalidatePath(`${PRO}/candidature`);
    return ok();
  });
}

export async function requestAccessAction(
  form: FormData
): Promise<ActionResult<{ state: string }>> {
  return run("pro/request-access", async () => {
    const session = await requireNidUser();
    const parsed = parseInput(proAccessRequestSchema, {
      public_id: text(form, "public_id"),
      message: text(form, "message"),
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    const result = await requestAccessByPublicId(
      session.user.id,
      parsed.value.public_id,
      parsed.value.message
    );
    if (result.state === "introuvable") {
      return fail(
        "Aucun passeport actif ne correspond à cet identifiant. Vérifiez la saisie auprès du client."
      );
    }
    if (result.state === "deja_en_cours") {
      return fail("Une demande est déjà en cours pour ce passeport.");
    }

    revalidatePath(PRO);
    return ok({ state: result.state });
  });
}

export async function addProEventAction(form: FormData): Promise<ActionResult> {
  return run("pro/add-event", async () => {
    const session = await requireNidUser();
    const parsed = parseInput(proEventSchema, {
      asset_id: text(form, "asset_id"),
      type: text(form, "type"),
      effective_date: text(form, "effective_date"),
      title: text(form, "title"),
      diagnostic: text(form, "diagnostic"),
      parts: text(form, "parts"),
      parts_origin: text(form, "parts_origin"),
      warranty_months: numberOrNull(form, "warranty_months"),
      cost_euros: numberOrNull(form, "cost_euros"),
      owner_comment: text(form, "owner_comment"),
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    await addProfessionalEvent(session.user.id, parsed.value, {
      photos: files(form, "photos"),
      report: file(form, "report"),
    });

    revalidatePath(`${PRO}/objets/${parsed.value.asset_id}`);
    return ok();
  });
}

export async function revokeProEventAction(form: FormData): Promise<ActionResult> {
  return run("pro/revoke-event", async () => {
    const session = await requireNidUser();
    const professional = await requireApprovedProfessional(session.user.id);
    const parsed = parseInput(revokeEventSchema, {
      event_id: text(form, "event_id"),
      reason: text(form, "reason"),
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    await revokeEventAsProfessional(
      session.user.id,
      professional.id,
      parsed.value.event_id,
      parsed.value.reason
    );
    revalidatePath(`${PRO}/objets/${text(form, "asset_id")}`);
    return ok();
  });
}
