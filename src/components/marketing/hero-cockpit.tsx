"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CreditCard,
  MapPin,
  Server,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { CountUp } from "@/components/marketing/count-up";
import { DashboardPreviewBody, FrameBar } from "@/components/marketing/product-previews";
import { buttonVariants } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/**
 * Hero de la landing — colonne éditoriale à gauche, tableau de bord Nireo à
 * droite. Aucune notification flottante, aucune vidéo, aucun mouvement
 * permanent : les seules animations sont celles de l'apparition initiale,
 * toutes neutralisées par `prefers-reduced-motion` (utilitaires `nireo-*`).
 *
 * Les chiffres du tableau de bord sont des données d'illustration — la barre
 * de titre du panneau le dit explicitement.
 */

/** Engagements réellement vérifiables (hébergement UE, isolation RLS, offre gratuite). */
const REASSURE = [
  { icon: CreditCard, label: "Sans carte bancaire" },
  { icon: ShieldCheck, label: "Données isolées par compte" },
  { icon: Server, label: "Hébergement européen" },
];

/* ---------------------------------------------------------------- */
/*  Data-viz — courbe d'aire dessinée à la main (SVG, sans lib).     */
/* ---------------------------------------------------------------- */

function buildPaths(values: number[], w: number, h: number, pad = 2) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = (w - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(2)} ${h} L${pts[0][0].toFixed(2)} ${h} Z`;
  return { line, area, last: pts[pts.length - 1] };
}

/** Revenus encaissés sur 12 mois — la courbe se dessine à l'arrivée. */
function ValueCurve() {
  const values = [40, 46, 43, 52, 49, 58, 55, 63, 60, 70, 67, 78, 74, 85];
  const W = 300;
  const H = 92;
  const { line, area, last } = buildPaths(values, W, H);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full sm:h-[5.5rem]" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="nireo-curve" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--nireo-emerald)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--nireo-emerald)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#nireo-curve)" />
      <path
        d={line}
        fill="none"
        stroke="var(--nireo-emerald)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        className="motion-safe:[stroke-dasharray:1] motion-safe:[stroke-dashoffset:1] motion-safe:[animation:nireo-draw_1.2s_cubic-bezier(0.16,1,0.3,1)_0.55s_forwards]"
      />
      <circle cx={last[0]} cy={last[1]} r="3.2" fill="var(--nireo-emerald)" />
      <circle cx={last[0]} cy={last[1]} r="3.2" fill="none" stroke="var(--card)" strokeWidth="1.4" />
    </svg>
  );
}

/* ------------------------------ Panneaux ---------------------------- */

/** Résultat net et revenus — indicateurs réellement calculés par Nireo. */
function ResultPanel() {
  return (
    <div className="nireo-panel rounded-xl p-3 sm:rounded-2xl sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Résultat net · année en cours
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
            <CountUp value={21340} suffix=" €" />
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary tabular-nums">
          <TrendingUp className="size-3" /> +8,4 %
        </span>
      </div>
      <div className="mt-3 -mx-1">
        <ValueCurve />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
        <div>
          <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Logements</p>
          <p className="text-base font-semibold text-foreground tabular-nums">
            <CountUp value={6} />
          </p>
        </div>
        <div>
          <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Loyers du mois</p>
          <p className="text-base font-semibold text-foreground tabular-nums">
            <CountUp value={4505} suffix=" €" />
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Échéances du mois — les statuts sont ceux du produit (`RENT_STATUS_LABELS`).
 * Les lignes apparaissent l'une après l'autre au chargement.
 */
function LedgerPanel() {
  const rows = [
    { unit: "T3 Tête d’Or", amount: "980 €", status: "Payé", tone: "bg-primary" },
    { unit: "T4 Villeurbanne", amount: "1 210 €", status: "Payé", tone: "bg-primary" },
    { unit: "Studio Croix-Rousse", amount: "560 €", status: "En attente", tone: "bg-amber-400" },
  ];
  return (
    <div className="nireo-panel h-full rounded-xl p-3 sm:rounded-2xl sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Loyers du mois
        </p>
        <span className="text-[11px] font-medium text-primary tabular-nums">2 / 3 encaissés</span>
      </div>
      <ul className="mt-2 divide-y divide-border">
        {rows.map((row, i) => (
          <li
            key={row.unit}
            className="animate-nireo-rise flex items-center gap-2.5 py-2 text-xs"
            style={{ animationDelay: `${0.6 + i * 0.12}s`, animationDuration: "0.55s" }}
          >
            <span className={cn("size-1.5 shrink-0 rounded-full", row.tone)} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-foreground">{row.unit}</span>
            <span className="hidden text-[11px] text-muted-foreground sm:inline">{row.status}</span>
            <span className="w-16 text-right font-medium text-foreground tabular-nums">{row.amount}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Taux d'occupation — indicateur réel (`getOccupancyRate`). */
function OccupationDonut() {
  const pct = 92;
  const r = 26;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return (
    <div className="nireo-panel flex h-full items-center gap-3 rounded-xl p-3 sm:rounded-2xl sm:p-4">
      <div className="relative grid size-16 shrink-0 place-items-center">
        <svg viewBox="0 0 64 64" className="size-16 -rotate-90" aria-hidden>
          <circle cx="32" cy="32" r={r} fill="none" stroke="var(--muted)" strokeWidth="6" />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke="var(--nireo-emerald)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={off}
          />
        </svg>
        <span className="absolute text-sm font-semibold text-foreground tabular-nums">92 %</span>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Occupation
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">11 / 12 lots loués</p>
      </div>
    </div>
  );
}

/**
 * Carte du patrimoine — fonction réelle (plan Business+).
 * Purement illustrative : masquée sur mobile, où elle n'apporterait que de la
 * hauteur vide à l'aperçu.
 */
function MapPanel() {
  const pins = [
    { top: "34%", left: "22%" },
    { top: "50%", left: "56%" },
    { top: "66%", left: "36%" },
    { top: "42%", left: "78%" },
  ];
  return (
    <div className="nireo-panel relative hidden h-full min-h-32 overflow-hidden rounded-2xl p-3 sm:block">
      <div className="nireo-blueprint absolute inset-0 opacity-50" aria-hidden />
      <p className="relative flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <MapPin className="size-3.5 text-primary" aria-hidden /> Carte du patrimoine
      </p>
      {pins.map((p, i) => (
        <span key={i} className="absolute" style={{ top: p.top, left: p.left }} aria-hidden>
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full rounded-full bg-primary/30" />
            <span className="relative inline-flex size-2.5 rounded-full bg-primary ring-2 ring-card" />
          </span>
        </span>
      ))}
    </div>
  );
}

/* ------------------------------- Hero ------------------------------ */

/**
 * Contenu du hero. Tout est optionnel : sans propriété, le composant rend la
 * version de RÉFÉRENCE. Les valeurs viennent normalement du moteur de
 * personnalisation, résolu côté serveur — d'où l'absence totale de
 * scintillement : le HTML arrive déjà personnalisé.
 */
export interface HeroCockpitProps {
  /** `lead` peut contenir des « \n » : chaque ligne apparaît séparément. */
  headline?: { lead: string; highlight: string };
  subheadline?: string;
  cta?: { primary: string; href: string; secondary: string; secondaryHref: string };
  /** Média affiché à droite : tableau de bord composé, ou aperçu statique. */
  media?: "cockpit" | "preview";
}

const DEFAULT_HEADLINE = {
  lead: "Un loyer sur Excel.\nUn bail dans vos mails.",
  highlight: "Ça suffit.",
};
const DEFAULT_SUBHEADLINE =
  "Suivez vos loyers, vos locataires et vos documents dans un seul espace, sans chercher partout.";
const DEFAULT_CTA = {
  primary: "Commencer gratuitement",
  href: "/inscription",
  secondary: "Découvrir Nireo",
  secondaryHref: "#decouvrir",
};

export function HeroCockpit({
  headline = DEFAULT_HEADLINE,
  subheadline = DEFAULT_SUBHEADLINE,
  cta = DEFAULT_CTA,
  media = "cockpit",
}: HeroCockpitProps = {}) {
  const lines = headline.lead.split("\n").filter(Boolean);

  return (
    <section className="relative isolate overflow-hidden">
      {/* Washes d'ambiance — encore atténués (halo discret, jamais un projecteur). */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="nireo-aurora absolute -top-40 right-[-10%] h-80 w-80 rounded-full bg-[radial-gradient(closest-side,var(--nireo-glow-a),transparent)] opacity-[0.1] blur-2xl sm:h-[34rem] sm:w-[34rem] sm:opacity-[0.13]" />
        <div
          className="nireo-aurora absolute top-40 left-[-12%] h-64 w-64 rounded-full bg-[radial-gradient(closest-side,var(--nireo-glow-b),transparent)] opacity-[0.08] blur-2xl sm:h-96 sm:w-96 sm:opacity-[0.11]"
          style={{ animationDelay: "-8s" }}
        />
      </div>

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-9 px-4 pt-8 pb-12 sm:px-6 sm:pt-16 sm:pb-16 lg:grid-cols-12 lg:gap-10 lg:pb-24">
        {/* ---------------- Colonne éditoriale ---------------- */}
        <div className="lg:col-span-5">
          <p
            className="animate-nireo-rise font-mono text-[11px] tracking-[0.18em] text-primary uppercase"
            style={{ animationDelay: "0.05s" }}
          >
            Nireo pour propriétaires
          </p>

          <h1 className="mt-3 text-[2.15rem] leading-[1.05] font-semibold text-balance text-foreground sm:mt-4 sm:text-[3.2rem]">
            {lines.map((line, i) => (
              <span
                key={line}
                className="animate-nireo-rise block"
                style={{ animationDelay: `${0.12 + i * 0.1}s` }}
              >
                {line}
              </span>
            ))}
            <span
              className="animate-nireo-rise block"
              style={{ animationDelay: `${0.12 + lines.length * 0.1}s` }}
            >
              <span className="nireo-shine">{headline.highlight}</span>
            </span>
          </h1>

          <p
            className="animate-nireo-rise mt-4 max-w-md text-[0.98rem] leading-relaxed text-balance text-muted-foreground sm:mt-5 sm:text-base"
            style={{ animationDelay: "0.42s" }}
          >
            {subheadline}
          </p>

          <div
            className="animate-nireo-rise mt-5 flex flex-col gap-2.5 sm:mt-7 sm:flex-row sm:items-center sm:gap-3"
            style={{ animationDelay: "0.5s" }}
          >
            <Link
              href={cta.href}
              data-lx="hero-cta-primary"
              data-lx-cta=""
              onClick={() => track("cta_essai_gratuit", { source: "hero" })}
              className={cn(buttonVariants({ size: "lg" }), "nireo-glow nireo-sheen h-11 px-6 text-[0.95rem]")}
            >
              {cta.primary}
              <ArrowRight className="size-4 transition-transform group-hover/button:translate-x-0.5" />
            </Link>
            <a
              href={cta.secondaryHref}
              data-lx="hero-cta-secondary"
              className="group inline-flex h-11 items-center justify-center gap-1.5 px-2 text-[0.95rem] font-medium text-foreground"
            >
              {cta.secondary}
              <ArrowUpRight className="size-4 text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>

          <ul
            className="animate-nireo-rise mt-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-4 sm:mt-8 sm:gap-x-5 sm:pt-5"
            style={{ animationDelay: "0.56s" }}
          >
            {REASSURE.map((r) => (
              <li key={r.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <r.icon className="size-3.5 text-primary" aria-hidden /> {r.label}
              </li>
            ))}
          </ul>
        </div>

        {/* ---------------- Tableau de bord ---------------- */}
        <div
          className="animate-nireo-rise relative lg:col-span-7"
          style={{ animationDelay: "0.5s" }}
        >
          {/* Ombre douce au sol, atténuée. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-6 left-1/2 h-16 w-3/4 -translate-x-1/2 rounded-[100%] bg-primary/[0.05] blur-2xl sm:-bottom-8 sm:h-24"
          />

          {/* UN SEUL cadre : la barre de titre appartient au panneau de verre,
              le contenu vient nu (aucune seconde fenêtre à l'intérieur). */}
          <div className="nireo-glass relative overflow-hidden rounded-2xl sm:rounded-[1.5rem]">
            <FrameBar title="Tableau de bord" className="bg-transparent" />
            <div className="p-3 sm:p-4">
              {media === "preview" ? (
                <DashboardPreviewBody />
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-5 sm:gap-3">
                  <div className="sm:col-span-3">
                    <ResultPanel />
                  </div>
                  <div className="grid gap-2.5 sm:col-span-2 sm:gap-3">
                    <OccupationDonut />
                    <MapPanel />
                  </div>
                  <div className="sm:col-span-5">
                    <LedgerPanel />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
