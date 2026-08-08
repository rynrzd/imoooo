import type { z } from "zod";
import { logger } from "@/lib/logger";
import { SITE_URL } from "@/lib/supabase/config";
import { PRO_ACCESS_DAYS } from "../constants";
import type {
  proEventSchema,
  professionalApplicationSchema,
} from "../schemas";
import type {
  AssetRow,
  EventRow,
  ProfessionalAccessRow,
  ProfessionalProfileRow,
} from "../types";
import { dbErrorMessage, isNireoIdConfigured, nidService, nidUserClient } from "./client";
import { recordNidAudit } from "./audit";
import { notifyProfessionalInvitation } from "./emails";
import { requireApprovedProfessional } from "./guards";
import { nidSignedUrlMap, removeNidFiles, uploadNidFile } from "./storage";

/**
 * Espace professionnel.
 *
 * Deux garde-fous permanents :
 *  • un professionnel ne peut JAMAIS parcourir la base — il n'accède à un
 *    passeport que via une autorisation explicite du propriétaire ;
 *  • un compte non approuvé (brouillon, en attente, refusé, suspendu) ne
 *    peut créer aucun événement « validé par un professionnel » : la
 *    vérification est faite en base, dans `nid_pro_add_event`.
 */

type ApplicationInput = z.infer<typeof professionalApplicationSchema>;
type ProEventInput = z.infer<typeof proEventSchema>;

/* ------------------------------------------------------------------ */
/*  Candidature                                                        */
/* ------------------------------------------------------------------ */

export async function submitApplication(
  userId: string,
  input: ApplicationInput
): Promise<ProfessionalProfileRow> {
  const supabase = await nidUserClient();

  const { data: existing } = await supabase
    .from("nid_professional_profiles")
    .select("id, status")
    .eq("user_id", userId)
    .maybeSingle();

  const row = {
    trade_name: input.trade_name,
    legal_name: input.legal_name,
    siret: input.siret,
    address: input.address,
    postal_code: input.postal_code,
    city: input.city,
    manager_name: input.manager_name,
    contact_email: input.contact_email,
    contact_phone: input.contact_phone,
    activity: input.activity,
    rules_accepted_at: new Date().toISOString(),
    status: "en_attente" as const,
  };

  const current = existing as { id: string; status: string } | null;
  if (current && !["brouillon", "en_attente", "refuse"].includes(current.status)) {
    throw new Error(
      "Votre compte professionnel est déjà validé ou suspendu : contactez l'équipe Nireo pour toute modification."
    );
  }

  const query = current
    ? supabase.from("nid_professional_profiles").update(row).eq("id", current.id).select("*").single()
    : supabase
        .from("nid_professional_profiles")
        .insert({ ...row, user_id: userId })
        .select("*")
        .single();

  const { data, error } = await query;
  if (error || !data) {
    throw new Error(dbErrorMessage(error, "L'enregistrement de la candidature a échoué."));
  }

  await recordNidAudit({
    actorUserId: userId,
    actorRole: "professionnel",
    action: current ? "professional.application_updated" : "professional.application_submitted",
    targetType: "professional",
    targetId: (data as ProfessionalProfileRow).id,
  });

  return data as ProfessionalProfileRow;
}

/* ------------------------------------------------------------------ */
/*  Accès aux passeports                                               */
/* ------------------------------------------------------------------ */

export interface ProAccessItem extends ProfessionalAccessRow {
  asset: Pick<AssetRow, "id" | "public_id" | "brand" | "model" | "color">;
}

/** Passeports auxquels le professionnel a accès (ou en attente d'accord). */
export async function listProfessionalAccess(
  professionalId: string
): Promise<ProAccessItem[]> {
  if (!isNireoIdConfigured) return [];
  const { data, error } = await nidService()
    .from("nid_professional_access")
    .select(
      "*, asset:nid_assets (id, public_id, brand, model, color)"
    )
    .eq("professional_id", professionalId)
    .in("status", ["en_attente", "accorde"])
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("nireo-id/pro access list", error);
    return [];
  }
  return (data ?? []) as ProAccessItem[];
}

/**
 * Le professionnel saisit un identifiant Nireo : cela ne lui ouvre RIEN.
 * Une demande est créée et le propriétaire doit l'accorder.
 */
export async function requestAccessByPublicId(
  userId: string,
  publicId: string,
  message: string
): Promise<{ state: "demande_creee" | "deja_en_cours" | "introuvable" }> {
  const professional = await requireApprovedProfessional(userId);
  const service = nidService();

  const { data: asset } = await service
    .from("nid_assets")
    .select("id, status")
    .eq("public_id", publicId)
    .maybeSingle();
  // Réponse volontairement identique qu'il existe ou non : un professionnel
  // ne doit pas pouvoir énumérer les identifiants valides.
  if (!asset || (asset as { status: string }).status === "archived") {
    return { state: "introuvable" };
  }
  const assetId = (asset as { id: string }).id;

  const { data: existing } = await service
    .from("nid_professional_access")
    .select("id")
    .eq("asset_id", assetId)
    .eq("professional_id", professional.id)
    .in("status", ["en_attente", "accorde"])
    .maybeSingle();
  if (existing) return { state: "deja_en_cours" };

  const { error } = await service.from("nid_professional_access").insert({
    asset_id: assetId,
    professional_id: professional.id,
    requested_by: userId,
    source: "demande_identifiant",
    scope: "intervention",
    status: "en_attente",
    message: message.slice(0, 500),
    expires_at: new Date(Date.now() + PRO_ACCESS_DAYS * 86400 * 1000).toISOString(),
  });
  if (error) throw new Error(dbErrorMessage(error, "La demande d'accès a échoué."));

  await recordNidAudit({
    actorUserId: userId,
    actorRole: "professionnel",
    action: "professional.access_requested",
    targetType: "asset",
    targetId: assetId,
    assetId,
  });

  return { state: "demande_creee" };
}

/** Décision du PROPRIÉTAIRE sur une demande d'accès professionnel. */
export async function decideAccess(
  userId: string,
  accessId: string,
  decision: "accorde" | "refuse" | "revoque"
): Promise<void> {
  const supabase = await nidUserClient();

  // La RLS ne laisse voir que les accès de SES passeports : si la ligne
  // n'est pas visible ici, l'utilisateur n'a rien à décider.
  const { data: access } = await supabase
    .from("nid_professional_access")
    .select("id, asset_id, status")
    .eq("id", accessId)
    .maybeSingle();
  if (!access) throw new Error("Cette demande d'accès est introuvable.");

  const row = access as { id: string; asset_id: string; status: string };

  // Double vérification serveur : l'utilisateur est-il bien le propriétaire ?
  const { data: asset } = await supabase
    .from("nid_assets")
    .select("id")
    .eq("id", row.asset_id)
    .maybeSingle();
  if (!asset) throw new Error("Vous n'êtes pas le propriétaire de ce passeport.");

  const update =
    decision === "revoque"
      ? { status: "revoque", revoked_at: new Date().toISOString() }
      : { status: decision, granted_by: decision === "accorde" ? userId : null };

  const { error } = await nidService()
    .from("nid_professional_access")
    .update(update)
    .eq("id", accessId)
    .in("status", ["en_attente", "accorde"]);
  if (error) throw new Error(dbErrorMessage(error, "La décision n'a pas pu être enregistrée."));

  await recordNidAudit({
    actorUserId: userId,
    action: `professional.access_${decision}`,
    targetType: "professional_access",
    targetId: accessId,
    assetId: row.asset_id,
  });
}

/** Le propriétaire invite un professionnel approuvé sur son passeport. */
export async function inviteProfessional(
  userId: string,
  assetId: string,
  professionalEmail: string
): Promise<{ email_sent: boolean }> {
  const supabase = await nidUserClient();
  const { data: asset } = await supabase
    .from("nid_assets")
    .select("id, brand, model")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset) throw new Error("Ce passeport est introuvable ou ne vous appartient pas.");

  const service = nidService();
  const { data: professional } = await service
    .from("nid_professional_profiles")
    .select("id, contact_email, trade_name, status")
    .ilike("contact_email", professionalEmail)
    .eq("status", "approuve")
    .maybeSingle();

  if (!professional) {
    throw new Error(
      "Aucun compte professionnel approuvé n'utilise cette adresse. " +
        "Demandez au réparateur de créer son compte professionnel Nireo ID."
    );
  }
  const pro = professional as { id: string; contact_email: string; trade_name: string };

  const expiresAt = new Date(Date.now() + PRO_ACCESS_DAYS * 86400 * 1000).toISOString();

  // L'index unique « une seule autorisation vivante » est partiel : on lit
  // d'abord la ligne éventuelle plutôt que de tenter un upsert.
  const { data: live } = await service
    .from("nid_professional_access")
    .select("id")
    .eq("asset_id", assetId)
    .eq("professional_id", pro.id)
    .in("status", ["en_attente", "accorde"])
    .maybeSingle();

  const grant = {
    granted_by: userId,
    source: "invitation" as const,
    scope: "intervention" as const,
    status: "accorde" as const,
    expires_at: expiresAt,
    revoked_at: null,
  };

  const { error } = live
    ? await service
        .from("nid_professional_access")
        .update(grant)
        .eq("id", (live as { id: string }).id)
    : await service
        .from("nid_professional_access")
        .insert({ asset_id: assetId, professional_id: pro.id, ...grant });
  if (error) throw new Error(dbErrorMessage(error, "L'invitation a échoué."));

  const row = asset as { brand: string; model: string };
  const emailSent = await notifyProfessionalInvitation({
    to: pro.contact_email,
    deviceLabel: `${row.brand} ${row.model}`,
    url: `${SITE_URL}/id/pro`,
  });

  await recordNidAudit({
    actorUserId: userId,
    action: "professional.invited",
    targetType: "professional",
    targetId: pro.id,
    assetId,
    metadata: { email_sent: emailSent },
  });

  return { email_sent: emailSent };
}

/* ------------------------------------------------------------------ */
/*  Vue professionnelle d'un passeport                                 */
/* ------------------------------------------------------------------ */

export interface ProAssetView {
  access: ProfessionalAccessRow;
  asset: Pick<
    AssetRow,
    | "id"
    | "public_id"
    | "brand"
    | "model"
    | "color"
    | "storage_capacity"
    | "serial_last4"
    | "imei_last4"
    | "declared_condition"
    | "status"
  >;
  photo_url: string | null;
  events: EventRow[];
}

/**
 * Lecture d'un passeport par un professionnel autorisé.
 * Ne renvoie JAMAIS le numéro de série ni l'IMEI complets, ni les
 * documents privés du propriétaire.
 */
export async function getProAssetView(
  userId: string,
  assetId: string
): Promise<ProAssetView | null> {
  const professional = await requireApprovedProfessional(userId);
  const service = nidService();

  const { data: access } = await service
    .from("nid_professional_access")
    .select("*")
    .eq("asset_id", assetId)
    .eq("professional_id", professional.id)
    .eq("status", "accorde")
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!access) return null;

  const { data: asset } = await service
    .from("nid_assets")
    .select(
      "id, public_id, brand, model, color, storage_capacity, serial_last4, imei_last4, declared_condition, status, primary_image_path"
    )
    .eq("id", assetId)
    .maybeSingle();
  if (!asset) return null;

  const { data: events } = await service
    .from("nid_events")
    .select("*")
    .eq("asset_id", assetId)
    .order("effective_date", { ascending: false })
    .order("created_at", { ascending: false });

  const row = asset as ProAssetView["asset"] & { primary_image_path: string | null };
  const urls = await nidSignedUrlMap(row.primary_image_path ? [row.primary_image_path] : []);

  return {
    access: access as ProfessionalAccessRow,
    asset: row,
    photo_url: row.primary_image_path ? (urls.get(row.primary_image_path) ?? null) : null,
    events: (events ?? []) as EventRow[],
  };
}

/* ------------------------------------------------------------------ */
/*  Intervention                                                       */
/* ------------------------------------------------------------------ */

export interface ProEventFiles {
  photos: File[];
  report: File | null;
}

/**
 * Enregistre une intervention. Le niveau « Validé par un professionnel »
 * est posé par la fonction SQL, APRÈS re-vérification du statut du compte
 * et de l'autorisation sur cet objet précis.
 */
export async function addProfessionalEvent(
  userId: string,
  input: ProEventInput,
  files: ProEventFiles
): Promise<{ event_id: string }> {
  await requireApprovedProfessional(userId);
  const supabase = await nidUserClient();
  const uploaded: string[] = [];

  try {
    const mediaPayload: { storage_path: string; caption: string; position: number }[] = [];
    const documentPayload: {
      kind: string;
      storage_path: string;
      original_name: string;
      mime_type: string;
      size_bytes: number;
    }[] = [];

    for (const [index, photo] of files.photos.slice(0, 6).entries()) {
      const file = await uploadNidFile(supabase, userId, input.asset_id, "media", photo);
      uploaded.push(file.storage_path);
      mediaPayload.push({ storage_path: file.storage_path, caption: "", position: index });
    }
    if (files.report) {
      const file = await uploadNidFile(supabase, userId, input.asset_id, "documents", files.report);
      uploaded.push(file.storage_path);
      documentPayload.push({
        kind: "rapport",
        storage_path: file.storage_path,
        original_name: file.original_name,
        mime_type: file.mime_type,
        size_bytes: file.size_bytes,
      });
    }

    const { data, error } = await nidService().rpc("nid_pro_add_event", {
      p_user_id: userId,
      p_asset_id: input.asset_id,
      p_payload: {
        type: input.type,
        effective_date: input.effective_date,
        title: input.title,
        description: input.diagnostic,
        cost_cents:
          input.cost_euros === null || input.cost_euros === undefined
            ? ""
            : String(Math.round(input.cost_euros * 100)),
        metadata: {
          parts: input.parts,
          parts_origin: input.parts_origin,
          warranty_months: input.warranty_months ?? null,
          owner_comment: input.owner_comment,
        },
        media: mediaPayload,
        documents: documentPayload,
      },
    });

    if (error) throw new Error(dbErrorMessage(error, "L'enregistrement de l'intervention a échoué."));

    const result = data as { state: string; event_id?: string };
    if (result.state === "pro_non_approuve") {
      throw new Error("Votre compte professionnel n'est pas approuvé.");
    }
    if (result.state === "acces_refuse") {
      throw new Error(
        "Vous n'avez pas (ou plus) l'autorisation du propriétaire sur ce passeport."
      );
    }
    return { event_id: result.event_id as string };
  } catch (error) {
    // Rien n'a été écrit dans l'historique : on retire les fichiers envoyés.
    await removeNidFiles(uploaded);
    throw error;
  }
}
