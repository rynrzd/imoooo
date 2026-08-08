/**
 * Nireo ID — schémas de validation partagés (Zod).
 *
 * Toute mutation est validée CÔTÉ SERVEUR avec ces schémas, y compris
 * lorsque le formulaire client valide déjà : le navigateur n'est jamais
 * une source de confiance.
 */

import { z } from "zod";
import {
  CONDITION_GRADES,
  CONDITION_POINTS,
  DISPUTE_REASONS,
  DOCUMENT_KINDS,
  EVENT_TYPES,
  OWNER_EVENT_TYPES,
  PRO_ACTIVITIES,
  PRO_EVENT_TYPES,
  PUBLIC_ID_PATTERN,
  PURCHASE_CONDITIONS,
  SHARE_SECTIONS,
  TRANSFER_POLICIES,
} from "./constants";

const trimmed = (max: number) => z.string().trim().max(max);

/** Date ISO `YYYY-MM-DD` réellement valide (et pas dans un futur absurde). */
const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (format attendu : JJ/MM/AAAA).")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Date invalide.")
  .refine((value) => {
    const year = Number(value.slice(0, 4));
    return year >= 1990 && year <= new Date().getFullYear() + 1;
  }, "Date hors période plausible.");

export const publicIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(PUBLIC_ID_PATTERN, "Identifiant Nireo invalide (format NIR-PH-XXXX-XXXX).");

/* ------------------------------------------------------------------ */
/*  Création d'un passeport                                            */
/* ------------------------------------------------------------------ */

export const declaredConditionSchema = z.object({
  ...Object.fromEntries(
    CONDITION_POINTS.map((point) => [point.key, z.enum(CONDITION_GRADES).optional()])
  ),
  battery_health: z
    .number()
    .int("Pourcentage entier attendu.")
    .min(1, "Entre 1 et 100 %.")
    .max(100, "Entre 1 et 100 %.")
    .nullable()
    .optional(),
  comment: trimmed(1000).optional(),
});

export const createAssetSchema = z.object({
  brand: z.string().trim().min(1, "Marque requise.").max(60, "60 caractères maximum."),
  model: z.string().trim().min(1, "Modèle requis.").max(80, "80 caractères maximum."),
  color: trimmed(40).optional().default(""),
  storage_capacity: trimmed(20).optional().default(""),
  serial_number: trimmed(64).optional().default(""),
  imei: trimmed(32).optional().default(""),
  purchase_date: isoDate.optional().or(z.literal("")),
  purchase_source: trimmed(120).optional().default(""),
  purchase_condition: z.enum(PURCHASE_CONDITIONS).default("inconnu"),
  declared_condition: declaredConditionSchema.optional(),
  consent_accuracy: z
    .boolean()
    .refine((v) => v === true, "Confirmez l'exactitude des informations déclarées."),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;

/* ------------------------------------------------------------------ */
/*  Édition d'un passeport                                             */
/* ------------------------------------------------------------------ */

export const updateAssetSchema = z.object({
  asset_id: z.string().uuid(),
  brand: z.string().trim().min(1, "Marque requise.").max(60),
  model: z.string().trim().min(1, "Modèle requis.").max(80),
  color: trimmed(40).default(""),
  storage_capacity: trimmed(20).default(""),
  purchase_date: isoDate.optional().or(z.literal("")),
  purchase_source: trimmed(120).default(""),
  purchase_condition: z.enum(PURCHASE_CONDITIONS),
});

export const publicVisibilitySchema = z.object({
  asset_id: z.string().uuid(),
  public_show_photo: z.boolean(),
  public_show_purchase_year: z.boolean(),
  public_show_serial_last4: z.boolean(),
});

/* ------------------------------------------------------------------ */
/*  Événements                                                         */
/* ------------------------------------------------------------------ */

export const ownerEventSchema = z.object({
  asset_id: z.string().uuid(),
  type: z.enum(EVENT_TYPES).refine(
    (value) => (OWNER_EVENT_TYPES as string[]).includes(value),
    "Ce type d'événement ne peut pas être déclaré manuellement."
  ),
  effective_date: isoDate,
  title: z.string().trim().min(2, "Titre requis.").max(140, "140 caractères maximum."),
  description: trimmed(2000).default(""),
  cost_euros: z
    .number()
    .min(0, "Montant positif attendu.")
    .max(100000, "Montant hors limite.")
    .nullable()
    .optional(),
  parts: trimmed(300).default(""),
});

export const proEventSchema = z.object({
  asset_id: z.string().uuid(),
  type: z.enum(EVENT_TYPES).refine(
    (value) => (PRO_EVENT_TYPES as string[]).includes(value),
    "Type d'intervention non pris en charge."
  ),
  effective_date: isoDate,
  title: z.string().trim().min(2, "Titre requis.").max(140),
  diagnostic: trimmed(2000).default(""),
  parts: trimmed(300).default(""),
  parts_origin: trimmed(160).default(""),
  warranty_months: z
    .number()
    .int("Nombre entier de mois attendu.")
    .min(0)
    .max(120, "120 mois maximum.")
    .nullable()
    .optional(),
  cost_euros: z.number().min(0).max(100000).nullable().optional(),
  owner_comment: trimmed(1000).default(""),
});

export const revokeEventSchema = z.object({
  event_id: z.string().uuid(),
  reason: z.string().trim().min(5, "Motif requis (5 caractères minimum).").max(500),
});

/* ------------------------------------------------------------------ */
/*  Documents                                                          */
/* ------------------------------------------------------------------ */

export const documentMetaSchema = z.object({
  asset_id: z.string().uuid(),
  kind: z.enum(DOCUMENT_KINDS),
  transfer_policy: z.enum(TRANSFER_POLICIES).default("prive"),
});

export const documentPolicySchema = z.object({
  document_id: z.string().uuid(),
  transfer_policy: z.enum(TRANSFER_POLICIES),
});

/* ------------------------------------------------------------------ */
/*  Partage privé                                                      */
/* ------------------------------------------------------------------ */

export const createShareSchema = z.object({
  asset_id: z.string().uuid(),
  label: trimmed(80).default(""),
  duration_hours: z.union([z.literal(24), z.literal(168), z.literal(720)]),
  sections: z
    .array(z.enum(SHARE_SECTIONS))
    .min(1, "Sélectionnez au moins une section à partager."),
  document_ids: z.array(z.string().uuid()).max(50).default([]),
  allow_download: z.boolean().default(false),
  show_serial_last4: z.boolean().default(false),
});

/* ------------------------------------------------------------------ */
/*  Transferts                                                         */
/* ------------------------------------------------------------------ */

export const createTransferSchema = z.object({
  asset_id: z.string().uuid(),
  recipient_email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Adresse e-mail invalide.")
    .max(160),
  document_policies: z.record(z.string().uuid(), z.enum(TRANSFER_POLICIES)).default({}),
  confirm: z
    .boolean()
    .refine((v) => v === true, "Confirmez que vous cédez ce passeport."),
});

/* ------------------------------------------------------------------ */
/*  Professionnels                                                     */
/* ------------------------------------------------------------------ */

export const professionalApplicationSchema = z.object({
  trade_name: z.string().trim().min(2, "Nom commercial requis.").max(120),
  legal_name: trimmed(120).default(""),
  siret: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s/g, ""))
    .refine(
      (value) => value === "" || /^\d{14}$/.test(value),
      "Le SIRET doit contenir 14 chiffres."
    )
    .default(""),
  address: trimmed(160).default(""),
  postal_code: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{5}$/.test(v), "Code postal invalide.")
    .default(""),
  city: trimmed(80).default(""),
  manager_name: z.string().trim().min(2, "Nom du responsable requis.").max(120),
  contact_email: z.string().trim().toLowerCase().email("Adresse e-mail invalide.").max(160),
  contact_phone: trimmed(30).default(""),
  activity: z.enum(PRO_ACTIVITIES),
  accept_rules: z
    .boolean()
    .refine((v) => v === true, "Vous devez accepter les règles de validation."),
});

export const proAccessRequestSchema = z.object({
  public_id: publicIdSchema,
  message: trimmed(500).default(""),
});

export const proAccessDecisionSchema = z.object({
  access_id: z.string().uuid(),
  decision: z.enum(["accorde", "refuse", "revoque"]),
});

export const inviteProfessionalSchema = z.object({
  asset_id: z.string().uuid(),
  professional_email: z.string().trim().toLowerCase().email("Adresse e-mail invalide.").max(160),
});

/* ------------------------------------------------------------------ */
/*  Signalements                                                       */
/* ------------------------------------------------------------------ */

export const disputeSchema = z.object({
  asset_id: z.string().uuid(),
  event_id: z.string().uuid().nullable().optional(),
  reason: z.enum(DISPUTE_REASONS),
  description: z
    .string()
    .trim()
    .min(10, "Décrivez le problème (10 caractères minimum).")
    .max(2000),
});

/* ------------------------------------------------------------------ */
/*  Administration Nireo ID                                            */
/* ------------------------------------------------------------------ */

export const adminProDecisionSchema = z.object({
  professional_id: z.string().uuid(),
  decision: z.enum(["approuve", "refuse", "suspendu"]),
  reason: z.string().trim().min(5, "Motif obligatoire (5 caractères minimum).").max(500),
});

export const adminDisputeDecisionSchema = z.object({
  dispute_id: z.string().uuid(),
  decision: z.enum(["en_examen", "resolu", "rejete"]),
  resolution: z.string().trim().min(5, "Motif obligatoire (5 caractères minimum).").max(500),
  mark_event_disputed: z.boolean().default(false),
});
