import { logger } from "@/lib/logger";
import {
  CSV_COLUMNS,
  MAX_CSV_ROWS,
  type FleetStatus,
  type HealthState,
} from "../constants";
import { fingerprint, last4, normalizeIdentifier } from "../identifiers";
import { nidPlan } from "../plans";
import { csvRowSchema, type CsvRowInput } from "../schemas";
import type { AssignmentRow, FleetItem, WorkspaceContext } from "../types";
import { recordNidAudit } from "./audit";
import { dbErrorMessage, isNireoIdConfigured, isSchemaMissing, nidService } from "./client";

/**
 * Parc d'entreprise : téléphones, affectations et import.
 *
 * Le détenteur n'est JAMAIS le propriétaire : une affectation ou un retour
 * ne modifie aucune ligne de `nid_ownerships`. Toutes les écritures
 * sensibles passent par des fonctions SQL atomiques.
 */

/* ------------------------------------------------------------------ */
/*  Lecture du parc                                                    */
/* ------------------------------------------------------------------ */

export async function listFleet(workspaceId: string): Promise<FleetItem[]> {
  if (!isNireoIdConfigured) return [];
  const service = nidService();

  const { data, error } = await service
    .from("nid_assets")
    .select(
      "id, public_id, brand, model, color, internal_reference, serial_last4, imei_last4, fleet_status, health_state, warranty_end, status"
    )
    .eq("workspace_id", workspaceId)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  if (error) {
    if (!isSchemaMissing(error)) logger.error("nireo-id/fleet list", error);
    return [];
  }

  const rows = (data ?? []) as {
    id: string;
    public_id: string;
    brand: string;
    model: string;
    color: string;
    internal_reference: string;
    serial_last4: string;
    imei_last4: string;
    fleet_status: FleetStatus;
    health_state: HealthState;
    warranty_end: string | null;
  }[];
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const [{ data: assignments }, { data: schedules }, { data: checkups }] = await Promise.all([
    service
      .from("nid_assignments")
      .select("id, asset_id, holder_name, holder_email")
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .in("asset_id", ids),
    service.from("nid_check_schedules").select("asset_id, next_due_on").in("asset_id", ids),
    service
      .from("nid_checkups")
      .select("asset_id, answered_at")
      .in("asset_id", ids)
      .order("answered_at", { ascending: false }),
  ]);

  const holderByAsset = new Map<string, { id: string; name: string; email: string }>();
  for (const item of (assignments ?? []) as {
    id: string;
    asset_id: string;
    holder_name: string;
    holder_email: string;
  }[]) {
    holderByAsset.set(item.asset_id, {
      id: item.id,
      name: item.holder_name,
      email: item.holder_email,
    });
  }

  const nextByAsset = new Map<string, string>();
  for (const item of (schedules ?? []) as { asset_id: string; next_due_on: string }[]) {
    nextByAsset.set(item.asset_id, item.next_due_on);
  }

  const lastByAsset = new Map<string, string>();
  for (const item of (checkups ?? []) as { asset_id: string; answered_at: string }[]) {
    if (!lastByAsset.has(item.asset_id)) lastByAsset.set(item.asset_id, item.answered_at);
  }

  const today = new Date().toISOString().slice(0, 10);

  return rows.map((row) => {
    const holder = holderByAsset.get(row.id) ?? null;
    const next = nextByAsset.get(row.id) ?? null;
    return {
      id: row.id,
      public_id: row.public_id,
      brand: row.brand,
      model: row.model,
      color: row.color,
      internal_reference: row.internal_reference,
      serial_last4: row.serial_last4,
      imei_last4: row.imei_last4,
      fleet_status: row.fleet_status,
      health_state: row.health_state,
      warranty_end: row.warranty_end,
      holder_label: holder?.name || holder?.email || null,
      holder_email: holder?.email || null,
      assignment_id: holder?.id ?? null,
      last_checkup_at: lastByAsset.get(row.id) ?? null,
      next_check_on: next,
      check_overdue: Boolean(next && next < today),
    };
  });
}

export interface FleetSummary {
  total: number;
  assigned: number;
  problems: number;
  overdue: number;
  in_repair: number;
  warranty_soon: number;
  quota_max: number | null;
}

export async function getFleetSummary(context: WorkspaceContext): Promise<FleetSummary> {
  const items = await listFleet(context.workspace.id);
  const plan = nidPlan(context.workspace.plan);
  const soon = new Date();
  soon.setDate(soon.getDate() + 60);
  const soonISO = soon.toISOString().slice(0, 10);

  return {
    total: items.length,
    assigned: items.filter((item) => item.fleet_status === "affecte" || item.fleet_status === "prete")
      .length,
    problems: items.filter((item) => item.health_state === "probleme_declare").length,
    overdue: items.filter((item) => item.check_overdue).length,
    in_repair: items.filter((item) => item.fleet_status === "en_reparation").length,
    warranty_soon: items.filter(
      (item) => item.warranty_end !== null && item.warranty_end <= soonISO
    ).length,
    quota_max: plan.maxAssets,
  };
}

/* ------------------------------------------------------------------ */
/*  Affectations                                                       */
/* ------------------------------------------------------------------ */

export async function listAssignments(
  workspaceId: string,
  assetId?: string
): Promise<AssignmentRow[]> {
  if (!isNireoIdConfigured) return [];
  let query = nidService()
    .from("nid_assignments")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("started_on", { ascending: false })
    .limit(200);
  if (assetId) query = query.eq("asset_id", assetId);
  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as AssignmentRow[];
}

export async function assignAsset(
  userId: string,
  input: {
    asset_id: string;
    workspace_id: string;
    holder_user_id?: string | null;
    holder_name: string;
    holder_email: string;
    kind: "affectation" | "pret";
    started_on?: string;
    note: string;
  }
): Promise<void> {
  const { data, error } = await nidService().rpc("nid_assign_asset", {
    p_actor_id: userId,
    p_asset_id: input.asset_id,
    p_workspace_id: input.workspace_id,
    p_payload: {
      holder_user_id: input.holder_user_id ?? "",
      holder_name: input.holder_name,
      holder_email: input.holder_email,
      kind: input.kind,
      started_on: input.started_on ?? "",
      note: input.note,
    },
  });
  if (error) throw new Error(dbErrorMessage(error, "L'affectation a échoué."));

  const result = data as { state: string };
  if (result.state === "non_autorise") {
    throw new Error("Votre rôle ne permet pas d'affecter un téléphone.");
  }
  if (result.state === "telephone_introuvable") {
    throw new Error("Ce téléphone n'appartient pas à cet espace.");
  }
  if (result.state === "detenteur_manquant") {
    throw new Error("Indiquez le nom du détenteur.");
  }
}

export async function endAssignment(
  userId: string,
  assignmentId: string,
  fleetStatus: FleetStatus
): Promise<void> {
  const { data, error } = await nidService().rpc("nid_end_assignment", {
    p_actor_id: userId,
    p_assignment_id: assignmentId,
    p_fleet_status: fleetStatus,
  });
  if (error) throw new Error(dbErrorMessage(error, "Le retour n'a pas pu être enregistré."));
  const result = data as { state: string };
  if (result.state === "non_autorise") {
    throw new Error("Votre rôle ne permet pas cette action.");
  }
  if (result.state === "introuvable") throw new Error("Affectation introuvable.");
}

/* ------------------------------------------------------------------ */
/*  Statut de parc                                                     */
/* ------------------------------------------------------------------ */

export async function updateFleetStatus(
  userId: string,
  workspaceId: string,
  assetId: string,
  values: { fleet_status: FleetStatus; internal_reference: string; warranty_end: string | null }
): Promise<void> {
  const service = nidService();
  const { data: member } = await service
    .from("nid_workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("status", "actif")
    .maybeSingle();
  const role = (member as { role: string } | null)?.role;
  if (!role || !["owner", "admin", "manager"].includes(role)) {
    throw new Error("Votre rôle ne permet pas de modifier le parc.");
  }

  const { data, error } = await service
    .from("nid_assets")
    .update(values)
    .eq("id", assetId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error) throw new Error(dbErrorMessage(error, "La mise à jour a échoué."));
  if (((data ?? []) as unknown[]).length === 0) {
    throw new Error("Ce téléphone n'appartient pas à cet espace.");
  }

  await recordNidAudit({
    actorUserId: userId,
    action: "fleet.status_updated",
    targetType: "asset",
    targetId: assetId,
    assetId,
    metadata: { fleet_status: values.fleet_status },
  });
}

/* ------------------------------------------------------------------ */
/*  Import CSV                                                         */
/* ------------------------------------------------------------------ */

export interface CsvPreviewRow {
  line: number;
  raw: Record<string, string>;
  value: CsvRowInput | null;
  error: string | null;
  duplicate: boolean;
}

export interface CsvPreview {
  rows: CsvPreviewRow[];
  valid: number;
  invalid: number;
  duplicates: number;
}

/** Sépare une ligne CSV en respectant les guillemets. */
function splitCsvLine(line: string, separator: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === separator && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function toNumber(value: string): number | null {
  const cleaned = value.replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Analyse un fichier CSV SANS rien écrire : l'entreprise voit d'abord les
 * lignes valides, invalides et les doublons, puis confirme.
 */
export async function previewCsv(workspaceId: string, content: string): Promise<CsvPreview> {
  const lines = content
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");

  if (lines.length === 0) {
    return { rows: [], valid: 0, invalid: 0, duplicates: 0 };
  }

  const separator = lines[0].includes(";") ? ";" : ",";
  const header = splitCsvLine(lines[0], separator).map((cell) =>
    cell
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
  );

  const service = nidService();
  const rows: CsvPreviewRow[] = [];
  const seenFingerprints = new Set<string>();

  for (const [index, line] of lines.slice(1, MAX_CSV_ROWS + 1).entries()) {
    const cells = splitCsvLine(line, separator);
    const raw: Record<string, string> = {};
    header.forEach((key, position) => {
      if ((CSV_COLUMNS as readonly string[]).includes(key)) raw[key] = cells[position] ?? "";
    });

    const parsed = csvRowSchema.safeParse({
      ...raw,
      prix_euros: toNumber(raw.prix_euros ?? ""),
      type_achat: raw.type_achat || "inconnu",
    });

    if (!parsed.success) {
      rows.push({
        line: index + 2,
        raw,
        value: null,
        error: parsed.error.issues[0]?.message ?? "Ligne invalide.",
        duplicate: false,
      });
      continue;
    }

    // Doublon : dans le fichier lui-même ou déjà enregistré (l'empreinte
    // ne révèle jamais l'identifiant en clair).
    const identifier = normalizeIdentifier(parsed.data.imei || parsed.data.numero_serie);
    let duplicate = false;
    if (identifier) {
      const fp = fingerprint(identifier);
      if (fp) {
        if (seenFingerprints.has(fp)) {
          duplicate = true;
        } else {
          seenFingerprints.add(fp);
          const { count } = await service
            .from("nid_assets")
            .select("id", { count: "exact", head: true })
            .or(`serial_fingerprint.eq.${fp},imei_fingerprint.eq.${fp}`)
            .neq("status", "archived");
          duplicate = (count ?? 0) > 0;
        }
      }
    }

    rows.push({
      line: index + 2,
      raw,
      value: parsed.data,
      error: null,
      duplicate,
    });
  }

  return {
    rows,
    valid: rows.filter((row) => row.value && !row.duplicate).length,
    invalid: rows.filter((row) => row.error).length,
    duplicates: rows.filter((row) => row.duplicate).length,
  };
}

export interface CsvImportResult {
  created: number;
  skipped: number;
  errors: { line: number; message: string }[];
}

/** Écrit les lignes valides, une par une, sans jamais s'arrêter au premier échec. */
export async function importCsv(
  userId: string,
  workspaceId: string,
  content: string
): Promise<CsvImportResult> {
  const preview = await previewCsv(workspaceId, content);
  const service = nidService();
  const result: CsvImportResult = { created: 0, skipped: 0, errors: [] };

  for (const row of preview.rows) {
    if (!row.value || row.duplicate) {
      result.skipped += 1;
      if (row.error) result.errors.push({ line: row.line, message: row.error });
      else if (row.duplicate) {
        result.errors.push({ line: row.line, message: "Doublon : téléphone déjà enregistré." });
      }
      continue;
    }

    const value = row.value;
    const assetId = crypto.randomUUID();
    const serial = normalizeIdentifier(value.numero_serie);
    const imei = normalizeIdentifier(value.imei);

    const { error } = await service.rpc("nid_create_asset_v2", {
      p_owner_id: userId,
      p_asset_id: assetId,
      p_workspace_id: workspaceId,
      p_payload: {
        brand: value.marque,
        model: value.modele,
        color: value.couleur,
        storage_capacity: value.capacite,
        serial_number: serial,
        serial_fingerprint: fingerprint(serial),
        serial_last4: last4(serial),
        imei,
        imei_fingerprint: fingerprint(imei),
        imei_last4: last4(imei),
        purchase_date: value.date_achat || null,
        purchase_source: "",
        purchase_condition: value.type_achat,
        internal_reference: value.reference_interne,
        warranty_end: value.fin_garantie || "",
        fleet_status: value.detenteur_nom || value.detenteur_email ? "affecte" : "en_stock",
        media: [],
        documents: [],
      },
    });

    if (error) {
      result.skipped += 1;
      result.errors.push({
        line: row.line,
        message: dbErrorMessage(error, "Création impossible."),
      });
      continue;
    }

    result.created += 1;

    if (value.detenteur_nom || value.detenteur_email) {
      try {
        await assignAsset(userId, {
          asset_id: assetId,
          workspace_id: workspaceId,
          holder_name: value.detenteur_nom || value.detenteur_email,
          holder_email: value.detenteur_email,
          kind: "affectation",
          note: "Importé depuis un fichier",
        });
      } catch (error) {
        logger.error("nireo-id/fleet import-assign", error);
      }
    }
  }

  await recordNidAudit({
    actorUserId: userId,
    action: "fleet.imported",
    targetType: "workspace",
    targetId: workspaceId,
    metadata: { created: result.created, skipped: result.skipped },
  });

  return result;
}

/** Modèle de fichier proposé au téléchargement (aucune donnée réelle). */
export function csvTemplate(): string {
  return (
    `${CSV_COLUMNS.join(";")}\n` +
    "Apple;iPhone 15;128 Go;Noir;;;PARC-001;2025-03-14;;neuf;2027-03-14;;\n"
  );
}
