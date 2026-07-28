"use server";

import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { logAdminAction } from "../audit";
import { requireAdminAction } from "../auth";
import {
  coerceCompany,
  writeCompanyProfile,
  type CompanyProfile,
} from "../company";
import type { ActionResult } from "../types";

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
    await logAdminAction(ctx, {
      action: "company.profile",
      targetLabel: "company_profile",
      newValue: { published: profile.published, name: profile.name },
    });

    // La vitrine publique et la page admin sont rafraîchies.
    revalidatePath("/entreprise");
    revalidatePath("/admin/entreprise");
    return { ok: true, message: "Présentation enregistrée." };
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
