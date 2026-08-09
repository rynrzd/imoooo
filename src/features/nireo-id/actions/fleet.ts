"use server";

import { revalidatePath } from "next/cache";
import { MANAGING_ROLES, type FleetStatus } from "../constants";
import { planHasEntitlement } from "../plans";
import { assignSchema, endAssignmentSchema, fleetStatusSchema } from "../schemas";
import type { ActionResult } from "../types";
import {
  assignAsset,
  csvTemplate,
  endAssignment,
  importCsv,
  previewCsv,
  updateFleetStatus,
  type CsvImportResult,
  type CsvPreview,
} from "../server/fleet";
import { requireNidUser } from "../server/guards";
import { requireWorkspaceRole } from "../server/workspaces";
import { bool, fail, file, ok, parseInput, run, text } from "./helpers";

/**
 * Server Actions du parc d'entreprise.
 *
 * Le rôle est revérifié en base à chaque action (`requireWorkspaceRole`),
 * puis une seconde fois à l'intérieur des fonctions SQL atomiques.
 */

function fleetPath(workspaceId: string, sub = ""): string {
  return `/id/entreprise/${workspaceId}${sub}`;
}

/* ------------------------------------------------------------------ */
/*  Affectations                                                       */
/* ------------------------------------------------------------------ */

export async function assignAssetAction(form: FormData): Promise<ActionResult> {
  return run("fleet/assign", async () => {
    const session = await requireNidUser();
    const parsed = parseInput(assignSchema, {
      asset_id: text(form, "asset_id"),
      workspace_id: text(form, "workspace_id"),
      holder_name: text(form, "holder_name"),
      holder_email: text(form, "holder_email"),
      kind: text(form, "kind") || "affectation",
      started_on: text(form, "started_on"),
      note: text(form, "note"),
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    await requireWorkspaceRole(session.user.id, parsed.value.workspace_id, MANAGING_ROLES);

    await assignAsset(session.user.id, {
      asset_id: parsed.value.asset_id,
      workspace_id: parsed.value.workspace_id,
      holder_name: parsed.value.holder_name,
      holder_email: parsed.value.holder_email,
      kind: parsed.value.kind,
      started_on: parsed.value.started_on || undefined,
      note: parsed.value.note,
    });

    revalidatePath(fleetPath(parsed.value.workspace_id, "/parc"));
    revalidatePath(fleetPath(parsed.value.workspace_id, "/affectations"));
    return ok();
  });
}

export async function endAssignmentAction(form: FormData): Promise<ActionResult> {
  return run("fleet/end-assignment", async () => {
    const session = await requireNidUser();
    const workspaceId = text(form, "workspace_id");
    const parsed = parseInput(endAssignmentSchema, {
      assignment_id: text(form, "assignment_id"),
      fleet_status: text(form, "fleet_status") || "en_stock",
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    await requireWorkspaceRole(session.user.id, workspaceId, MANAGING_ROLES);
    await endAssignment(
      session.user.id,
      parsed.value.assignment_id,
      parsed.value.fleet_status as FleetStatus
    );

    revalidatePath(fleetPath(workspaceId, "/parc"));
    revalidatePath(fleetPath(workspaceId, "/affectations"));
    return ok();
  });
}

/* ------------------------------------------------------------------ */
/*  Statut de parc                                                     */
/* ------------------------------------------------------------------ */

export async function updateFleetStatusAction(form: FormData): Promise<ActionResult> {
  return run("fleet/status", async () => {
    const session = await requireNidUser();
    const workspaceId = text(form, "workspace_id");
    const parsed = parseInput(fleetStatusSchema, {
      asset_id: text(form, "asset_id"),
      fleet_status: text(form, "fleet_status"),
      internal_reference: text(form, "internal_reference"),
      warranty_end: text(form, "warranty_end"),
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    await requireWorkspaceRole(session.user.id, workspaceId, MANAGING_ROLES);
    await updateFleetStatus(session.user.id, workspaceId, parsed.value.asset_id, {
      fleet_status: parsed.value.fleet_status,
      internal_reference: parsed.value.internal_reference,
      warranty_end: parsed.value.warranty_end || null,
    });

    revalidatePath(fleetPath(workspaceId, "/parc"));
    return ok();
  });
}

/* ------------------------------------------------------------------ */
/*  Import CSV                                                         */
/* ------------------------------------------------------------------ */

async function readCsv(form: FormData): Promise<string | null> {
  const upload = file(form, "fichier");
  if (!upload) return null;
  if (upload.size > 2 * 1024 * 1024) {
    throw new Error("Fichier trop volumineux : 2 Mo maximum.");
  }
  return upload.text();
}

export async function previewCsvAction(form: FormData): Promise<ActionResult<CsvPreview>> {
  return run("fleet/csv-preview", async () => {
    const session = await requireNidUser();
    const workspaceId = text(form, "workspace_id");
    const context = await requireWorkspaceRole(session.user.id, workspaceId, MANAGING_ROLES);

    if (!planHasEntitlement(context.workspace.plan, "import_csv")) {
      return fail(
        "L'import CSV est inclus à partir de l'offre Entreprise Équipe. " +
          "Vous pouvez ajouter les téléphones un par un avec votre offre actuelle."
      );
    }

    const content = await readCsv(form);
    if (!content) return fail("Sélectionnez un fichier CSV.", "fichier");

    const preview = await previewCsv(workspaceId, content);
    if (preview.rows.length === 0) return fail("Ce fichier ne contient aucune ligne exploitable.");
    return ok(preview);
  });
}

export async function importCsvAction(form: FormData): Promise<ActionResult<CsvImportResult>> {
  return run("fleet/csv-import", async () => {
    const session = await requireNidUser();
    const workspaceId = text(form, "workspace_id");
    const context = await requireWorkspaceRole(session.user.id, workspaceId, MANAGING_ROLES);

    if (!planHasEntitlement(context.workspace.plan, "import_csv")) {
      return fail("L'import CSV est inclus à partir de l'offre Entreprise Équipe.");
    }
    if (!bool(form, "confirm")) {
      return fail("Confirmez l'import après avoir vérifié l'aperçu.");
    }

    const content = await readCsv(form);
    if (!content) return fail("Sélectionnez un fichier CSV.", "fichier");

    const result = await importCsv(session.user.id, workspaceId, content);
    revalidatePath(fleetPath(workspaceId, "/parc"));
    return ok(result);
  });
}

/** Modèle de fichier — aucune donnée réelle, aucun compte concerné. */
export async function csvTemplateAction(): Promise<ActionResult<{ content: string }>> {
  return run("fleet/csv-template", async () => {
    await requireNidUser();
    return ok({ content: csvTemplate() });
  });
}
