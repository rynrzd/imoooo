import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { ContentPage } from "@/config/seo-pages";
import { formatUpdatedAt } from "@/config/seo-pages";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Briques communes aux pages de contenu (page pilier + guides).
 *
 * Contraintes tenues ici :
 * - tout est rendu côté serveur : le texte est dans le HTML, sans clic,
 *   sans onglet, sans carrousel ;
 * - le décor reprend l'univers Nireo existant (verre, filet, halo) sans
 *   introduire de nouvelle dépendance ;
 * - hiérarchie stricte : un seul <h1> par page, des <h2> pour les sections.
 */

/** Bandeau de titre d'une page de contenu. */
export function ContentHeader({
  eyebrow,
  h1,
  lead,
  updatedAt,
}: {
  eyebrow: string;
  h1: string;
  lead: string;
  updatedAt?: string;
}) {
  return (
    <header className="relative">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-64">
        <div className="nireo-aurora absolute left-1/2 h-64 w-[42rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--nireo-glow-a),transparent)] opacity-25 blur-2xl" />
      </div>
      <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[11px] font-medium tracking-widest text-primary uppercase">
        {eyebrow}
      </span>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-[2.6rem] sm:leading-[1.1]">
        {h1}
      </h1>
      <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">{lead}</p>
      {updatedAt ? (
        <p className="mt-5 text-xs text-muted-foreground">
          Mis à jour le{" "}
          <time dateTime={updatedAt}>{formatUpdatedAt(updatedAt)}</time> · Équipe Nireo
        </p>
      ) : null}
    </header>
  );
}

/** Section de contenu avec son <h2> — l'ancre permet un lien direct. */
export function ContentSection({
  id,
  title,
  children,
  className,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24", className)}>
      <h2 className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-[1.75rem]">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-[0.95rem] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

/** Sous-titre de niveau 3 à l'intérieur d'une section. */
export function ContentSubtitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="pt-2 text-base font-semibold text-foreground">{children}</h3>
  );
}

/** Liste à puces sobre, cohérente avec le reste de la vitrine. */
export function ContentList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          <span
            aria-hidden
            className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/70"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Encadré d'avertissement honnête (« ce que Nireo ne fait pas »). */
export function ContentNotice({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

/**
 * Tableau comparatif à deux colonnes, lisible sur mobile.
 * Desktop : tableau sémantique. Mobile : une carte par ligne — jamais de
 * défilement horizontal imposé.
 */
export function ComparisonTable({
  caption,
  leftLabel,
  rightLabel,
  rows,
}: {
  caption: string;
  leftLabel: string;
  rightLabel: string;
  rows: { criterion: string; left: string; right: string }[];
}) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">
                Critère
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-foreground">
                {leftLabel}
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-primary">
                {rightLabel}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.criterion}>
                <th scope="row" className="px-4 py-3 text-left font-normal text-muted-foreground">
                  {row.criterion}
                </th>
                <td className="px-4 py-3 align-top text-foreground/80">{row.left}</td>
                <td className="px-4 py-3 align-top text-foreground">{row.right}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <div key={row.criterion} className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground">{row.criterion}</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-xs tracking-wide text-muted-foreground uppercase">
                  {leftLabel}
                </dt>
                <dd className="text-foreground/80">{row.left}</dd>
              </div>
              <div>
                <dt className="text-xs tracking-wide text-primary uppercase">{rightLabel}</dt>
                <dd className="text-foreground">{row.right}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </>
  );
}

/** Étapes numérotées (« comment ça marche »). */
export function StepList({
  steps,
}: {
  steps: { title: string; description: string }[];
}) {
  return (
    <ol className="grid gap-4 sm:grid-cols-3">
      {steps.map((step, index) => (
        <li
          key={step.title}
          className="nireo-hairline rounded-2xl border border-border bg-card/70 p-5"
        >
          <span className="font-mono text-[11px] tracking-widest text-primary">
            N°{String(index + 1).padStart(2, "0")}
          </span>
          <p className="mt-2 text-base font-semibold text-foreground">{step.title}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {step.description}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** Appel à l'action de fin de page — toutes les destinations existent. */
export function ContentCta({
  title,
  description,
  primaryLabel = "Créer un compte gratuit",
  primaryHref = "/inscription",
  secondaryLabel = "Voir les tarifs",
  secondaryHref = "/tarifs",
}: {
  title: string;
  description: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}) {
  return (
    <section
      aria-labelledby="cta-final"
      className="nireo-glass nireo-hairline rounded-3xl p-8 text-center sm:p-10"
    >
      <h2 id="cta-final" className="text-2xl font-semibold text-balance text-foreground sm:text-3xl">
        {title}
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href={primaryHref}
          className={cn(
            buttonVariants({ size: "lg" }),
            "nireo-glow nireo-sheen h-11 w-full px-6 text-[0.95rem] sm:w-auto"
          )}
        >
          {primaryLabel} <ArrowRight className="size-4" />
        </Link>
        <Link
          href={secondaryHref}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "nireo-glass-soft h-11 w-full px-6 text-[0.95rem] text-foreground sm:w-auto"
          )}
        >
          {secondaryLabel}
        </Link>
      </div>
    </section>
  );
}

/** Maillage interne : cartes vers les autres pages de contenu. */
export function RelatedPages({
  title = "À lire aussi",
  pages,
}: {
  title?: string;
  pages: ContentPage[];
}) {
  if (pages.length === 0) return null;
  return (
    <section aria-labelledby="a-lire-aussi">
      <h2
        id="a-lire-aussi"
        className="text-xl font-semibold tracking-tight text-foreground"
      >
        {title}
      </h2>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {pages.map((page) => (
          <li key={page.path}>
            <Link
              href={page.path}
              className="group nireo-hairline flex h-full flex-col rounded-2xl border border-border bg-card/70 p-5 transition-colors hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="text-sm font-semibold text-foreground">
                  {page.shortTitle}
                </span>
                <ArrowUpRight
                  className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                  aria-hidden
                />
              </span>
              <span className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {page.summary}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Enveloppe d'une page de contenu : rythme vertical commun.
 * La largeur est décidée bloc par bloc (`ContentColumn` pour le texte,
 * `ContentWide` pour une grille tarifaire), afin qu'un tableau large ne soit
 * jamais comprimé dans une colonne de lecture.
 */
export function ContentPageShell({ children }: { children: React.ReactNode }) {
  return <div className="space-y-14 py-12 sm:py-16">{children}</div>;
}

/** Colonne de lecture (texte, listes, FAQ). */
export function ContentColumn({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-3xl px-4 sm:px-6", className)}>{children}</div>
  );
}

/** Bloc large (grille tarifaire, comparatif complet). */
export function ContentWide({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}>{children}</div>
  );
}
