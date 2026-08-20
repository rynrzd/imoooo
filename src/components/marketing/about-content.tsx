"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BadgeCheck,
  Briefcase,
  Compass,
  Eye,
  Flame,
  Gem,
  Handshake,
  Heart,
  LineChart,
  Mail,
  MapPin,
  Newspaper,
  Phone,
  Clock,
  Rocket,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { CountUp } from "@/components/marketing/count-up";
import { NireoMark } from "@/components/marketing/nireo-logo";
import { Reveal } from "@/components/marketing/reveal";
import { SpotlightCard } from "@/components/marketing/spotlight-card";
import type { CompanyProfile } from "@/lib/admin/company";
import { cn } from "@/lib/utils";

/**
 * Rendu de la vitrine « À propos » — SOURCE UNIQUE, réutilisée par la page
 * publique /a-propos et par l'aperçu en direct de l'administration.
 * Chaque section vide se masque automatiquement.
 */

const WHY_ICONS: Record<string, LucideIcon> = {
  innovation: Sparkles,
  ambition: Rocket,
  transparence: Eye,
  equipe: Users,
  evolution: TrendingUp,
  vision: Compass,
  satisfaction: Heart,
  qualite: Gem,
  securite: ShieldCheck,
  croissance: LineChart,
  passion: Flame,
};


function splitStat(value: string): { num: number | null; prefix: string; suffix: string } {
  const m = value.match(/^([^\d]*)([\d]+(?:[.,]\d+)?)(.*)$/);
  if (!m) return { num: null, prefix: "", suffix: "" };
  const num = parseFloat(m[2].replace(",", "."));
  return { num: Number.isFinite(num) ? num : null, prefix: m[1] ?? "", suffix: m[3] ?? "" };
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function isVideoFile(url: string): boolean {
  return /\.(mp4|mov|webm|ogg)(\?.*)?$/i.test(url);
}

/** Type MIME déduit de l'extension (pour la balise <source>). */
function videoMime(url: string): string {
  const u = url.toLowerCase();
  if (u.includes(".webm")) return "video/webm";
  if (u.includes(".mov")) return "video/quicktime";
  if (u.includes(".ogg")) return "video/ogg";
  return "video/mp4";
}

function Band({ id, className, children }: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={cn("scroll-mt-24 border-t border-[var(--nl-ink)]/10 py-20 sm:py-24", className)}>
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">{children}</div>
    </section>
  );
}

function Head({ eyebrow, title, keyword, description }: { eyebrow: string; title: string; keyword?: string; description?: string }) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <span className="inline-flex items-center gap-3 text-[0.72rem] font-medium tracking-[0.22em] text-[var(--nl-gray)] uppercase"><span aria-hidden className="h-px w-8 bg-[var(--nl-cobalt)]" />
        {eyebrow}
      </span>
      <h2 className="mt-4 text-3xl font-semibold text-balance text-[var(--nl-ink)] sm:text-[2.5rem]">
        {title} {keyword ? <span className="text-[var(--nl-ink)]">{keyword}</span> : null}
      </h2>
      {description ? <p className="mt-4 text-base leading-relaxed text-balance text-[var(--nl-gray)]">{description}</p> : null}
    </Reveal>
  );
}

export function AboutContent({ profile: p }: { profile: CompanyProfile }) {
  const location = [p.city, p.country].filter(Boolean).join(", ");

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        </div>
        <div className="mx-auto max-w-3xl px-4 pt-20 pb-14 text-center sm:px-6 sm:pt-24">
          <Reveal>
            <div className="flex justify-center">
              {p.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.logoUrl} alt={p.name} className="h-14 w-auto object-contain" />
              ) : (
                <NireoMark flat className="size-14 rounded-2xl bg-[var(--nl-cobalt)] text-white" />
              )}
            </div>
            <p className="mt-7 flex items-center justify-center gap-3 text-[0.72rem] font-medium tracking-[0.22em] text-[var(--nl-gray)] uppercase">
              <span aria-hidden className="h-px w-8 bg-[var(--nl-cobalt)]" />
              L’entreprise{location ? ` · ${location}` : ""}{p.foundedYear ? ` · depuis ${p.foundedYear}` : ""}
            </p>
            <h1 className="mt-4 text-5xl font-semibold text-balance text-[var(--nl-ink)] sm:text-6xl">{p.name}</h1>
            {p.shortPitch || p.slogan ? (
              <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-balance text-[var(--nl-gray)]">
                {p.shortPitch || p.slogan}
              </p>
            ) : null}
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="#recrutement" className="nl-button nl-focus inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[var(--nl-cobalt)] px-7 text-[0.95rem] font-medium text-white hover:bg-[color-mix(in_srgb,var(--nl-cobalt)_85%,#000)]">
                Travailler avec nous <ArrowRight className="size-4" />
              </a>
              <Link href="/" className="nl-focus inline-flex h-12 items-center justify-center gap-2 rounded-md border border-[var(--nl-ink)]/20 px-7 text-[0.95rem] font-medium text-[var(--nl-ink)] transition-colors hover:border-[var(--nl-cobalt)] hover:text-[var(--nl-cobalt)]">
                Découvrir le produit
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Chiffres clés */}
      {p.stats.length > 0 ? (
        <Band>
          <Reveal>
            <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
              {p.stats.map((stat) => {
                const { num, prefix, suffix } = splitStat(stat.value);
                return (
                  <div key={stat.label + stat.value} className="text-center">
                    <p className="text-4xl font-semibold tracking-tight sm:text-5xl">
                      <span className="text-[var(--nl-ink)]">
                        {num !== null ? <CountUp value={num} prefix={prefix} suffix={suffix} decimals={num % 1 === 0 ? 0 : 1} /> : stat.value}
                      </span>
                    </p>
                    <p className="mx-auto mt-3 max-w-[18ch] text-sm text-[var(--nl-gray)]">{stat.label}</p>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </Band>
      ) : null}

      {/* Histoire / Vision / Mission */}
      {p.story || p.vision || p.mission ? (
        <Band>
          <Head eyebrow="Notre récit" title="L’histoire de" keyword={p.name} />
          {p.story ? (
            <Reveal className="mx-auto mt-10 max-w-3xl">
              <p className="text-center text-lg leading-relaxed text-balance text-[var(--nl-gray)]">{p.story}</p>
            </Reveal>
          ) : null}
          {p.vision || p.mission ? (
            <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
              {p.vision ? (
                <Reveal>
                  <div className="border border-[var(--nl-ink)]/12 bg-[color-mix(in_srgb,#fff_55%,var(--nl-paper))] h-full rounded-2xl p-6">
                    <p className="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-[var(--nl-cobalt)] uppercase"><Compass className="size-4" /> Vision</p>
                    <p className="mt-3 text-[15px] leading-relaxed text-[var(--nl-ink)]">{p.vision}</p>
                  </div>
                </Reveal>
              ) : null}
              {p.mission ? (
                <Reveal delay={80}>
                  <div className="border border-[var(--nl-ink)]/12 bg-[color-mix(in_srgb,#fff_55%,var(--nl-paper))] h-full rounded-2xl p-6">
                    <p className="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-[var(--nl-cobalt)] uppercase"><Rocket className="size-4" /> Mission</p>
                    <p className="mt-3 text-[15px] leading-relaxed text-[var(--nl-ink)]">{p.mission}</p>
                  </div>
                </Reveal>
              ) : null}
            </div>
          ) : null}
        </Band>
      ) : null}

      {/* Valeurs */}
      {p.values.length > 0 ? (
        <Band>
          <Head eyebrow="Nos valeurs" title="Ce qui nous" keyword="guide." />
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {p.values.map((v, i) => (
              <Reveal key={v.title} delay={(i % 4) * 70}>
                <div className="h-full rounded-2xl border border-[var(--nl-ink)]/12 bg-card p-6">
                  <p className="text-2xl font-semibold text-[var(--nl-cobalt)]/70">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="mt-3 text-base font-semibold text-[var(--nl-ink)]">{v.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--nl-gray)]">{v.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Band>
      ) : null}

      {/* Timeline */}
      {p.timeline.length > 0 ? (
        <Band>
          <Head eyebrow="Parcours" title="Les grandes" keyword="étapes." />
          <div className="mx-auto mt-12 max-w-3xl">
            <ol className="relative border-l border-[var(--nl-ink)]/12 pl-8">
              {p.timeline.map((t, i) => (
                <Reveal key={t.title + i} delay={(i % 5) * 60}>
                  <li className="relative pb-9 last:pb-0">
                    <span className="absolute top-1 -left-[2.15rem] grid size-4 place-items-center rounded-full bg-[var(--nl-cobalt)] ring-4 ring-[var(--nl-paper)]" />
                    {t.date ? <p className="text-xs font-semibold tracking-widest text-[var(--nl-cobalt)] uppercase">{t.date}</p> : null}
                    <h3 className="mt-1 text-base font-semibold text-[var(--nl-ink)]">{t.title}</h3>
                    {t.text ? <p className="mt-1.5 text-sm leading-relaxed text-[var(--nl-gray)]">{t.text}</p> : null}
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </Band>
      ) : null}

      {/* Équipe */}
      {p.team.length > 0 ? (
        <Band>
          <Head eyebrow="L’équipe" title="Les visages de" keyword={p.name} />
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {p.team.map((m, i) => (
              <Reveal key={m.name + i} delay={(i % 3) * 70}>
                <div className="h-full rounded-2xl border border-[var(--nl-ink)]/12 bg-card p-6">
                  <div className="flex items-center gap-4">
                    {m.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.photoUrl} alt={m.name} loading="lazy" className="size-16 shrink-0 rounded-full object-cover ring-1 ring-[var(--nl-ink)]/12" />
                    ) : (
                      <span className="grid size-16 shrink-0 place-items-center rounded-full border border-[var(--nl-ink)]/12 bg-[color-mix(in_srgb,var(--nl-cobalt)_10%,var(--nl-paper))] text-lg font-semibold text-[var(--nl-ink)]">{initials(m.name)}</span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--nl-ink)]">{m.name}</p>
                      {m.role ? <p className="truncate text-sm text-[var(--nl-cobalt)]">{m.role}</p> : null}
                    </div>
                  </div>
                  {m.bio ? <p className="mt-4 text-sm leading-relaxed text-[var(--nl-gray)]">{m.bio}</p> : null}
                </div>
              </Reveal>
            ))}
          </div>
        </Band>
      ) : null}

      {/* Vidéo — lecteur HTML5 natif, source = fichier téléversé (Supabase
          Storage). Aucun lien externe / iframe : jamais de page tierce. */}
      {(() => {
        const videoSrc = p.video?.url || (isVideoFile(p.videoUrl) ? p.videoUrl : "");
        if (!videoSrc) return null;
        return (
          <Band>
            <Head eyebrow="En vidéo" title="Nireo, en" keyword="images." />
            <Reveal className="mx-auto mt-10 max-w-4xl">
              <div className="border border-[var(--nl-ink)]/12 bg-[color-mix(in_srgb,#fff_55%,var(--nl-paper))] overflow-hidden rounded-3xl p-2">
                <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
                  <video
                    controls
                    playsInline
                    preload="metadata"
                    poster={p.video?.thumbnail || undefined}
                    className="h-full w-full object-contain"
                  >
                    <source src={videoSrc} type={videoMime(videoSrc)} />
                    Votre navigateur ne prend pas en charge la lecture de cette vidéo.
                  </video>
                </div>
              </div>
            </Reveal>
          </Band>
        );
      })()}

      {/* Galerie */}
      {p.gallery.length > 0 ? (
        <Band>
          <Head eyebrow="Galerie" title="Dans les" keyword="coulisses." />
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {p.gallery.map((g, i) => (
              <Reveal key={g.url + i} delay={(i % 4) * 50}>
                <figure className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-[var(--nl-ink)]/12 bg-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.url} alt={g.caption || "Nireo"} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  {g.caption ? <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-xs font-medium text-white">{g.caption}</figcaption> : null}
                </figure>
              </Reveal>
            ))}
          </div>
        </Band>
      ) : null}

      {/* Partenaires */}
      {p.partners.length > 0 ? (
        <Band>
          <Head eyebrow="Écosystème" title="Nos" keyword="partenaires." />
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            {p.partners.map((partner, i) => (
              <Reveal key={partner.name + i} delay={(i % 6) * 40}>
                {partner.url ? (
                  <a href={partner.url} target="_blank" rel="noopener noreferrer" className="border border-[var(--nl-ink)]/12 bg-[color-mix(in_srgb,#fff_60%,var(--nl-paper))] inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-[var(--nl-ink)] transition-colors hover:text-[var(--nl-cobalt)]">
                    <Handshake className="size-4 text-[var(--nl-cobalt)]" /> {partner.name} <ArrowUpRight className="size-3.5 text-[var(--nl-gray)]" />
                  </a>
                ) : (
                  <span className="border border-[var(--nl-ink)]/12 bg-[color-mix(in_srgb,#fff_60%,var(--nl-paper))] inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-[var(--nl-ink)]"><Handshake className="size-4 text-[var(--nl-cobalt)]" /> {partner.name}</span>
                )}
              </Reveal>
            ))}
          </div>
        </Band>
      ) : null}

      {/* Certifications & récompenses */}
      {p.certifications.length > 0 || p.awards.length > 0 ? (
        <Band>
          <Head eyebrow="Confiance & reconnaissance" title="Certifications &" keyword="récompenses." />
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {p.certifications.map((c, i) => (
              <Reveal key={"cert" + i} delay={(i % 2) * 70}>
                <div className="flex items-start gap-3 rounded-2xl border border-[var(--nl-ink)]/12 bg-card p-5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-[var(--nl-cobalt)]/20 bg-[color-mix(in_srgb,var(--nl-cobalt)_8%,transparent)] text-[var(--nl-cobalt)]"><BadgeCheck className="size-5" /></span>
                  <div><p className="font-semibold text-[var(--nl-ink)]">{c.name}</p>{c.issuer ? <p className="mt-0.5 text-sm text-[var(--nl-gray)]">{c.issuer}</p> : null}</div>
                </div>
              </Reveal>
            ))}
            {p.awards.map((a, i) => (
              <Reveal key={"award" + i} delay={(i % 2) * 70}>
                <div className="flex items-start gap-3 rounded-2xl border border-[var(--nl-ink)]/12 bg-card p-5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-400/12 text-amber-300"><Award className="size-5" /></span>
                  <div><p className="font-semibold text-[var(--nl-ink)]">{a.name}</p>{a.year ? <p className="mt-0.5 text-sm text-[var(--nl-gray)]">{a.year}</p> : null}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </Band>
      ) : null}

      {/* Presse */}
      {p.press.length > 0 ? (
        <Band>
          <Head eyebrow="Presse" title="Ils parlent de" keyword="nous." />
          <div className="mx-auto mt-10 max-w-3xl divide-y divide-border overflow-hidden rounded-3xl border border-[var(--nl-ink)]/12 bg-card">
            {p.press.map((article, i) => (
              <a key={article.title + i} href={article.url || "#"} target={article.url ? "_blank" : undefined} rel="noopener noreferrer" className="flex items-center gap-4 p-5 transition-colors hover:bg-muted">
                <Newspaper className="size-5 shrink-0 text-[var(--nl-cobalt)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[var(--nl-ink)]">{article.title}</p>
                  <p className="text-sm text-[var(--nl-gray)]">{[article.outlet, article.date].filter(Boolean).join(" · ")}</p>
                </div>
                {article.url ? <ArrowUpRight className="size-4 shrink-0 text-[var(--nl-gray)]" /> : null}
              </a>
            ))}
          </div>
        </Band>
      ) : null}

      {/* Pourquoi travailler avec Nireo */}
      {p.why.length > 0 ? (
        <Band>
          <Head eyebrow="Pourquoi nous rejoindre" title="Travailler avec" keyword={p.name} description="Une aventure ambitieuse, exigeante et profondément humaine." />
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {p.why.map((w, i) => {
              const Icon = WHY_ICONS[w.icon] ?? Sparkles;
              return (
                <Reveal key={w.title + i} delay={(i % 4) * 70}>
                  <SpotlightCard className="h-full p-6">
                    <span className="grid size-11 place-items-center rounded-xl border border-[var(--nl-cobalt)]/20 bg-[color-mix(in_srgb,var(--nl-cobalt)_8%,transparent)] text-[var(--nl-cobalt)]"><Icon className="size-5" /></span>
                    <h3 className="mt-4 text-base font-semibold text-[var(--nl-ink)]">{w.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--nl-gray)]">{w.text}</p>
                  </SpotlightCard>
                </Reveal>
              );
            })}
          </div>
        </Band>
      ) : null}

      {/* Recrutement / Collaboration */}
      {p.recruitment.intro || p.recruitment.reasons.length > 0 || p.recruitment.lookingFor.length > 0 ? (
        <Band id="recrutement" className="relative overflow-hidden">
          <Head eyebrow="Rejoindre l’aventure" title="Construisons Nireo" keyword="ensemble." description={p.recruitment.intro || undefined} />

          {p.recruitment.reasons.length > 0 ? (
            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {p.recruitment.reasons.map((r, i) => (
                <Reveal key={r.title + i} delay={(i % 3) * 70}>
                  <div className="h-full rounded-2xl border border-[var(--nl-ink)]/12 bg-card p-6">
                    <span className="grid size-11 place-items-center rounded-lg border border-[var(--nl-cobalt)]/20 bg-[color-mix(in_srgb,var(--nl-cobalt)_8%,transparent)] text-[var(--nl-cobalt)]"><Sparkles className="size-5" /></span>
                    <h3 className="mt-4 text-base font-semibold text-[var(--nl-ink)]">{r.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--nl-gray)]">{r.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          ) : null}

          {p.recruitment.lookingFor.length > 0 ? (
            <Reveal className="mt-8">
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <span className="text-sm text-[var(--nl-gray)]">Nous recherchons&nbsp;:</span>
                {p.recruitment.lookingFor.map((l, i) => (
                  <span key={l.label + i} className="border border-[var(--nl-ink)]/12 bg-[color-mix(in_srgb,#fff_60%,var(--nl-paper))] inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium text-[var(--nl-ink)]">
                    <Briefcase className="size-3.5 text-[var(--nl-cobalt)]" /> {l.label}
                  </span>
                ))}
              </div>
            </Reveal>
          ) : null}

          {p.recruitment.ctaEmail ? (
            <div className="mt-10 flex justify-center">
              <a href={`mailto:${p.recruitment.ctaEmail}`} className="nl-button nl-focus inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[var(--nl-cobalt)] px-7 text-[0.95rem] font-medium text-white hover:bg-[color-mix(in_srgb,var(--nl-cobalt)_85%,#000)]">
                <Mail className="size-4" /> Nous écrire
              </a>
            </div>
          ) : null}
        </Band>
      ) : null}

      {/* FAQ */}
      {p.faq.length > 0 ? (
        <Band>
          <Head eyebrow="FAQ" title="Questions" keyword="fréquentes." />
          <div className="mx-auto mt-10 max-w-3xl space-y-3">
            {p.faq.map((item, i) => (
              <details key={item.question + i} className="border border-[var(--nl-ink)]/12 bg-[color-mix(in_srgb,#fff_55%,var(--nl-paper))] group/faq rounded-2xl px-5 py-4 [&_summary]:list-none">
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-[15px] font-medium text-[var(--nl-ink)]">
                  {item.question}
                  <ArrowRight className="size-4 shrink-0 text-[var(--nl-gray)] transition-transform group-open/faq:rotate-90" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-[var(--nl-gray)]">{item.answer}</p>
              </details>
            ))}
          </div>
        </Band>
      ) : null}

      {/* Contact */}
      <Band id="contact" className="relative overflow-hidden">
        <Head eyebrow="Contact" title="Parlons de" keyword="votre projet." />
        <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2">
          {p.contactEmail ? (
            <a href={`mailto:${p.contactEmail}`} className="border border-[var(--nl-ink)]/12 bg-[color-mix(in_srgb,#fff_55%,var(--nl-paper))] flex items-center gap-4 rounded-2xl p-5 transition-colors hover:text-[var(--nl-cobalt)]">
              <span className="grid size-11 place-items-center rounded-lg border border-[var(--nl-cobalt)]/20 bg-[color-mix(in_srgb,var(--nl-cobalt)_8%,transparent)] text-[var(--nl-cobalt)]"><Mail className="size-5" /></span>
              <div><p className="text-xs text-[var(--nl-gray)]">E-mail</p><p className="font-medium text-[var(--nl-ink)]">{p.contactEmail}</p></div>
            </a>
          ) : null}
          {p.contactPhone ? (
            <a href={`tel:${p.contactPhone}`} className="border border-[var(--nl-ink)]/12 bg-[color-mix(in_srgb,#fff_55%,var(--nl-paper))] flex items-center gap-4 rounded-2xl p-5 transition-colors hover:text-[var(--nl-cobalt)]">
              <span className="grid size-11 place-items-center rounded-lg border border-[var(--nl-cobalt)]/20 bg-[color-mix(in_srgb,var(--nl-cobalt)_8%,transparent)] text-[var(--nl-cobalt)]"><Phone className="size-5" /></span>
              <div><p className="text-xs text-[var(--nl-gray)]">Téléphone</p><p className="font-medium text-[var(--nl-ink)]">{p.contactPhone}</p></div>
            </a>
          ) : null}
          {p.address || location ? (
            <div className="border border-[var(--nl-ink)]/12 bg-[color-mix(in_srgb,#fff_55%,var(--nl-paper))] flex items-center gap-4 rounded-2xl p-5">
              <span className="grid size-11 place-items-center rounded-lg border border-[var(--nl-cobalt)]/20 bg-[color-mix(in_srgb,var(--nl-cobalt)_8%,transparent)] text-[var(--nl-cobalt)]"><MapPin className="size-5" /></span>
              <div><p className="text-xs text-[var(--nl-gray)]">Adresse</p><p className="font-medium text-[var(--nl-ink)]">{p.address || location}</p></div>
            </div>
          ) : null}
          {p.hours ? (
            <div className="border border-[var(--nl-ink)]/12 bg-[color-mix(in_srgb,#fff_55%,var(--nl-paper))] flex items-center gap-4 rounded-2xl p-5">
              <span className="grid size-11 place-items-center rounded-lg border border-[var(--nl-cobalt)]/20 bg-[color-mix(in_srgb,var(--nl-cobalt)_8%,transparent)] text-[var(--nl-cobalt)]"><Clock className="size-5" /></span>
              <div><p className="text-xs text-[var(--nl-gray)]">Horaires</p><p className="font-medium text-[var(--nl-ink)]">{p.hours}</p></div>
            </div>
          ) : null}
        </div>

        {p.social.length > 0 || p.website ? (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {p.website ? (
              <a href={p.website} target="_blank" rel="noopener noreferrer" className="border border-[var(--nl-ink)]/12 bg-[color-mix(in_srgb,#fff_60%,var(--nl-paper))] inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-[var(--nl-ink)] transition-colors hover:text-[var(--nl-cobalt)]">
                Site web <ArrowUpRight className="size-3.5 text-[var(--nl-gray)]" />
              </a>
            ) : null}
            {p.social.map((s, i) => (
              <a key={s.platform + i} href={s.url} target="_blank" rel="noopener noreferrer" className="border border-[var(--nl-ink)]/12 bg-[color-mix(in_srgb,#fff_60%,var(--nl-paper))] inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-[var(--nl-ink)] transition-colors hover:text-[var(--nl-cobalt)]">
                {s.platform} <ArrowUpRight className="size-3.5 text-[var(--nl-gray)]" />
              </a>
            ))}
          </div>
        ) : null}

        <div className="mt-12 flex justify-center">
          <Link href="/inscription" className="nl-button nl-focus inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[var(--nl-cobalt)] px-7 text-[0.95rem] font-medium text-white hover:bg-[color-mix(in_srgb,var(--nl-cobalt)_85%,#000)]">
            Découvrir Nireo gratuitement <ArrowRight className="size-4" />
          </Link>
        </div>
      </Band>
    </>
  );
}
