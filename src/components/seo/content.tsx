import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ContentPage } from "@/config/seo-pages";
import { formatUpdatedAt } from "@/config/seo-pages";
import { cn } from "@/lib/utils";

/**
 * Briques communes aux pages de contenu (page pilier, guides, outils).
 *
 * MÊME LANGAGE QUE LA LANDING
 * ---------------------------
 * Ces briques parlaient l'univers obsidienne : verre (`nireo-glass`), halo
 * (`nireo-aurora`), lueur (`nireo-glow`), cartes posées sur `bg-card`. La
 * vitrine a adopté l'identité cobalt / bleu nuit / papier blanc cassé, et ces
 * pages semblaient donc venir d'une version antérieure du site.
 *
 * Tout est repris ici du vocabulaire RÉEL des sections de la landing, sans
 * rien inventer :
 *  - couleurs : `--nl-cobalt`, `--nl-ink`, `--nl-gray`, `--nl-paper` ;
 *  - surtitre : filet cobalt + capitales espacées ;
 *  - titres : `clamp()`, révélés ligne à ligne derrière un cache
 *    (`data-mask-line`) ;
 *  - séparations : filets `--nl-ink`/8, jamais d'ombre ni de verre ;
 *  - boutons : `nl-button` cobalt et lien souligné, comme le CTA final.
 *
 * L'API publique n'a PAS changé : mêmes composants, mêmes props. Les dix
 * pages qui les utilisent n'ont pas une ligne à modifier.
 *
 * Contraintes tenues :
 *  - tout est rendu côté serveur, le texte est dans le HTML ;
 *  - hiérarchie stricte : un seul <h1>, des <h2> pour les sections ;
 *  - l'état de repos CSS est l'état FINAL — sans JavaScript ou en mouvement
 *    réduit, la page est complète et lisible, simplement immobile.
 */

/** Surtitre : filet cobalt puis capitales espacées. Idiome de la landing. */
function Eyebrow({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) {
  return (
    <p
      data-seq
      className={cn(
        "flex items-center gap-3 text-[0.72rem] font-medium tracking-[0.22em] sm:text-[0.78rem]",
        onDark ? "text-white/75" : "text-[var(--nl-gray)]"
      )}
    >
      <span
        aria-hidden
        data-seq-rule
        style={{ ["--nl-delay" as string]: "120ms", ["--nl-dur" as string]: "0.5s" }}
        className={cn("h-px w-8", onDark ? "bg-[var(--nl-cobalt-bright)]" : "bg-[var(--nl-cobalt)]")}
      />
      {children}
    </p>
  );
}

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
    <header data-reveal className="nl-seq">
      <Eyebrow>{eyebrow}</Eyebrow>

      <h1 className="mt-6 max-w-[20em] text-[clamp(2rem,6vw,3.1rem)] font-semibold text-balance text-[var(--nl-ink)]">
        <span data-mask-line style={{ ["--nl-delay" as string]: "80ms" }}>
          <span>{h1}</span>
        </span>
      </h1>

      <p
        data-seq
        style={{ ["--nl-delay" as string]: "260ms" }}
        className="mt-6 max-w-2xl text-[clamp(0.98rem,2.4vw,1.1rem)] leading-relaxed text-[var(--nl-gray)]"
      >
        {lead}
      </p>

      {updatedAt ? (
        <p
          data-seq
          style={{ ["--nl-delay" as string]: "340ms" }}
          className="mt-6 text-[0.8rem] text-[var(--nl-gray)]"
        >
          Mis à jour le <time dateTime={updatedAt}>{formatUpdatedAt(updatedAt)}</time> · Équipe Nireo
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
    <section id={id} data-reveal className={cn("nl-seq", className)}>
      <h2 className="max-w-[24em] text-[clamp(1.5rem,4vw,2.1rem)] font-semibold text-balance text-[var(--nl-ink)]">
        <span data-mask-line>
          <span>{title}</span>
        </span>
      </h2>
      <div
        data-seq
        style={{ ["--nl-delay" as string]: "160ms" }}
        className="mt-5 space-y-4 text-[0.98rem] leading-relaxed text-[var(--nl-gray)]"
      >
        {children}
      </div>
    </section>
  );
}

/** Sous-titre de niveau 3 à l'intérieur d'une section. */
export function ContentSubtitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="pt-3 text-[1.02rem] font-semibold text-[var(--nl-ink)]">{children}</h3>
  );
}

/** Liste à puces sobre : une puce cobalt, rien d'autre. */
export function ContentList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          <span
            aria-hidden
            className="mt-2.5 size-1.5 shrink-0 rounded-full bg-[var(--nl-cobalt)]"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Encadré d'avertissement honnête (« ce que Nireo ne fait pas »).
 *
 * Pas de tache colorée : la landing n'en a aucune. La distinction se fait par
 * un filet cobalt à gauche et un titre en encre pleine — c'est le TEXTE qui
 * porte l'avertissement, pas un fond ambre emprunté à un autre univers.
 */
export function ContentNotice({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-l-2 border-[var(--nl-cobalt)] bg-[color-mix(in_srgb,var(--nl-ink)_4%,transparent)] py-4 pr-4 pl-5">
      <p className="text-[0.95rem] font-semibold text-[var(--nl-ink)]">{title}</p>
      <div className="mt-2 space-y-2 text-[0.92rem] leading-relaxed text-[var(--nl-gray)]">
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
      <div className="hidden overflow-hidden rounded-lg border border-[var(--nl-ink)]/12 md:block">
        <table className="w-full text-[0.92rem]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-[var(--nl-ink)]/12">
              <th
                scope="col"
                className="px-4 py-3.5 text-left text-[0.72rem] font-medium tracking-[0.14em] text-[var(--nl-gray)] uppercase"
              >
                Critère
              </th>
              <th
                scope="col"
                className="px-4 py-3.5 text-left text-[0.72rem] font-medium tracking-[0.14em] text-[var(--nl-gray)] uppercase"
              >
                {leftLabel}
              </th>
              <th
                scope="col"
                className="px-4 py-3.5 text-left text-[0.72rem] font-medium tracking-[0.14em] text-[var(--nl-cobalt)] uppercase"
              >
                {rightLabel}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--nl-ink)]/8">
            {rows.map((row) => (
              <tr key={row.criterion}>
                <th
                  scope="row"
                  className="px-4 py-3.5 text-left font-normal text-[var(--nl-gray)]"
                >
                  {row.criterion}
                </th>
                <td className="px-4 py-3.5 align-top text-[var(--nl-gray)]">{row.left}</td>
                <td className="px-4 py-3.5 align-top font-medium text-[var(--nl-ink)]">
                  {row.right}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <div key={row.criterion} className="rounded-lg border border-[var(--nl-ink)]/12 p-4">
            <p className="text-[0.95rem] font-medium text-[var(--nl-ink)]">{row.criterion}</p>
            <dl className="mt-3 space-y-2.5 text-[0.9rem]">
              <div>
                <dt className="text-[0.68rem] tracking-[0.14em] text-[var(--nl-gray)] uppercase">
                  {leftLabel}
                </dt>
                <dd className="text-[var(--nl-gray)]">{row.left}</dd>
              </div>
              <div>
                <dt className="text-[0.68rem] tracking-[0.14em] text-[var(--nl-cobalt)] uppercase">
                  {rightLabel}
                </dt>
                <dd className="font-medium text-[var(--nl-ink)]">{row.right}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * Étapes numérotées (« comment ça marche »).
 *
 * Séparées par un filet plutôt qu'enfermées dans des cartes : la landing
 * n'utilise pas de carte « bento », elle pose ses preuves sur un trait.
 */
export function StepList({
  steps,
}: {
  steps: { title: string; description: string }[];
}) {
  return (
    <ol data-reveal className="nl-seq grid gap-8 sm:grid-cols-3 sm:gap-6">
      {steps.map((step, index) => (
        <li
          key={step.title}
          data-seq
          style={{ ["--nl-delay" as string]: `${index * 90}ms` }}
          className="border-t border-[var(--nl-ink)]/12 pt-5"
        >
          <span className="font-mono text-[0.7rem] tracking-[0.18em] text-[var(--nl-cobalt)]">
            N°{String(index + 1).padStart(2, "0")}
          </span>
          <p className="mt-3 text-[1.02rem] font-semibold text-[var(--nl-ink)]">{step.title}</p>
          <p className="mt-2 text-[0.92rem] leading-relaxed text-[var(--nl-gray)]">
            {step.description}
          </p>
        </li>
      ))}
    </ol>
  );
}

/**
 * Appel à l'action de fin de page.
 *
 * Reprend la composition du CTA final de la landing : bleu nuit, un bouton
 * cobalt, un lien souligné. Toutes les destinations existent.
 */
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
      data-reveal
      className="nl-seq overflow-hidden rounded-xl bg-[var(--nl-night)] px-6 py-12 text-white sm:px-10 sm:py-14"
    >
      <Eyebrow onDark>COMMENCER</Eyebrow>

      <h2
        id="cta-final"
        className="mt-6 max-w-[18em] text-[clamp(1.6rem,4.4vw,2.4rem)] font-semibold text-balance"
      >
        <span data-mask-line style={{ ["--nl-delay" as string]: "80ms" }}>
          <span>{title}</span>
        </span>
      </h2>

      <p
        data-seq
        style={{ ["--nl-delay" as string]: "240ms" }}
        className="mt-4 max-w-xl text-[0.98rem] leading-relaxed text-[var(--nl-gray-dark)]"
      >
        {description}
      </p>

      <div
        data-seq
        style={{ ["--nl-delay" as string]: "320ms" }}
        className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6"
      >
        <Link
          href={primaryHref}
          className="nl-button nl-focus inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[var(--nl-cobalt)] px-7 text-[0.98rem] font-medium whitespace-nowrap text-white hover:bg-[color-mix(in_srgb,var(--nl-cobalt)_85%,#000)] sm:w-auto"
        >
          {primaryLabel}
          <span aria-hidden className="nl-button-arrow">
            →
          </span>
        </Link>
        <Link
          href={secondaryHref}
          className="nl-focus text-[0.95rem] font-medium text-white/85 underline-offset-4 hover:text-white hover:underline"
        >
          {secondaryLabel}
        </Link>
      </div>
    </section>
  );
}

/**
 * Grille de liens vers des pages de contenu.
 *
 * SEULE définition de cette carte. `/ressources` en répétait trois variantes
 * quasi identiques (pilier, guides, outils) et `RelatedPages` une quatrième :
 * quatre endroits où corriger le même survol, et donc trois occasions
 * d'oublier. Tout passe désormais par ici.
 *
 * Les cartes ne sont pas des boîtes posées les unes à côté des autres : la
 * grille est un bloc unique, découpé par des filets (`gap-px` sur un fond
 * encre). C'est le traitement de la landing, qui n'utilise aucune carte
 * « bento ».
 *
 * `titre` : élément de titre facultatif, rendu tel quel au-dessus.
 */
export function ContentCards({
  pages,
  withDate = false,
  columns = 2,
  emphasis = false,
}: {
  pages: readonly ContentPage[];
  /** Affiche la date de mise à jour — utile sur /ressources, inutile ailleurs. */
  withDate?: boolean;
  columns?: 1 | 2;
  /** Carte unique mise en avant (page pilier) : titre plus grand, plus d'air. */
  emphasis?: boolean;
}) {
  if (pages.length === 0) return null;
  return (
    <ul
      data-reveal
      className={cn(
        "nl-seq grid gap-px overflow-hidden rounded-lg bg-[var(--nl-ink)]/10",
        columns === 2 && !emphasis ? "sm:grid-cols-2" : null
      )}
    >
      {pages.map((page, index) => (
        <li
          key={page.path}
          data-seq
          style={{ ["--nl-delay" as string]: `${index * 70}ms` }}
          className="bg-[var(--nl-paper)]"
        >
          <Link
            href={page.path}
            className={cn(
              "nl-focus group flex h-full flex-col transition-colors hover:bg-[color-mix(in_srgb,var(--nl-cobalt)_5%,var(--nl-paper))]",
              emphasis ? "p-6 sm:p-8" : "p-5"
            )}
          >
            <span className="flex items-start justify-between gap-4">
              <span
                className={cn(
                  "font-semibold text-balance text-[var(--nl-ink)]",
                  emphasis ? "text-[1.15rem] sm:text-[1.35rem]" : "text-[0.95rem]"
                )}
              >
                {emphasis ? page.title : page.shortTitle}
              </span>
              <ArrowUpRight
                className={cn(
                  "shrink-0 text-[var(--nl-gray)] transition-[color,transform] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--nl-cobalt)]",
                  emphasis ? "mt-1 size-5" : "size-4"
                )}
                aria-hidden
              />
            </span>
            <span
              className={cn(
                "mt-2 flex-1 leading-relaxed text-[var(--nl-gray)]",
                emphasis ? "mt-3 text-[0.98rem]" : "text-[0.9rem]"
              )}
            >
              {page.summary}
            </span>
            {withDate ? (
              <span className="mt-4 text-[0.78rem] text-[var(--nl-gray)]">
                Mis à jour le{" "}
                <time dateTime={page.updatedAt}>{formatUpdatedAt(page.updatedAt)}</time>
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Maillage interne : liens vers les autres pages de contenu. */
export function RelatedPages({
  title = "À lire aussi",
  pages,
}: {
  title?: string;
  pages: readonly ContentPage[];
}) {
  if (pages.length === 0) return null;
  return (
    <section aria-labelledby="a-lire-aussi">
      <h2
        id="a-lire-aussi"
        className="text-[0.72rem] font-medium tracking-[0.22em] text-[var(--nl-gray)] uppercase"
      >
        {title}
      </h2>
      <div className="mt-6">
        <ContentCards pages={pages} />
      </div>
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
  return <div className="space-y-16 py-14 sm:space-y-20 sm:py-20">{children}</div>;
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
    <div className={cn("mx-auto w-full max-w-3xl px-6 sm:px-8", className)}>{children}</div>
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
    <div className={cn("mx-auto w-full max-w-6xl px-6 sm:px-8", className)}>{children}</div>
  );
}
