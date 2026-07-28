import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BadgeCheck,
  Compass,
  Eye,
  Flame,
  Gem,
  Heart,
  Handshake,
  LineChart,
  Mail,
  MapPin,
  Newspaper,
  Phone,
  PlayCircle,
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
import { buttonVariants } from "@/components/ui/button";
import { getPublicCompanyProfile } from "@/lib/admin/company";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "L'entreprise",
  description:
    "Découvrez Nireo : notre histoire, notre vision, nos valeurs et l'équipe qui construit le futur de la gestion locative.",
  alternates: { canonical: "/entreprise" },
};

/* --------------------------- Helpers de rendu ---------------------- */

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

const WHY_GLOWS = [
  "var(--nireo-glow-a)",
  "var(--nireo-glow-b)",
  "var(--nireo-glow-c)",
  "oklch(0.82 0.09 60)",
];

/** Sépare un nombre d'un suffixe (« 100 % » → 100 + « % ») pour l'anim. */
function splitStat(value: string): { num: number | null; prefix: string; suffix: string } {
  const m = value.match(/^([^\d]*)([\d]+(?:[.,]\d+)?)(.*)$/);
  if (!m) return { num: null, prefix: "", suffix: "" };
  const num = parseFloat(m[2].replace(",", "."));
  return { num: Number.isFinite(num) ? num : null, prefix: m[1] ?? "", suffix: m[3] ?? "" };
}

function Band({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24 border-t border-white/5 py-20 sm:py-24", className)}>
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">{children}</div>
    </section>
  );
}

function Head({
  eyebrow,
  title,
  keyword,
  description,
}: {
  eyebrow: string;
  title: string;
  keyword?: string;
  description?: string;
}) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-medium tracking-widest text-primary uppercase">
        {eyebrow}
      </span>
      <h2 className="mt-4 text-3xl font-semibold text-balance text-foreground sm:text-[2.5rem]">
        {title} {keyword ? <span className="nireo-shine">{keyword}</span> : null}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-relaxed text-balance text-muted-foreground">{description}</p>
      ) : null}
    </Reveal>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function isVideoFile(url: string): boolean {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
}

/* -------------------------------- Page ----------------------------- */

export default async function CompanyPage() {
  const p = await getPublicCompanyProfile();
  if (!p.published) notFound();

  return (
    <>
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="nireo-aurora absolute -top-28 left-1/2 h-[34rem] w-[48rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--nireo-glow-a),transparent)] opacity-40 blur-2xl" />
        </div>
        <div className="mx-auto max-w-3xl px-4 pt-20 pb-14 text-center sm:px-6 sm:pt-28">
          <Reveal>
            <div className="flex justify-center">
              {p.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.logoUrl} alt={p.name} className="h-14 w-auto object-contain" />
              ) : (
                <NireoMark className="size-14 rounded-2xl" />
              )}
            </div>
            <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-medium tracking-widest text-primary uppercase">
              L’entreprise
            </p>
            <h1 className="mt-4 text-5xl font-semibold text-balance text-foreground sm:text-6xl">
              {p.name}
            </h1>
            {p.slogan ? (
              <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-balance text-muted-foreground">
                {p.slogan}
              </p>
            ) : null}
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="#contact" className={cn(buttonVariants({ size: "lg" }), "nireo-glow h-11 px-6")}>
                Travailler avec nous
                <ArrowRight className="size-4" />
              </a>
              <Link
                href="/"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "nireo-glass-soft h-11 px-6 text-foreground")}
              >
                Découvrir le produit
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- Chiffres clés ---------------- */}
      {p.stats.length > 0 ? (
        <Band>
          <Reveal>
            <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
              {p.stats.map((stat) => {
                const { num, prefix, suffix } = splitStat(stat.value);
                return (
                  <div key={stat.label + stat.value} className="text-center">
                    <p className="text-4xl font-semibold tracking-tight sm:text-5xl">
                      <span className="nireo-shine">
                        {num !== null ? (
                          <CountUp value={num} prefix={prefix} suffix={suffix} decimals={num % 1 === 0 ? 0 : 1} />
                        ) : (
                          stat.value
                        )}
                      </span>
                    </p>
                    <p className="mx-auto mt-3 max-w-[18ch] text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </Band>
      ) : null}

      {/* ---------------- Histoire / Vision / Mission ---------------- */}
      {p.story || p.vision || p.mission ? (
        <Band>
          <Head eyebrow="Notre récit" title="L’histoire de" keyword={p.name} />
          {p.story ? (
            <Reveal className="mx-auto mt-10 max-w-3xl">
              <p className="text-center text-lg leading-relaxed text-balance text-muted-foreground">{p.story}</p>
            </Reveal>
          ) : null}
          {p.vision || p.mission ? (
            <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
              {p.vision ? (
                <Reveal>
                  <div className="nireo-glass h-full rounded-2xl p-6">
                    <p className="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-primary uppercase">
                      <Compass className="size-4" /> Vision
                    </p>
                    <p className="mt-3 text-[15px] leading-relaxed text-foreground">{p.vision}</p>
                  </div>
                </Reveal>
              ) : null}
              {p.mission ? (
                <Reveal delay={80}>
                  <div className="nireo-glass h-full rounded-2xl p-6">
                    <p className="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-primary uppercase">
                      <Rocket className="size-4" /> Mission
                    </p>
                    <p className="mt-3 text-[15px] leading-relaxed text-foreground">{p.mission}</p>
                  </div>
                </Reveal>
              ) : null}
            </div>
          ) : null}
        </Band>
      ) : null}

      {/* ---------------- Valeurs ---------------- */}
      {p.values.length > 0 ? (
        <Band>
          <Head eyebrow="Nos valeurs" title="Ce qui nous" keyword="guide." />
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {p.values.map((v, i) => (
              <Reveal key={v.title} delay={(i % 4) * 70}>
                <div className="h-full rounded-2xl border border-white/8 bg-white/[0.02] p-6">
                  <p className="text-2xl font-semibold text-primary/70">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="mt-3 text-base font-semibold text-foreground">{v.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Band>
      ) : null}

      {/* ---------------- Pourquoi travailler avec Nireo ---------------- */}
      {p.why.length > 0 ? (
        <Band>
          <Head
            eyebrow="Pourquoi nous rejoindre"
            title="Travailler avec"
            keyword="Nireo."
            description="Une aventure ambitieuse, exigeante et profondément humaine."
          />
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {p.why.map((w, i) => {
              const Icon = WHY_ICONS[w.icon] ?? Sparkles;
              return (
                <Reveal key={w.title + i} delay={(i % 4) * 70}>
                  <SpotlightCard glow={WHY_GLOWS[i % WHY_GLOWS.length]} className="h-full p-6">
                    <span className="grid size-11 place-items-center rounded-xl border border-white/8 bg-white/[0.04] text-primary">
                      <Icon className="size-5" />
                    </span>
                    <h3 className="mt-4 text-base font-semibold text-foreground">{w.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{w.text}</p>
                  </SpotlightCard>
                </Reveal>
              );
            })}
          </div>
        </Band>
      ) : null}

      {/* ---------------- Timeline ---------------- */}
      {p.timeline.length > 0 ? (
        <Band>
          <Head eyebrow="Parcours" title="Les grandes" keyword="étapes." />
          <div className="mx-auto mt-12 max-w-3xl">
            <ol className="relative border-l border-white/10 pl-8">
              {p.timeline.map((t, i) => (
                <Reveal key={t.title + i} delay={(i % 5) * 60}>
                  <li className="relative pb-9 last:pb-0">
                    <span className="absolute top-1 -left-[2.15rem] grid size-4 place-items-center rounded-full bg-primary ring-4 ring-[var(--background)]" />
                    {t.date ? <p className="text-xs font-semibold tracking-widest text-primary uppercase">{t.date}</p> : null}
                    <h3 className="mt-1 text-base font-semibold text-foreground">{t.title}</h3>
                    {t.text ? <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t.text}</p> : null}
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </Band>
      ) : null}

      {/* ---------------- Équipe ---------------- */}
      {p.team.length > 0 ? (
        <Band>
          <Head eyebrow="L’équipe" title="Les visages de" keyword="Nireo." />
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {p.team.map((m, i) => (
              <Reveal key={m.name + i} delay={(i % 3) * 70}>
                <div className="h-full rounded-2xl border border-white/8 bg-white/[0.02] p-6">
                  <div className="flex items-center gap-4">
                    {m.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.photoUrl} alt={m.name} loading="lazy" className="size-16 shrink-0 rounded-full object-cover ring-1 ring-white/10" />
                    ) : (
                      <span className="grid size-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/30 to-primary/5 text-lg font-semibold text-foreground ring-1 ring-white/10">
                        {initials(m.name)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{m.name}</p>
                      {m.role ? <p className="truncate text-sm text-primary">{m.role}</p> : null}
                    </div>
                  </div>
                  {m.bio ? <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{m.bio}</p> : null}
                </div>
              </Reveal>
            ))}
          </div>
        </Band>
      ) : null}

      {/* ---------------- Vidéo ---------------- */}
      {p.videoUrl ? (
        <Band>
          <Head eyebrow="En vidéo" title="Nireo, en" keyword="images." />
          <Reveal className="mx-auto mt-10 max-w-4xl">
            <div className="nireo-glass overflow-hidden rounded-3xl p-2">
              <div className="relative aspect-video overflow-hidden rounded-2xl bg-black/40">
                {isVideoFile(p.videoUrl) ? (
                  <video src={p.videoUrl} controls className="h-full w-full object-cover" />
                ) : (
                  <iframe
                    src={p.videoUrl}
                    title="Vidéo de présentation Nireo"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="h-full w-full"
                  />
                )}
              </div>
            </div>
          </Reveal>
        </Band>
      ) : null}

      {/* ---------------- Galerie ---------------- */}
      {p.gallery.length > 0 ? (
        <Band>
          <Head eyebrow="Galerie" title="Dans les" keyword="coulisses." />
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {p.gallery.map((g, i) => (
              <Reveal key={g.url + i} delay={(i % 4) * 50}>
                <figure className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.url}
                    alt={g.caption || "Nireo"}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {g.caption ? (
                    <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-xs font-medium text-white">
                      {g.caption}
                    </figcaption>
                  ) : null}
                </figure>
              </Reveal>
            ))}
          </div>
        </Band>
      ) : null}

      {/* ---------------- Partenaires ---------------- */}
      {p.partners.length > 0 ? (
        <Band>
          <Head eyebrow="Écosystème" title="Nos" keyword="partenaires." />
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            {p.partners.map((partner, i) => (
              <Reveal key={partner.name + i} delay={(i % 6) * 40}>
                {partner.url ? (
                  <a
                    href={partner.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nireo-glass-soft inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:text-primary"
                  >
                    <Handshake className="size-4 text-primary" />
                    {partner.name}
                    <ArrowUpRight className="size-3.5 text-muted-foreground" />
                  </a>
                ) : (
                  <span className="nireo-glass-soft inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground">
                    <Handshake className="size-4 text-primary" />
                    {partner.name}
                  </span>
                )}
              </Reveal>
            ))}
          </div>
        </Band>
      ) : null}

      {/* ---------------- Certifications & Récompenses ---------------- */}
      {p.certifications.length > 0 || p.awards.length > 0 ? (
        <Band>
          <Head eyebrow="Confiance & reconnaissance" title="Certifications &" keyword="récompenses." />
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {p.certifications.map((c, i) => (
              <Reveal key={"cert" + i} delay={(i % 2) * 70}>
                <div className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                    <BadgeCheck className="size-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{c.name}</p>
                    {c.issuer ? <p className="mt-0.5 text-sm text-muted-foreground">{c.issuer}</p> : null}
                  </div>
                </div>
              </Reveal>
            ))}
            {p.awards.map((a, i) => (
              <Reveal key={"award" + i} delay={(i % 2) * 70}>
                <div className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-400/12 text-amber-300">
                    <Award className="size-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{a.name}</p>
                    {a.year ? <p className="mt-0.5 text-sm text-muted-foreground">{a.year}</p> : null}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Band>
      ) : null}

      {/* ---------------- Presse ---------------- */}
      {p.press.length > 0 ? (
        <Band>
          <Head eyebrow="Presse" title="Ils parlent de" keyword="nous." />
          <div className="mx-auto mt-10 max-w-3xl divide-y divide-white/8 overflow-hidden rounded-3xl border border-white/8 bg-white/[0.02]">
            {p.press.map((article, i) => (
              <a
                key={article.title + i}
                href={article.url || "#"}
                target={article.url ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-5 transition-colors hover:bg-white/[0.03]"
              >
                <Newspaper className="size-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{article.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {[article.outlet, article.date].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {article.url ? <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" /> : null}
              </a>
            ))}
          </div>
        </Band>
      ) : null}

      {/* ---------------- FAQ entreprise ---------------- */}
      {p.faq.length > 0 ? (
        <Band>
          <Head eyebrow="FAQ" title="Questions" keyword="fréquentes." />
          <div className="mx-auto mt-10 max-w-3xl space-y-3">
            {p.faq.map((item, i) => (
              <details
                key={item.question + i}
                className="nireo-glass group/faq rounded-2xl px-5 py-4 [&_summary]:list-none"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-[15px] font-medium text-foreground">
                  {item.question}
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open/faq:rotate-90" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
        </Band>
      ) : null}

      {/* ---------------- Contact ---------------- */}
      <Band id="contact" className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_120%_at_50%_0%,var(--nireo-glow-a),transparent_60%)] opacity-20"
        />
        <Head eyebrow="Contact" title="Parlons de" keyword="votre projet." />
        <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2">
          {p.contactEmail ? (
            <a href={`mailto:${p.contactEmail}`} className="nireo-glass flex items-center gap-4 rounded-2xl p-5 transition-colors hover:text-primary">
              <span className="grid size-11 place-items-center rounded-xl bg-primary/12 text-primary"><Mail className="size-5" /></span>
              <div><p className="text-xs text-muted-foreground">E-mail</p><p className="font-medium text-foreground">{p.contactEmail}</p></div>
            </a>
          ) : null}
          {p.contactPhone ? (
            <a href={`tel:${p.contactPhone}`} className="nireo-glass flex items-center gap-4 rounded-2xl p-5 transition-colors hover:text-primary">
              <span className="grid size-11 place-items-center rounded-xl bg-primary/12 text-primary"><Phone className="size-5" /></span>
              <div><p className="text-xs text-muted-foreground">Téléphone</p><p className="font-medium text-foreground">{p.contactPhone}</p></div>
            </a>
          ) : null}
          {p.address ? (
            <div className="nireo-glass flex items-center gap-4 rounded-2xl p-5">
              <span className="grid size-11 place-items-center rounded-xl bg-primary/12 text-primary"><MapPin className="size-5" /></span>
              <div><p className="text-xs text-muted-foreground">Adresse</p><p className="font-medium text-foreground">{p.address}</p></div>
            </div>
          ) : null}
          {p.hours ? (
            <div className="nireo-glass flex items-center gap-4 rounded-2xl p-5">
              <span className="grid size-11 place-items-center rounded-xl bg-primary/12 text-primary"><Clock className="size-5" /></span>
              <div><p className="text-xs text-muted-foreground">Horaires</p><p className="font-medium text-foreground">{p.hours}</p></div>
            </div>
          ) : null}
        </div>

        {p.social.length > 0 ? (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {p.social.map((s, i) => (
              <a
                key={s.platform + i}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="nireo-glass-soft inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:text-primary"
              >
                {s.platform}
                <ArrowUpRight className="size-3.5 text-muted-foreground" />
              </a>
            ))}
          </div>
        ) : null}

        <div className="mt-12 flex justify-center">
          <Link href="/inscription" className={cn(buttonVariants({ size: "lg" }), "nireo-glow h-11 px-6")}>
            <PlayCircle className="size-4" />
            Découvrir Nireo gratuitement
          </Link>
        </div>
      </Band>
    </>
  );
}
