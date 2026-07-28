"use server";

import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "../audit";
import { requireAdminAction } from "../auth";
import {
  coerceCompany,
  getCompanyProfile,
  writeCompanyProfile,
  type CompanyProfile,
  type CompanyVideo,
} from "../company";
import type { ActionResult } from "../types";

/* ============================================================= */
/*  Vidéo de présentation — téléversement direct vers Storage.   */
/* ============================================================= */

/** Bucket PUBLIC dédié aux médias de la vitrine. */
const MEDIA_BUCKET = "site-media";
/** Dossier fixe de la vidéo de présentation. */
const VIDEO_DIR = "landing/demo-video";
/** Taille maximale : 200 Mo. */
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
/** Types MIME acceptés. */
const VIDEO_MIME = new Set(["video/mp4", "video/quicktime", "video/webm"]);
/** Extensions ↔ MIME (repli si le navigateur ne fournit pas le type). */
const EXT_BY_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};
const VIDEO_EXTS = new Set(["mp4", "mov", "webm"]);

function fileExt(name: string): string {
  return (name.split(".").pop() || "").toLowerCase();
}

function slugify(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  return (
    base
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 40) || "video"
  );
}

/** Crée le bucket public `site-media` s'il n'existe pas (idempotent). */
async function ensureMediaBucket(
  admin: ReturnType<typeof createAdminClient>
): Promise<void> {
  const { data } = await admin.storage.getBucket(MEDIA_BUCKET);
  if (data) return;
  const { error } = await admin.storage.createBucket(MEDIA_BUCKET, {
    public: true,
    fileSizeLimit: MAX_VIDEO_BYTES,
    allowedMimeTypes: [...VIDEO_MIME],
  });
  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new Error(`Bucket « ${MEDIA_BUCKET} » indisponible : ${error.message}`);
  }
}

type UploadUrlResult =
  | { ok: true; path: string; signedUrl: string; token: string; bucket: string }
  | { ok: false; error: string };

/**
 * Étape 1 — l'admin authentifié demande une URL de téléversement SIGNÉE.
 * La clé secrète ne quitte jamais le serveur : le navigateur reçoit un jeton
 * à usage unique, borné à un seul chemin. Valide format + taille AVANT.
 */
export async function createCompanyVideoUploadUrl(input: {
  fileName: string;
  contentType: string;
  size: number;
}): Promise<UploadUrlResult> {
  try {
    await requireAdminAction(["admin"]);

    const fileName = (input.fileName || "").toString();
    const contentType = (input.contentType || "").toString();
    const size = Number(input.size);
    const ext = fileExt(fileName);

    if (!VIDEO_MIME.has(contentType) && !VIDEO_EXTS.has(ext)) {
      return { ok: false, error: "Format non pris en charge. Utilisez un fichier MP4, MOV ou WebM." };
    }
    if (!Number.isFinite(size) || size <= 0) {
      return { ok: false, error: "Fichier invalide." };
    }
    if (size > MAX_VIDEO_BYTES) {
      return { ok: false, error: "La vidéo est trop volumineuse. Taille maximale autorisée : 200 Mo." };
    }

    const admin = createAdminClient();
    await ensureMediaBucket(admin);

    const finalExt = VIDEO_EXTS.has(ext) ? ext : EXT_BY_MIME[contentType] || "mp4";
    // Nom UNIQUE (timestamp) → jamais de cache navigateur sur l'ancienne vidéo.
    const path = `${VIDEO_DIR}/${Date.now()}-${slugify(fileName)}.${finalExt}`;

    const { data, error } = await admin.storage
      .from(MEDIA_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data?.signedUrl || !data?.token) {
      throw new Error(error?.message || "URL de téléversement indisponible.");
    }
    return { ok: true, path, signedUrl: data.signedUrl, token: data.token, bucket: MEDIA_BUCKET };
  } catch (e) {
    logger.error("admin/company-video (upload-url)", e);
    return { ok: false, error: e instanceof Error ? e.message : "Téléversement impossible." };
  }
}

type CommitVideoResult =
  | { ok: true; video: CompanyVideo; message: string }
  | { ok: false; error: string };

/**
 * Étape 2 — après l'upload direct réussi, on publie : URL publique, écriture
 * dans le profil (fusion ciblée), suppression de l'ANCIENNE vidéo, vérification
 * puis invalidation du cache de la vitrine. Réservé admin.
 */
export async function commitCompanyVideo(input: {
  path: string;
  fileName: string;
  size: number;
}): Promise<CommitVideoResult> {
  let ctx = null;
  try {
    ctx = await requireAdminAction(["admin"]);
    const admin = createAdminClient();
    const path = (input.path || "").toString();
    if (!path.startsWith(`${VIDEO_DIR}/`)) {
      return { ok: false, error: "Chemin de vidéo invalide." };
    }

    // Confirme que l'objet existe réellement dans le bucket (pas de faux succès).
    const baseName = path.slice(VIDEO_DIR.length + 1);
    const { data: listed, error: listErr } = await admin.storage
      .from(MEDIA_BUCKET)
      .list(VIDEO_DIR, { search: baseName, limit: 100 });
    if (listErr) throw new Error(listErr.message);
    const exists = Array.isArray(listed) && listed.some((f) => f.name === baseName);
    if (!exists) {
      return { ok: false, error: "Le fichier n'a pas été trouvé dans le stockage. Réessayez le téléversement." };
    }

    const { data: pub } = admin.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    const url = pub?.publicUrl;
    if (!url) return { ok: false, error: "URL publique introuvable." };

    // Fusion CIBLÉE : on relit le profil courant et on ne touche qu'à la vidéo.
    const current = await getCompanyProfile();
    const oldPath = current.video?.path;
    const video: CompanyVideo = {
      path,
      url,
      fileName: (input.fileName || "").toString().slice(0, 200),
      size: Number.isFinite(input.size) ? Math.max(0, Math.floor(input.size)) : 0,
      updatedAt: new Date().toISOString(),
    };
    const profile = sanitize({ ...current, videoUrl: "", video });
    await writeCompanyProfile(profile, ctx.admin.id);

    // Vérification post-écriture RÉELLE.
    const persisted = await getCompanyProfile();
    if (persisted.video?.path !== path) {
      logger.error("admin/company-video", "Vérification post-écriture : vidéo non persistée.");
      return { ok: false, error: "Publication non confirmée par la base. Réessayez." };
    }

    // Supprime proprement l'ancienne vidéo (best-effort, après confirmation).
    if (oldPath && oldPath !== path) {
      const { error: rmErr } = await admin.storage.from(MEDIA_BUCKET).remove([oldPath]);
      if (rmErr) logger.error("admin/company-video (remove old)", rmErr);
    }

    await logAdminAction(ctx, {
      action: "company.video",
      targetLabel: "company_profile.video",
      newValue: { path, fileName: video.fileName },
    });

    revalidatePath("/a-propos");
    revalidatePath("/entreprise");
    revalidatePath("/");
    revalidatePath("/admin/entreprise");
    return { ok: true, video: profile.video as CompanyVideo, message: "Vidéo publiée sur la vitrine." };
  } catch (e) {
    logger.error("admin/company-video (commit)", e);
    return { ok: false, error: e instanceof Error ? e.message : "Publication impossible." };
  }
}

/** Supprime la vidéo : storage + profil + cache. Réservé admin. */
export async function deleteCompanyVideo(): Promise<ActionResult> {
  let ctx = null;
  try {
    ctx = await requireAdminAction(["admin"]);
    const admin = createAdminClient();
    const current = await getCompanyProfile();
    const oldPath = current.video?.path;

    const profile = sanitize({ ...current, videoUrl: "", video: null });
    await writeCompanyProfile(profile, ctx.admin.id);

    if (oldPath) {
      const { error: rmErr } = await admin.storage.from(MEDIA_BUCKET).remove([oldPath]);
      if (rmErr) logger.error("admin/company-video (delete)", rmErr);
    }

    await logAdminAction(ctx, {
      action: "company.video",
      targetLabel: "company_profile.video",
      detail: "delete",
    });

    revalidatePath("/a-propos");
    revalidatePath("/entreprise");
    revalidatePath("/");
    revalidatePath("/admin/entreprise");
    return { ok: true, message: "Vidéo supprimée." };
  } catch (e) {
    logger.error("admin/company-video (delete)", e);
    return { ok: false, error: e instanceof Error ? e.message : "Suppression impossible." };
  }
}

/**
 * Server Action — « Présentation de l'entreprise ».
 * Réservée à owner/admin. Nettoie et borne toutes les entrées avant écriture,
 * puis journalise l'action. Aucun secret ne transite ici.
 */

const s = (v: string, max: number) => (v ?? "").toString().trim().slice(0, max);

/** Nettoie/borne le profil complet avant écriture (défensif). */
function sanitize(input: CompanyProfile): CompanyProfile {
  const p = coerceCompany(input); // garantit la forme + les types
  const cap = <T>(list: T[], n: number) => list.slice(0, n);

  return {
    published: Boolean(p.published),
    name: s(p.name, 80) || "Nireo",
    shortPitch: s(p.shortPitch, 200),
    slogan: s(p.slogan, 180),
    logoUrl: s(p.logoUrl, 600),
    logoDarkUrl: s(p.logoDarkUrl, 600),
    foundedYear: s(p.foundedYear, 12),
    city: s(p.city, 80),
    country: s(p.country, 80),
    website: s(p.website, 300),
    story: s(p.story, 4000),
    vision: s(p.vision, 2000),
    mission: s(p.mission, 2000),
    values: cap(p.values, 12).map((v) => ({ title: s(v.title, 80), text: s(v.text, 400) })),
    stats: cap(p.stats, 8).map((v) => ({ value: s(v.value, 24), label: s(v.label, 80) })),
    why: cap(p.why, 12).map((v) => ({ icon: s(v.icon, 40), title: s(v.title, 80), text: s(v.text, 400) })),
    team: cap(p.team, 40).map((v) => ({
      name: s(v.name, 80),
      role: s(v.role, 120),
      photoUrl: s(v.photoUrl, 600),
      bio: s(v.bio, 500),
    })),
    timeline: cap(p.timeline, 40).map((v) => ({ date: s(v.date, 40), title: s(v.title, 120), text: s(v.text, 500) })),
    gallery: cap(p.gallery, 48).map((v) => ({ url: s(v.url, 600), caption: s(v.caption, 160) })),
    videoUrl: s(p.videoUrl, 600),
    video: p.video
      ? {
          path: s(p.video.path, 400),
          url: s(p.video.url, 800),
          fileName: s(p.video.fileName, 200),
          size: Number.isFinite(p.video.size) ? Math.max(0, Math.floor(p.video.size)) : 0,
          updatedAt: s(p.video.updatedAt, 40),
          ...(p.video.thumbnail ? { thumbnail: s(p.video.thumbnail, 800) } : {}),
        }
      : null,
    partners: cap(p.partners, 48).map((v) => ({ name: s(v.name, 100), url: s(v.url, 600) })),
    certifications: cap(p.certifications, 30).map((v) => ({ name: s(v.name, 140), issuer: s(v.issuer, 140) })),
    awards: cap(p.awards, 30).map((v) => ({ name: s(v.name, 140), year: s(v.year, 20) })),
    press: cap(p.press, 40).map((v) => ({
      title: s(v.title, 200),
      outlet: s(v.outlet, 120),
      url: s(v.url, 600),
      date: s(v.date, 40),
    })),
    faq: cap(p.faq, 40).map((v) => ({ question: s(v.question, 200), answer: s(v.answer, 1500) })),
    social: cap(p.social, 12).map((v) => ({ platform: s(v.platform, 40), url: s(v.url, 600) })),
    recruitment: {
      intro: s(p.recruitment.intro, 1000),
      reasons: cap(p.recruitment.reasons, 12).map((v) => ({ title: s(v.title, 100), text: s(v.text, 400) })),
      lookingFor: cap(p.recruitment.lookingFor, 16).map((v) => ({ label: s(v.label, 100) })),
      ctaEmail: s(p.recruitment.ctaEmail, 160),
    },
    contactEmail: s(p.contactEmail, 160),
    contactPhone: s(p.contactPhone, 40),
    address: s(p.address, 240),
    hours: s(p.hours, 240),
  };
}

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export async function saveCompanyProfile(input: CompanyProfile): Promise<ActionResult> {
  let ctx = null;
  try {
    ctx = await requireAdminAction(["admin"]);

    const profile = sanitize(input);
    if (profile.contactEmail && !EMAIL_RE.test(profile.contactEmail)) {
      return { ok: false, error: "Adresse e-mail de contact invalide." };
    }

    await writeCompanyProfile(profile, ctx.admin.id);

    // VÉRIFICATION RÉELLE post-écriture : on relit la base et on compare aux
    // valeurs envoyées. Un simple changement de state React ne suffit JAMAIS à
    // afficher un succès — on ne le renvoie qu'après confirmation en base.
    const persisted = await getCompanyProfile();
    if (JSON.stringify(persisted) !== JSON.stringify(profile)) {
      logger.error(
        "admin/company",
        "Vérification post-écriture : les valeurs relues ne correspondent pas à celles envoyées."
      );
      await logAdminAction(ctx, {
        action: "company.profile",
        targetLabel: "company_profile",
        result: "error",
        detail: "verification_mismatch",
      });
      return {
        ok: false,
        error:
          "Enregistrement non confirmé : la base n'a pas renvoyé les nouvelles valeurs. Réessayez, ou vérifiez la configuration Supabase.",
      };
    }

    await logAdminAction(ctx, {
      action: "company.profile",
      targetLabel: "company_profile",
      newValue: { published: profile.published, name: profile.name },
    });

    // Invalidation du cache de la VITRINE : la page de contenu est /a-propos
    // (/entreprise n'est qu'une redirection). /a-propos est déjà `force-dynamic`
    // (relecture à chaque requête) ; ces revalidations couvrent la home et la
    // page admin, et restent correctes si /a-propos redevenait cache-able.
    revalidatePath("/a-propos");
    revalidatePath("/entreprise");
    revalidatePath("/");
    revalidatePath("/admin/entreprise");
    return {
      ok: true,
      message: profile.published
        ? "Enregistré et publié sur la vitrine."
        : "Brouillon enregistré — la vitrine reste masquée (active « Vitrine publiée » pour l'afficher).",
    };
  } catch (e) {
    logger.error("admin/company", e);
    await logAdminAction(ctx, {
      action: "company.profile",
      targetLabel: "company_profile",
      result: "error",
      detail: e instanceof Error ? e.message : "Erreur inconnue",
    });
    return { ok: false, error: e instanceof Error ? e.message : "Enregistrement impossible." };
  }
}
