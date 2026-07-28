"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Building2,
  Check,
  CreditCard,
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
        transition: "transform 0.3s cubic-bezier(0.2,0.8,0.2,1)",
      }}
    >
      {children}
    </div>
  );
}

const REASSURE = [
  { icon: CreditCard, label: "Sans carte bancaire" },
  { icon: Zap, label: "Prêt en 2 minutes" },
  { icon: ShieldCheck, label: "Données sécurisées" },
];

/* ---------------------- Panneaux du cockpit ------------------------ */

function MapPanel() {
  const pins = [
    { top: "26%", left: "22%" },
    { top: "44%", left: "58%" },
    { top: "62%", left: "34%" },
    { top: "34%", left: "78%" },
    { top: "72%", left: "68%" },
  ];
  return (
    <div className="relative h-full min-h-40 overflow-hidden rounded-2xl border border-white/8 bg-[radial-gradient(120%_120%_at_20%_10%,oklch(0.28_0.03_262/0.6),transparent),oklch(0.2_0.02_264)] p-3">
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(oklch(1_0_0/0.06)_1px,transparent_1px),linear-gradient(90deg,oklch(1_0_0/0.06)_1px,transparent_1px)] [background-size:24px_24px]" />
      <p className="relative flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <MapPin className="size-3.5 text-primary" /> Patrimoine · Lyon
      </p>
      {pins.map((p, i) => (
        <span key={i} className="absolute" style={{ top: p.top, left: p.left }}>
          <span className="relative flex size-2.5">
            <span className={cn("absolute inline-flex size-full rounded-full bg-primary/50", i === 1 && "nireo-pulse")} />
            <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
          </span>
        </span>
      ))}
    </div>
  );
}

function OverviewPanel() {
  const bars = [40, 55, 48, 66, 60, 74, 69, 82, 78, 88, 84, 94];
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] text-muted-foreground">Valeur du patrimoine</p>
          <p className="text-2xl font-semibold tracking-tight text-foreground">
            <CountUp value={1.24} decimals={2} suffix=" M€" />
          </p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
          <TrendingUp className="size-3" /> +8,4 %
        </span>
      </div>
      <div className="mt-4 flex h-20 items-end gap-1.5" aria-hidden>
        {bars.map((h, i) => (
          <span
            key={i}
            className={cn("flex-1 rounded-t-[3px]", i === bars.length - 1 ? "bg-gradient-to-t from-primary/60 to-primary" : "bg-white/12")}
            style={{ height: `${h}%`, animation: "nireo-grow 0.9s cubic-bezier(0.16,1,0.3,1) both", animationDelay: `${0.4 + i * 0.05}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function RentsPanel() {
  const rows = [
    { u: "T3 Tête d’Or", a: "980 €", tone: "bg-emerald-400" },
    { u: "T4 Villeurbanne", a: "1 210 €", tone: "bg-emerald-400" },
    { u: "Studio Croix-Rousse", a: "560 €", tone: "bg-amber-400" },
  ];
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
      <p className="text-[11px] text-muted-foreground">Loyers du mois</p>
      <ul className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <li key={r.u} className="flex items-center gap-2 text-xs">
            <span className={cn("size-1.5 rounded-full", r.tone)} />
            <span className="min-w-0 flex-1 truncate text-foreground">{r.u}</span>
            <span className="font-medium text-foreground">{r.a}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------- Hero ------------------------------ */

export function HeroCockpit() {
  const { ref, onMove, onLeave } = useParallax();

  return (
    <section className="relative isolate overflow-hidden" onPointerMove={onMove} onPointerLeave={onLeave}>
      {/* Lumière d'ambiance */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="nireo-aurora absolute -top-32 left-1/2 h-[40rem] w-[60rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--nireo-glow-a),transparent)] opacity-40 blur-2xl" />
        <div className="nireo-aurora absolute top-24 right-0 h-96 w-96 rounded-full bg-[radial-gradient(closest-side,var(--nireo-glow-b),transparent)] opacity-25 blur-2xl" style={{ animationDelay: "-8s" }} />
      </div>

      <div ref={ref} className="mx-auto w-full max-w-6xl px-4 pt-16 pb-20 sm:px-6 sm:pt-20" style={{ ["--mx" as string]: "0", ["--my" as string]: "0" } as React.CSSProperties}>
        {/* Accroche */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="animate-nireo-rise nireo-glass-soft mx-auto inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-foreground/80" style={{ animationDelay: "0.05s" }}>
            <span className="size-1.5 rounded-full bg-primary" />
            Le centre de contrôle de votre patrimoine
          </p>
          <h1 className="animate-nireo-rise mt-6 text-[2.7rem] leading-[1.02] font-semibold text-balance text-foreground sm:text-[4.2rem]" style={{ animationDelay: "0.12s" }}>
            Pilotez tout votre patrimoine{" "}
            <span className="nireo-shine">depuis un seul endroit.</span>
          </h1>
          <p className="animate-nireo-rise mx-auto mt-6 max-w-xl text-base leading-relaxed text-balance text-muted-foreground sm:text-lg" style={{ animationDelay: "0.2s" }}>
            Loyers, locataires, documents, dépenses et performances réunis dans
            un espace conçu pour les propriétaires exigeants.
          </p>
          <div className="animate-nireo-rise mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: "0.28s" }}>
            <Link href="/inscription" onClick={() => track("cta_essai_gratuit", { source: "hero" })} className={cn(buttonVariants({ size: "lg" }), "nireo-glow h-11 w-full px-6 text-[0.95rem] sm:w-auto")}>
              Commencer gratuitement
              <ArrowRight className="size-4 transition-transform group-hover/button:translate-x-0.5" />
            </Link>
            <a href="#demo" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "nireo-glass-soft h-11 w-full px-6 text-[0.95rem] text-foreground sm:w-auto")}>
              Découvrir Nireo
            </a>
          </div>
          <ul className="animate-nireo-rise mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2" style={{ animationDelay: "0.34s" }}>
            {REASSURE.map((r) => (
              <li key={r.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <r.icon className="size-3.5 text-primary/80" /> {r.label}
              </li>
            ))}
          </ul>
        </div>

        {/* Cockpit */}
        <div className="animate-nireo-rise relative mx-auto mt-14 max-w-5xl" style={{ animationDelay: "0.42s", perspective: "1600px" }}>
          <div aria-hidden className="pointer-events-none absolute -bottom-12 left-1/2 h-44 w-4/5 -translate-x-1/2 rounded-[100%] bg-primary/20 blur-3xl" />

          <Depth depth={12}>
            <div className="nireo-glass nireo-hairline overflow-hidden rounded-[1.6rem] p-3 sm:p-4">
              {/* Barre de statut */}
              <div className="flex flex-wrap items-center gap-2 px-1 pb-3">
                <span className="flex gap-1.5" aria-hidden>
                  <span className="size-2.5 rounded-full bg-white/15" />
                  <span className="size-2.5 rounded-full bg-white/15" />
                  <span className="size-2.5 rounded-full bg-white/15" />
                </span>
                <span className="ml-1 text-xs font-medium text-foreground">Centre de contrôle</span>
                <span className="text-xs text-muted-foreground">· 6 biens · tout est à jour</span>
                <span className="ml-auto flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> En direct
                </span>
              </div>

              {/* Grille du cockpit */}
              <div className="grid gap-3 md:grid-cols-3">
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
                      <p className="text-[10px] text-muted-foreground">Biens</p>
                      <p className="mt-0.5 text-lg font-semibold text-foreground"><CountUp value={6} /></p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
                      <p className="text-[10px] text-muted-foreground">Occupation</p>
                      <p className="mt-0.5 text-lg font-semibold text-foreground"><CountUp value={92} suffix=" %" /></p>
                    </div>
                  </div>
                  <MapPanel />
                </div>
                <OverviewPanel />
                <RentsPanel />
              </div>
            </div>
          </Depth>

          {/* Satellites flottants */}
          <Depth depth={40} className="absolute -top-5 -left-3 z-20 sm:-left-12">
            <div className="nireo-float" style={{ ["--float-dur" as string]: "6.5s" } as React.CSSProperties}>
              <div className="nireo-glass flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5">
                <span className="grid size-8 place-items-center rounded-full bg-emerald-400/15 text-emerald-300"><Check className="size-4" /></span>
                <span>
                  <span className="block text-[11px] text-muted-foreground">Loyer encaissé</span>
                  <span className="block text-sm font-semibold text-foreground">+1 210 €</span>
                </span>
              </div>
            </div>
          </Depth>

          <Depth depth={54} className="absolute -top-8 right-0 z-20 hidden sm:block md:-right-10">
            <div className="nireo-float" style={{ ["--float-dur" as string]: "8s", ["--float-delay" as string]: "-2s" } as React.CSSProperties}>
              <div className="nireo-glass max-w-[12rem] rounded-2xl px-3.5 py-2.5">
                <p className="flex items-center gap-2 text-[11px] text-muted-foreground"><Building2 className="size-3.5 text-primary" /> Nouveau bail</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">T4 Villeurbanne · signé</p>
              </div>
            </div>
          </Depth>

          <Depth depth={48} className="absolute -bottom-6 left-2 z-20 hidden sm:block md:-left-10">
            <div className="nireo-float" style={{ ["--float-dur" as string]: "7.4s", ["--float-delay" as string]: "-3.5s" } as React.CSSProperties}>
              <div className="nireo-glass flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5">
                <span className="nireo-pulse grid size-8 place-items-center rounded-full bg-amber-400/15 text-amber-300"><Bell className="size-4" /></span>
                <span className="text-[11px] leading-snug text-muted-foreground">Assurance PNO<span className="block font-medium text-foreground">expire dans 3 mois</span></span>
              </div>
            </div>
          </Depth>
        </div>
      </div>
    </section>
  );
}
