"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  Check,
  CreditCard,
  FileText,
  MapPin,
  ShieldCheck,
  TrendingUp,
  Zap,
} from "lucide-react";
import { CountUp } from "@/components/marketing/count-up";
import { buttonVariants } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/* Parallaxe : écrit --mx / --my sur la scène (souris), respecte reduced-motion. */
function useParallax() {
  const ref = React.useRef<HTMLDivElement>(null);
  const frame = React.useRef(0);
  const onMove = React.useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      el.style.setProperty("--my", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    });
  }, []);
  const onLeave = React.useCallback(() => {
    ref.current?.style.setProperty("--mx", "0");
    ref.current?.style.setProperty("--my", "0");
  }, []);
  return { ref, onMove, onLeave };
}

function Depth({
  depth,
  className,
  children,
}: {
  depth: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={className}
      style={{
        transform: `translate3d(calc(var(--mx,0) * ${depth}px), calc(var(--my,0) * ${depth}px), 0)`,
        transition: "transform 0.35s cubic-bezier(0.2,0.8,0.2,1)",
      }}
    >
      {children}
    </div>
  );
}

const REASSURE = [
  { icon: CreditCard, label: "Sans carte bancaire" },
  { icon: Zap, label: "Prêt en 2 minutes" },
  { icon: ShieldCheck, label: "Données isolées" },
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

function ValueCurve() {
  const values = [40, 46, 43, 52, 49, 58, 55, 63, 60, 70, 67, 78, 74, 85];
  const W = 300;
  const H = 96;
  const { line, area, last } = buildPaths(values, W, H);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="nireo-curve" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--nireo-emerald)" stopOpacity="0.22" />
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
        className="motion-safe:[stroke-dasharray:1] motion-safe:[stroke-dashoffset:1] motion-safe:[animation:nireo-draw_1.4s_cubic-bezier(0.16,1,0.3,1)_0.5s_forwards]"
      />
      <circle cx={last[0]} cy={last[1]} r="3.4" fill="var(--nireo-emerald)" />
      <circle cx={last[0]} cy={last[1]} r="3.4" fill="none" stroke="var(--card)" strokeWidth="1.4" />
    </svg>
  );
}

/* ------------------------------ Panneaux ---------------------------- */

function PatrimoinePanel() {
  return (
    <div className="nireo-panel nireo-hairline rounded-2xl p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Valeur du patrimoine
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
            <CountUp value={1.24} decimals={2} suffix=" M€" />
          </p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary tabular-nums">
          <TrendingUp className="size-3" /> +8,4 %
        </span>
      </div>
      <div className="mt-3 -mx-1">
        <ValueCurve />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
        <div>
          <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Biens</p>
          <p className="text-base font-semibold text-foreground tabular-nums">
            <CountUp value={6} />
          </p>
        </div>
        <div>
          <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Revenus / mois</p>
          <p className="text-base font-semibold text-foreground tabular-nums">
            <CountUp value={4505} suffix=" €" />
          </p>
        </div>
      </div>
    </div>
  );
}

function LedgerPanel() {
  const rows = [
    { u: "T3 Tête d’Or", a: "980 €", ok: true },
    { u: "T4 Villeurbanne", a: "1 210 €", ok: true },
    { u: "Studio Croix-Rousse", a: "560 €", ok: false },
  ];
  return (
    <div className="nireo-panel rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Loyers du mois
        </p>
        <span className="text-[11px] font-medium text-primary tabular-nums">96 % encaissé</span>
      </div>
      <ul className="mt-2.5 divide-y divide-border">
        {rows.map((r) => (
          <li key={r.u} className="flex items-center gap-2 py-1.5 text-xs">
            <span className={cn("size-1.5 shrink-0 rounded-full", r.ok ? "bg-primary" : "bg-amber-500")} />
            <span className="min-w-0 flex-1 truncate text-foreground">{r.u}</span>
            <span className="font-medium text-foreground tabular-nums">{r.a}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MapPanel() {
  const pins = [
    { top: "28%", left: "20%" },
    { top: "46%", left: "56%" },
    { top: "62%", left: "34%" },
    { top: "36%", left: "78%" },
    { top: "70%", left: "66%" },
  ];
  return (
    <div className="nireo-panel relative h-full min-h-32 overflow-hidden rounded-2xl p-3">
      <div className="nireo-blueprint absolute inset-0 opacity-70" aria-hidden />
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(80%_80%_at_30%_20%,var(--nireo-glow-a),transparent_60%)] opacity-10"
      />
      <p className="relative flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <MapPin className="size-3.5 text-primary" /> Patrimoine · Lyon
      </p>
      {pins.map((p, i) => (
        <span key={i} className="absolute" style={{ top: p.top, left: p.left }}>
          <span className="relative flex size-2.5">
            <span className={cn("absolute inline-flex size-full rounded-full bg-primary/40", i === 1 && "nireo-pulse")} />
            <span className="relative inline-flex size-2.5 rounded-full bg-primary ring-2 ring-card" />
          </span>
        </span>
      ))}
    </div>
  );
}

function OccupationDonut() {
  const pct = 92;
  const r = 26;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return (
    <div className="nireo-panel flex h-full items-center gap-3 rounded-2xl p-4">
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
        <span className="absolute text-sm font-semibold text-foreground tabular-nums">92%</span>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Occupation
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">11 / 12 lots loués</p>
        <p className="mt-1 text-[11px] font-medium text-primary">1 studio à relouer</p>
      </div>
    </div>
  );
}

function ActivityStrip() {
  const items = [
    { t: "08:30", label: "Loyer encaissé · T3", on: true },
    { t: "10:15", label: "Bail signé · T4", on: false },
    { t: "13:40", label: "Facture classée", on: false },
    { t: "18:00", label: "Synthèse du jour", on: false },
  ];
  return (
    <div className="nireo-panel rounded-2xl p-2.5">
      <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
        {items.map((it) => (
          <span
            key={it.t}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5"
          >
            <span className="font-mono text-[10px] tracking-widest text-primary">{it.t}</span>
            <span className={cn("size-1.5 rounded-full", it.on ? "bg-primary" : "bg-muted-foreground/40")} />
            <span className="text-[11px] whitespace-nowrap text-foreground">{it.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* Repère d'angle « blueprint » (crop mark). */
function Tick({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("pointer-events-none absolute size-3 border-primary/40", className)}
    />
  );
}

/* ------------------------------- Hero ------------------------------ */

export function HeroCockpit() {
  const { ref, onMove, onLeave } = useParallax();

  return (
    <section className="relative isolate overflow-hidden" onPointerMove={onMove} onPointerLeave={onLeave}>
      {/* Washes d'ambiance émeraude, très diffus. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="nireo-aurora absolute -top-40 right-[-10%] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(closest-side,var(--nireo-glow-a),transparent)] opacity-25 blur-2xl" />
        <div className="nireo-aurora absolute top-40 left-[-12%] h-96 w-96 rounded-full bg-[radial-gradient(closest-side,var(--nireo-glow-b),transparent)] opacity-20 blur-2xl" style={{ animationDelay: "-8s" }} />
      </div>

      <div
        ref={ref}
        className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-4 pt-16 pb-16 sm:px-6 sm:pt-20 lg:grid-cols-12 lg:gap-8 lg:pb-24"
        style={{ ["--mx" as string]: "0", ["--my" as string]: "0" } as React.CSSProperties}
      >
        {/* ---------------- Colonne éditoriale ---------------- */}
        <div className="lg:col-span-5">
          {/* Index façon fiche technique */}
          <div className="animate-nireo-rise flex items-center gap-3" style={{ animationDelay: "0.05s" }}>
            <span className="font-mono text-[11px] tracking-widest text-primary">N°01</span>
            <span className="h-px w-8 bg-primary/40" />
            <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
              Centre de contrôle
            </span>
          </div>

          <h1 className="animate-nireo-rise mt-5 text-[2.6rem] leading-[1.03] font-semibold text-balance text-foreground sm:text-[3.4rem]" style={{ animationDelay: "0.12s" }}>
            Pilotez tout votre patrimoine{" "}
            <span className="nireo-shine">depuis un seul endroit.</span>
          </h1>

          <p className="animate-nireo-rise mt-5 max-w-md text-base leading-relaxed text-balance text-muted-foreground" style={{ animationDelay: "0.2s" }}>
            Loyers, locataires, documents, dépenses et performances réunis dans
            un espace conçu pour les propriétaires exigeants.
          </p>

          <div className="animate-nireo-rise mt-7 flex flex-col gap-3 sm:flex-row sm:items-center" style={{ animationDelay: "0.28s" }}>
            <Link
              href="/inscription"
              onClick={() => track("cta_essai_gratuit", { source: "hero" })}
              className={cn(buttonVariants({ size: "lg" }), "nireo-glow nireo-sheen h-11 px-6 text-[0.95rem]")}
            >
              Commencer gratuitement
              <ArrowRight className="size-4 transition-transform group-hover/button:translate-x-0.5" />
            </Link>
            <a
              href="#demo"
              className="group inline-flex h-11 items-center justify-center gap-1.5 px-2 text-[0.95rem] font-medium text-foreground"
            >
              Découvrir Nireo
              <ArrowUpRight className="size-4 text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>

          <ul className="animate-nireo-rise mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-5" style={{ animationDelay: "0.34s" }}>
            {REASSURE.map((r) => (
              <li key={r.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <r.icon className="size-3.5 text-primary" /> {r.label}
              </li>
            ))}
          </ul>
        </div>

        {/* ---------------- Cockpit (composition claire) ---------------- */}
        <div className="animate-nireo-rise relative lg:col-span-7" style={{ animationDelay: "0.42s", perspective: "1600px" }}>
          {/* Cadre blueprint avec repères d'angle */}
          <div className="relative">
            <Tick className="-top-1.5 -left-1.5 border-t border-l" />
            <Tick className="-top-1.5 -right-1.5 border-t border-r" />
            <Tick className="-bottom-1.5 -left-1.5 border-b border-l" />
            <Tick className="-bottom-1.5 -right-1.5 border-b border-r" />

            {/* Coordonnées « blueprint » (Lyon) */}
            <span className="pointer-events-none absolute -top-6 left-1 hidden font-mono text-[10px] tracking-widest text-muted-foreground/70 sm:block">
              45.76°N · 4.83°E
            </span>
            <span className="pointer-events-none absolute -top-6 right-1 hidden font-mono text-[10px] tracking-widest text-muted-foreground/70 sm:block">
              REV. 07 / 2026
            </span>

            {/* Ligne de cote (dimension) façon plan d'architecte */}
            <span className="pointer-events-none absolute top-2 -left-6 bottom-2 hidden w-px bg-border lg:block" aria-hidden>
              <span className="absolute top-0 -left-1 h-px w-2 bg-border" />
              <span className="absolute bottom-0 -left-1 h-px w-2 bg-border" />
            </span>

            {/* Ombre douce au sol */}
            <div aria-hidden className="pointer-events-none absolute -bottom-8 left-1/2 h-24 w-3/4 -translate-x-1/2 rounded-[100%] bg-primary/10 blur-2xl" />

            <Depth depth={10}>
              <div className="nireo-glass relative overflow-hidden rounded-[1.5rem] p-3 sm:p-4">
                {/* Barre de statut */}
                <div className="flex flex-wrap items-center gap-2 px-1 pb-3">
                  <span className="flex gap-1.5" aria-hidden>
                    <span className="size-2.5 rounded-full bg-border" />
                    <span className="size-2.5 rounded-full bg-border" />
                    <span className="size-2.5 rounded-full bg-border" />
                  </span>
                  <span className="ml-1 text-xs font-medium text-foreground">Centre de contrôle</span>
                  <span className="text-xs text-muted-foreground">· 6 biens · à jour</span>
                  <span className="ml-auto flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    <span className="size-1.5 animate-pulse rounded-full bg-primary" /> En direct
                  </span>
                </div>

                {/* Grille du cockpit — plusieurs couches de panneaux */}
                <div className="grid gap-3 sm:grid-cols-5">
                  <div className="sm:col-span-3"><PatrimoinePanel /></div>
                  <div className="sm:col-span-2"><OccupationDonut /></div>
                  <div className="sm:col-span-3"><LedgerPanel /></div>
                  <div className="sm:col-span-2"><MapPanel /></div>
                  <div className="sm:col-span-5"><ActivityStrip /></div>
                </div>
              </div>
            </Depth>

            {/* Satellites flottants */}
            <Depth depth={36} className="absolute -top-5 -left-3 z-20 sm:-left-10">
              <div className="nireo-float" style={{ ["--float-dur" as string]: "6.5s" } as React.CSSProperties}>
                <div className="nireo-panel flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5">
                  <span className="grid size-8 place-items-center rounded-full bg-primary/12 text-primary"><Check className="size-4" /></span>
                  <span>
                    <span className="block text-[11px] text-muted-foreground">Loyer encaissé</span>
                    <span className="block text-sm font-semibold text-foreground tabular-nums">+1 210 €</span>
                  </span>
                </div>
              </div>
            </Depth>

            <Depth depth={50} className="absolute -top-8 right-2 z-20 hidden sm:block md:-right-8">
              <div className="nireo-float" style={{ ["--float-dur" as string]: "8s", ["--float-delay" as string]: "-2s" } as React.CSSProperties}>
                <div className="nireo-panel max-w-[12rem] rounded-2xl px-3.5 py-2.5">
                  <p className="flex items-center gap-2 text-[11px] text-muted-foreground"><Building2 className="size-3.5 text-primary" /> Nouveau bail</p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground">T4 Villeurbanne · signé</p>
                </div>
              </div>
            </Depth>

            <Depth depth={44} className="absolute -bottom-6 left-4 z-20 hidden sm:block md:-left-8">
              <div className="nireo-float" style={{ ["--float-dur" as string]: "7.4s", ["--float-delay" as string]: "-3.5s" } as React.CSSProperties}>
                <div className="nireo-panel flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5">
                  <span className="nireo-pulse grid size-8 place-items-center rounded-full bg-amber-500/12 text-amber-600"><Bell className="size-4" /></span>
                  <span className="text-[11px] leading-snug text-muted-foreground">Assurance PNO<span className="block font-medium text-foreground">expire dans 3 mois</span></span>
                </div>
              </div>
            </Depth>

            {/* Pièce jointe : document flottant */}
            <Depth depth={28} className="absolute right-6 -bottom-7 z-20 hidden md:block">
              <div className="nireo-float" style={{ ["--float-dur" as string]: "6.8s", ["--float-delay" as string]: "-1.2s" } as React.CSSProperties}>
                <div className="nireo-panel flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5">
                  <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><FileText className="size-4" /></span>
                  <span className="text-[11px] leading-snug text-muted-foreground">Bail — T3 Tête d’Or<span className="block font-medium text-foreground">classé automatiquement</span></span>
                </div>
              </div>
            </Depth>
          </div>
        </div>
      </div>
    </section>
  );
}
