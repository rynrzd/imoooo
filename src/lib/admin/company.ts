import { createClient as createBareClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * « Présentation de l'entreprise » — vitrine officielle de Nireo.
 *
 * Tout le contenu est stocké dans UNE clé JSONB (`company_profile`) de la
 * table site_settings. Structure volontairement évolutive : on ajoutera plus
 * tard emplois, investisseurs, presse, kit de marque… sans migration.
 *
 * Les défauts riches vivent ici et sont fusionnés à la lecture (`coerce`),
 * pour que la vitrine ET l'éditeur soient déjà remplis avant toute édition.
 * SERVEUR uniquement. Aucun secret ne transite jamais par cette table.
 */

/* ------------------------------ Types ------------------------------ */

export interface ValueItem {
  title: string;
  text: string;
}
export interface KeyStat {
  value: string;
  label: string;
}
export interface WhyItem {
  icon: string; // clé d'icône (voir WHY_ICONS côté rendu)
  title: string;
  text: string;
}
export interface TeamMember {
  name: string;
  role: string;
  photoUrl: string;
  bio: string;
}
export interface TimelineItem {
  date: string;
  title: string;
  text: string;
}
export interface GalleryItem {
  url: string;
  caption: string;
}
export interface Partner {
  name: string;
  url: string;
}
export interface Certification {
  name: string;
  issuer: string;
}
export interface Award {
  name: string;
  year: string;
}
export interface PressItem {
  title: string;
  outlet: string;
  url: string;
  date: string;
}
export interface CompanyFaqItem {
  question: string;
  answer: string;
}
export interface SocialLink {
  platform: string;
  url: string;
}

export interface CompanyProfile {
  published: boolean;
  name: string;
  slogan: string;
  logoUrl: string;
  story: string;
  vision: string;
  mission: string;
  values: ValueItem[];
  stats: KeyStat[];
  why: WhyItem[];
  team: TeamMember[];
  timeline: TimelineItem[];
  gallery: GalleryItem[];
  videoUrl: string;
  partners: Partner[];
  certifications: Certification[];
  awards: Award[];
  press: PressItem[];
  faq: CompanyFaqItem[];
  social: SocialLink[];
  contactEmail: string;
  contactPhone: string;
  address: string;
  hours: string;
}

/* --------------------------- Défauts riches ------------------------ */

export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  published: true,
  name: "Nireo",
  slogan: "Le poste de pilotage de votre patrimoine immobilier.",
  logoUrl: "",
  story:
    "Nireo est né d’un constat simple : gérer un patrimoine locatif ne devrait pas rimer avec tableurs, paperasse et stress. Nous construisons l’outil que nous aurions voulu avoir — clair, rigoureux et élégant — pour que chaque propriétaire garde le contrôle, quel que soit le nombre de biens.",
  vision:
    "Devenir la référence de la gestion locative pour les propriétaires exigeants, en France puis en Europe.",
  mission:
    "Rendre à chaque propriétaire la clarté, la maîtrise et la sérénité sur son patrimoine — sans complexité, sans compromis sur la sécurité.",
  values: [
    { title: "Rigueur", text: "Des chiffres justes, des données à jour, des calculs qu’on peut vérifier." },
    { title: "Simplicité", text: "Chaque écran va à l’essentiel. La puissance sans la complexité." },
    { title: "Transparence", text: "Des tarifs clairs, sans engagement caché ni surprise." },
    { title: "Respect des données", text: "Vos informations vous appartiennent, isolées et protégées." },
  ],
  stats: [
    { value: "8", label: "modules intégrés" },
    { value: "100 %", label: "données isolées par compte" },
    { value: "24/7", label: "accès à votre patrimoine" },
    { value: "< 2 min", label: "pour démarrer" },
  ],
  why: [
    { icon: "innovation", title: "Innovation", text: "Nous repensons la gestion locative avec les meilleures technologies du web moderne." },
    { icon: "ambition", title: "Ambition", text: "Un produit pensé pour devenir la référence, pas un énième tableur en ligne." },
    { icon: "transparence", title: "Transparence", text: "Tarifs clairs, communication honnête, aucune promesse que le produit ne tient." },
    { icon: "equipe", title: "Esprit d’équipe", text: "Chaque décision se prend ensemble, au service de l’utilisateur." },
    { icon: "evolution", title: "Évolution", text: "Le produit s’améliore en continu, guidé par les retours du terrain." },
    { icon: "vision", title: "Vision long terme", text: "Nous construisons pour durer, pas pour un coup d’éclat." },
    { icon: "satisfaction", title: "Satisfaction client", text: "La réussite de nos utilisateurs est notre seule mesure de succès." },
    { icon: "qualite", title: "Qualité du produit", text: "Le soin du détail, de la donnée jusqu’au moindre pixel." },
  ],
  team: [],
  timeline: [
    { date: "2026", title: "Naissance de Nireo", text: "Première version : logements, locataires, loyers, documents et statistiques réunis." },
  ],
  gallery: [],
  videoUrl: "",
  partners: [],
  certifications: [
    { name: "Hébergement en Union européenne (RGPD)", issuer: "Infrastructure européenne" },
  ],
  awards: [],
  press: [],
  faq: [
    { question: "Où sont hébergées les données ?", answer: "En Europe, avec sauvegarde automatique et isolement strict par compte." },
    { question: "Nireo est-il adapté à une SCI ?", answer: "Oui : centralisez tous les biens de la société, avec documents classés et exports." },
  ],
  social: [],
  contactEmail: "nireo.contacte@gmail.com",
  contactPhone: "",
  address: "",
  hours: "",
};

/* ------------------------------ Coerce ----------------------------- */

const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const bool = (v: unknown, d: boolean): boolean => (typeof v === "boolean" ? v : d);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

function mapItems<T>(v: unknown, fallback: T[], map: (o: Record<string, unknown>) => T): T[] {
  if (!Array.isArray(v)) return fallback;
  return v.map((x) => map(obj(x)));
}

/**
 * Fusionne la valeur stockée sur les défauts riches : les champs absents
 * gardent leur valeur par défaut ; les tableaux présents (même vides)
 * remplacent le défaut (l'admin peut donc « vider » une section).
 */
export function coerceCompany(raw: unknown): CompanyProfile {
  const r = obj(raw);
  const d = DEFAULT_COMPANY_PROFILE;
  const has = (k: string) => Object.prototype.hasOwnProperty.call(r, k);

  return {
    published: bool(r.published, d.published),
    name: str(r.name, d.name),
    slogan: str(r.slogan, d.slogan),
    logoUrl: str(r.logoUrl, d.logoUrl),
    story: str(r.story, d.story),
    vision: str(r.vision, d.vision),
    mission: str(r.mission, d.mission),
    values: has("values")
      ? mapItems(r.values, d.values, (o) => ({ title: str(o.title), text: str(o.text) }))
      : d.values,
    stats: has("stats")
      ? mapItems(r.stats, d.stats, (o) => ({ value: str(o.value), label: str(o.label) }))
      : d.stats,
    why: has("why")
      ? mapItems(r.why, d.why, (o) => ({ icon: str(o.icon, "qualite"), title: str(o.title), text: str(o.text) }))
      : d.why,
    team: has("team")
      ? mapItems(r.team, d.team, (o) => ({
          name: str(o.name),
          role: str(o.role),
          photoUrl: str(o.photoUrl),
          bio: str(o.bio),
        }))
      : d.team,
    timeline: has("timeline")
      ? mapItems(r.timeline, d.timeline, (o) => ({ date: str(o.date), title: str(o.title), text: str(o.text) }))
      : d.timeline,
    gallery: has("gallery")
      ? mapItems(r.gallery, d.gallery, (o) => ({ url: str(o.url), caption: str(o.caption) }))
      : d.gallery,
    videoUrl: str(r.videoUrl, d.videoUrl),
    partners: has("partners")
      ? mapItems(r.partners, d.partners, (o) => ({ name: str(o.name), url: str(o.url) }))
      : d.partners,
    certifications: has("certifications")
      ? mapItems(r.certifications, d.certifications, (o) => ({ name: str(o.name), issuer: str(o.issuer) }))
      : d.certifications,
    awards: has("awards")
      ? mapItems(r.awards, d.awards, (o) => ({ name: str(o.name), year: str(o.year) }))
      : d.awards,
    press: has("press")
      ? mapItems(r.press, d.press, (o) => ({
          title: str(o.title),
          outlet: str(o.outlet),
          url: str(o.url),
          date: str(o.date),
        }))
      : d.press,
    faq: has("faq")
      ? mapItems(r.faq, d.faq, (o) => ({ question: str(o.question), answer: str(o.answer) }))
      : d.faq,
    social: has("social")
      ? mapItems(r.social, d.social, (o) => ({ platform: str(o.platform), url: str(o.url) }))
      : d.social,
    contactEmail: str(r.contactEmail, d.contactEmail),
    contactPhone: str(r.contactPhone, d.contactPhone),
    address: str(r.address, d.address),
    hours: str(r.hours, d.hours),
  };
}

/* --------------------------- Lecture / écriture -------------------- */

/** Lecture admin (clé secrète). Repli silencieux sur les défauts. */
export async function getCompanyProfile(): Promise<CompanyProfile> {
  if (!isAdminConfigured) return DEFAULT_COMPANY_PROFILE;
  try {
    const { data, error } = await createAdminClient()
      .from("site_settings")
      .select("value")
      .eq("key", "company_profile")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return coerceCompany(data?.value ?? {});
  } catch (e) {
    logger.error("admin/company", e);
    return DEFAULT_COMPANY_PROFILE;
  }
}

/** Lecture publique via RPC (aucun secret). Jamais bloquant. */
export async function getPublicCompanyProfile(): Promise<CompanyProfile> {
  if (!isSupabaseConfigured) return DEFAULT_COMPANY_PROFILE;
  try {
    const { url, publishableKey } = getSupabaseEnv();
    const supabase = createBareClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.rpc("public_company_profile");
    if (error) throw new Error(error.message);
    return coerceCompany(data ?? {});
  } catch (e) {
    logger.error("admin/company", e);
    return DEFAULT_COMPANY_PROFILE;
  }
}

/** Écriture (appelée uniquement depuis la Server Action admin). */
export async function writeCompanyProfile(
  profile: CompanyProfile,
  adminId: string
): Promise<void> {
  const { error } = await createAdminClient()
    .from("site_settings")
    .upsert(
      {
        key: "company_profile",
        value: profile,
        updated_by: adminId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
  if (error) throw new Error(`Enregistrement de la présentation impossible : ${error.message}`);
}
