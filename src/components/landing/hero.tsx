import Link from "next/link";
import { ArrowRight, FileText, Mail, Receipt, Table2 } from "lucide-react";
import { DashboardScreen } from "@/components/landing/nireo-screen";
import { cn } from "@/lib/utils";

/**
 * Hero — l'effet signature de la page.
 *
 * Quatre pièces administratives réelles (une ligne de tableur, un e-mail de
 * locataire, un bail, une facture) partent légèrement dispersées puis viennent
 * se ranger dans le tableau de bord Nireo, qui reste ensuite parfaitement
 * stable. Tout est en CSS (`transform` + `opacity`), déclenché au chargement :
 * aucun écouteur de défilement, aucune bibliothèque.
 *
 * - `--land-intro-delay` : décalage posé par le rideau d'introduction quand il
 *   joue, pour que l'entrée commence au moment où l'écran s'ouvre. Absent
 *   (visite suivante, mouvement réduit), il vaut 0 et l'entrée est immédiate.
 * - `prefers-reduced-motion` : les pièces ne sont jamais montrées et le
 *   tableau de bord est simplement là. Le sens du hero tient dans le texte.
 */

/** Décalage de départ de chaque pièce : mobile discret, dispersion sur grand écran. */
const PAPERS = [
  {
    key: "tableur",
    icon: Table2,
    title: "Loyers_2026.xlsx",
    line: "Juillet · T4 Villeurbanne · 1 210 €",
    /* Position finale (là où la pièce se range) + décalage de départ. */
    place: "left-0 top-4 sm:-left-6 sm:top-6",
    from: "[--fx:-38px] [--fy:-34px] [--fr:-5deg] sm:[--fx:-104px] sm:[--fy:-64px] sm:[--fr:-7deg]",
    delay: 0,
  },
  {
    key: "email",
    icon: Mail,
    title: "Re : bail à signer",
    line: "Mme Fournier · pièce jointe",
    place: "right-0 top-0 sm:-right-4 sm:-top-3",
    from: "[--fx:34px] [--fy:-30px] [--fr:4deg] sm:[--fx:112px] sm:[--fy:-52px] sm:[--fr:6deg]",
    delay: 150,
    /* Mobile : trois pièces suffisent, jamais de bord coupé. */
    hideOnMobile: true,
  },
  {
    key: "bail",
    icon: FileText,
    title: "Bail.pdf",
    line: "Signé le 3 juillet · 1,2 Mo",
    place: "bottom-6 left-2 sm:-left-8 sm:bottom-10",
    from: "[--fx:-30px] [--fy:36px] [--fr:4deg] sm:[--fx:-98px] sm:[--fy:58px] sm:[--fr:5deg]",
    delay: 300,
  },
  {
    key: "facture",
    icon: Receipt,
    title: "Facture chaudière",
    line: "1 240 € · à classer",
    place: "right-2 bottom-2 sm:-right-6 sm:bottom-4",
    from: "[--fx:36px] [--fy:32px] [--fr:-4deg] sm:[--fx:96px] sm:[--fy:56px] sm:[--fr:-6deg]",
    delay: 450,
  },
];

/** Décalage d'entrée commun : suit le rideau d'introduction quand il joue. */
function rise(ms: number) {
  return { animationDelay: `calc(var(--land-intro-delay, 0ms) + ${ms}ms)` };
}

export interface HeroProps {
  /** Libellés et destinations, résolus côté serveur (routes internes). */
  cta: { primary: string; href: string; secondary: string; secondaryHref: string };
  subheadline: string;
}

export function LandingHero({ cta, subheadline }: HeroProps) {
  return (
    <section className="relative overflow-x-clip">
      <div className="mx-auto w-full max-w-[76rem] px-4 pt-10 pb-12 sm:px-6 sm:pt-14 sm:pb-16 lg:pt-16 lg:pb-24">
        {/* ---------------- Le hook, en pleine largeur ---------------- */}
        <p className="land-eyebrow land-rise text-muted-foreground" style={rise(0)}>
          Logiciel de gestion locative
        </p>

        <h1 className="mt-4 text-[2.05rem] leading-[1.06] font-semibold text-foreground sm:text-[2.9rem] lg:mt-5 lg:text-[3.6rem]">
          <span className="land-rise block" style={rise(80)}>
            Un loyer sur Excel.
          </span>
          <span className="land-rise block" style={rise(170)}>
            Un bail dans vos mails.
          </span>
          <span className="land-rise mt-1 block" style={rise(280)}>
            {/* La seule licence typographique de la page. */}
            <span className="land-serif">Ça suffit.</span>
          </span>
        </h1>

        <div className="mt-8 grid grid-cols-1 gap-10 sm:mt-10 lg:grid-cols-12 lg:items-start lg:gap-10">
          {/* ---------------- Promesse et actions ---------------- */}
          <div className="lg:col-span-5 lg:pt-1">
            <p
              className="land-rise max-w-md text-[1rem] leading-relaxed text-muted-foreground"
              style={rise(400)}
            >
              {subheadline}
            </p>

            <div
              className="land-rise mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3"
              style={rise(480)}
            >
              <Link
                href={cta.href}
                data-lx="hero-cta-primary"
                data-lx-cta=""
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-[6px] bg-primary px-6 text-[0.95rem] font-medium whitespace-nowrap text-[var(--land-paper)] transition-colors hover:bg-[color-mix(in_srgb,var(--land-blue)_88%,var(--land-ink))] sm:h-11"
              >
                {cta.primary}
                <ArrowRight
                  className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                  aria-hidden
                />
              </Link>
              <a
                href={cta.secondaryHref}
                data-lx="hero-cta-secondary"
                className="inline-flex h-12 items-center justify-center rounded-[6px] border border-[color-mix(in_srgb,var(--land-ink)_22%,transparent)] px-6 text-[0.95rem] font-medium whitespace-nowrap text-foreground transition-colors hover:bg-[color-mix(in_srgb,var(--land-ink)_5%,transparent)] sm:h-11"
              >
                {cta.secondary}
              </a>
            </div>
          </div>

          {/* ---------------- Mise en scène ---------------- */}
          <div className="land-rise lg:col-span-7" style={rise(240)}>
            <div className="relative">
              <DashboardScreen active />

              {/* Les pièces qui se rangent — décoratives, jamais annoncées. */}
              <div aria-hidden className="pointer-events-none absolute inset-0">
                {PAPERS.map((paper) => (
                  <div
                    key={paper.key}
                    style={{ animationDelay: `calc(var(--land-intro-delay, 0ms) + ${420 + paper.delay}ms)` }}
                    className={cn(
                      "land-file absolute w-[10.5rem] rounded-[5px] border border-border bg-[var(--land-paper)] px-2.5 py-2 shadow-[0_6px_18px_-12px_rgb(21_26_33/0.55)] sm:w-[12.5rem]",
                      paper.place,
                      paper.from,
                      paper.hideOnMobile && "hidden sm:block"
                    )}
                  >
                    <p className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                      <paper.icon className="size-3 shrink-0 text-muted-foreground" />
                      <span className="truncate">{paper.title}</span>
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{paper.line}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
