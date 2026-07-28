"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Building2,
  Check,
  FileText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { CountUp } from "@/components/marketing/count-up";
import { buttonVariants } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Parallaxe douce à la souris — met à jour --mx / --my sur la scène.  */
/* ------------------------------------------------------------------ */
function useParallax() {
  const ref = React.useRef<HTMLDivElement>(null);
  const frame = React.useRef(0);

  const onMove = React.useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width - 0.5;
      const my = (e.clientY - rect.top) / rect.height - 0.5;
      el.style.setProperty("--mx", mx.toFixed(3));
      el.style.setProperty("--my", my.toFixed(3));
    });
  }, []);

  const onLeave = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--mx", "0");
    el.style.setProperty("--my", "0");
  }, []);

  return { ref, onMove, onLeave };
}

/**
 * Couche parallaxe : la translation (souris) vit sur le nœud EXTERNE, le
 * flottement (animation CSS, qui écrit aussi `transform`) sur un nœud INTERNE.
 * Séparer les deux évite que l'animation n'efface la parallaxe.
 */
function Layer({
  depth,
  float,
  className,
  style,
  children,
}: {
  depth: number;
  float?: { dur?: string; delay?: string; rot?: string };
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div
      className={className}
      style={{
        transform: `translate3d(calc(var(--mx, 0) * ${depth}px), calc(var(--my, 0) * ${depth}px), 0)`,
        transition: "transform 0.25s cubic-bezier(0.2,0.8,0.2,1)",
        ...style,
      }}
    >
      {float ? (
        <div
          className="nireo-float"
          style={
            {
              "--float-dur": float.dur ?? "7s",
              "--float-delay": float.delay ?? "0s",
              "--r": float.rot ?? "0deg",
            } as React.CSSProperties
          }
        >
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Cartes satellites (aperçus en orbite autour du tableau de bord).   */
/* ------------------------------------------------------------------ */

function ChipCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "nireo-glass flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tableau de bord central — maquette premium, données d'illustration. */
/* ------------------------------------------------------------------ */

const BARS = [38, 52, 46, 63, 57, 71, 66, 79, 74, 86, 81, 94];

function DashboardStage() {
  return (
    <div className="nireo-glass nireo-hairline w-full max-w-lg rounded-[1.4rem] p-4 sm:p-5">
      {/* Barre de fenêtre */}
      <div className="flex items-center gap-2 pb-4">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
        </span>
        <span className="ml-1 text-xs font-medium text-muted-foreground">
          Tableau de bord
        </span>
        <span className="ml-auto flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
          En direct
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { label: "Patrimoine", node: <CountUp value={1.24} decimals={2} suffix=" M€" /> },
          { label: "Loyers du mois", node: <CountUp value={4505} suffix=" €" /> },
          { label: "Encaissé", node: <CountUp value={96} suffix=" %" /> },
          { label: "Rendement", node: <CountUp value={5.4} decimals={1} suffix=" %" /> },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-white/8 bg-white/[0.03] p-2.5"
          >
            <p className="text-[10px] tracking-wide text-muted-foreground">{kpi.label}</p>
            <p className="mt-1 text-base font-semibold tracking-tight text-foreground">
              {kpi.node}
            </p>
          </div>
        ))}
      </div>

      {/* Graphique */}
      <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.03] p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-foreground">Revenus mensuels</p>
          <p className="flex items-center gap-1 text-[11px] text-emerald-300">
            <TrendingUp className="size-3" /> +8,4 %
          </p>
        </div>
        <div className="mt-3 flex h-24 items-end gap-1.5" aria-hidden>
          {BARS.map((h, i) => (
            <span
              key={i}
              className={cn(
                "flex-1 origin-bottom rounded-t-[3px]",
                i === BARS.length - 1
                  ? "bg-gradient-to-t from-primary/60 to-primary"
                  : "bg-white/12"
              )}
              style={{
                height: `${h}%`,
                animation: "nireo-grow 0.9s cubic-bezier(0.16,1,0.3,1) both",
                animationDelay: `${0.3 + i * 0.05}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  HÉROS                                                               */
/* ------------------------------------------------------------------ */

export function HeroScene() {
  const { ref, onMove, onLeave } = useParallax();

  return (
    <section
      className="relative isolate overflow-hidden"
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {/* Aurore locale derrière la scène (mouvement lent). */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="nireo-aurora absolute -top-24 left-1/2 h-[36rem] w-[52rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--nireo-glow-a),transparent)] opacity-40 blur-2xl" />
        <div
          className="nireo-aurora absolute top-40 right-[8%] h-80 w-80 rounded-full bg-[radial-gradient(closest-side,var(--nireo-glow-b),transparent)] opacity-30 blur-2xl"
          style={{ animationDelay: "-6s" }}
        />
      </div>

      <div
        ref={ref}
        className="mx-auto w-full max-w-6xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24 sm:pb-28"
        style={{ "--mx": "0", "--my": "0" } as React.CSSProperties}
      >
        {/* ---- Accroche ---- */}
        <div className="mx-auto max-w-3xl text-center">
          <p
            className="animate-nireo-rise nireo-glass-soft mx-auto inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-foreground/80"
            style={{ animationDelay: "0.05s" }}
          >
            <Sparkles className="size-3.5 text-primary" />
            Le poste de pilotage de votre patrimoine
          </p>

          <h1
            className="animate-nireo-rise mt-6 text-[2.6rem] font-semibold text-balance text-foreground sm:text-6xl"
            style={{ animationDelay: "0.12s" }}
          >
            Votre patrimoine immobilier,{" "}
            <span className="nireo-shine">enfin sous contrôle.</span>
          </h1>

          <p
            className="animate-nireo-rise mx-auto mt-6 max-w-xl text-base leading-relaxed text-balance text-muted-foreground sm:text-lg"
            style={{ animationDelay: "0.2s" }}
          >
            Logements, locataires, loyers, documents et travaux réunis dans un
            espace unique et vivant. Nireo remplace le tableur et la paperasse
            par la sérénité.
          </p>

          <div
            className="animate-nireo-rise mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ animationDelay: "0.28s" }}
          >
            <Link
              href="/inscription"
              onClick={() => track("cta_essai_gratuit", { source: "hero" })}
              className={cn(
                buttonVariants({ size: "lg" }),
                "nireo-glow h-11 w-full px-6 text-[0.95rem] sm:w-auto"
              )}
            >
              Commencer gratuitement
              <ArrowRight className="size-4 transition-transform group-hover/button:translate-x-0.5" />
            </Link>
            <a
              href="#demo"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "nireo-glass-soft h-11 w-full px-6 text-[0.95rem] text-foreground sm:w-auto"
              )}
            >
              Voir la démonstration
            </a>
          </div>

          <p
            className="animate-nireo-rise mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground"
            style={{ animationDelay: "0.34s" }}
          >
            <ShieldCheck className="size-3.5 text-primary/80" />
            Gratuit pour un premier logement · sans carte bancaire
          </p>
        </div>

        {/* ---- Scène : dashboard + satellites ---- */}
        <div
          className="animate-nireo-rise relative mx-auto mt-16 flex max-w-4xl justify-center"
          style={{ animationDelay: "0.4s", perspective: "1400px" }}
        >
          {/* Reflet / socle lumineux sous la scène */}
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-10 left-1/2 h-40 w-[80%] -translate-x-1/2 rounded-[100%] bg-primary/20 blur-3xl"
          />

          {/* Tableau de bord */}
          <Layer depth={14} className="relative z-10 w-full max-w-lg">
            <DashboardStage />
          </Layer>

          {/* Satellite : loyer encaissé (haut gauche) */}
          <Layer
            depth={42}
            float={{ dur: "6.5s", rot: "-3deg" }}
            className="absolute -top-6 -left-2 z-20 sm:-left-16 md:-left-24"
          >
            <ChipCard>
              <span className="grid size-8 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
                <Check className="size-4" />
              </span>
              <span>
                <span className="block text-[11px] text-muted-foreground">Loyer encaissé</span>
                <span className="block text-sm font-semibold text-foreground">+840 €</span>
              </span>
            </ChipCard>
          </Layer>

          {/* Satellite : rendement (haut droite) */}
          <Layer
            depth={56}
            float={{ dur: "8s", delay: "-1.5s", rot: "3deg" }}
            className="absolute -top-10 right-0 z-20 hidden sm:block md:-right-16"
          >
            <div className="nireo-glass rounded-2xl p-3">
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <TrendingUp className="size-3.5 text-primary" /> Rendement net
              </p>
              <div className="mt-2 flex items-end gap-1" aria-hidden>
                {[30, 44, 38, 58, 52, 70, 82].map((h, i) => (
                  <span
                    key={i}
                    className="w-1.5 rounded-full bg-primary/60"
                    style={{ height: `${h * 0.32}px` }}
                  />
                ))}
              </div>
              <p className="mt-2 text-sm font-semibold text-foreground">
                <CountUp value={8.4} decimals={1} suffix=" %" />
              </p>
            </div>
          </Layer>

          {/* Satellite : bien loué avec « photo » (bas droite) */}
          <Layer
            depth={38}
            float={{ dur: "7.5s", delay: "-3s", rot: "2deg" }}
            className="absolute right-2 -bottom-8 z-20 hidden sm:block md:-right-20"
          >
            <div className="nireo-glass w-40 overflow-hidden rounded-2xl">
              <div className="relative h-16 bg-[linear-gradient(135deg,oklch(0.5_0.09_262),oklch(0.45_0.08_300))]">
                <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/30 px-1.5 py-0.5 text-[9px] font-medium text-emerald-300 backdrop-blur">
                  <span className="size-1 rounded-full bg-emerald-400" /> Loué
                </span>
                <Building2 className="absolute bottom-2 left-2 size-5 text-white/70" />
              </div>
              <div className="px-3 py-2">
                <p className="text-xs font-semibold text-foreground">T3 · Tête d&apos;Or</p>
                <p className="text-[10px] text-muted-foreground">980 € / mois · 5,1 %</p>
              </div>
            </div>
          </Layer>

          {/* Satellite : document signé (bas gauche) */}
          <Layer
            depth={48}
            float={{ dur: "6.8s", delay: "-2s", rot: "-2deg" }}
            className="absolute -bottom-6 left-0 z-20 hidden sm:block sm:-left-10 md:-left-16"
          >
            <ChipCard>
              <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary">
                <FileText className="size-4" />
              </span>
              <span>
                <span className="block text-[11px] text-muted-foreground">Bail de location</span>
                <span className="block text-sm font-semibold text-foreground">Signé · PDF</span>
              </span>
            </ChipCard>
          </Layer>

          {/* Satellite : notification (milieu gauche) */}
          <Layer
            depth={64}
            float={{ dur: "9s", delay: "-4s" }}
            className="absolute top-1/2 -left-4 z-0 hidden -translate-y-1/2 md:block md:-left-32"
          >
            <ChipCard className="max-w-[11rem]">
              <span className="nireo-pulse grid size-8 shrink-0 place-items-center rounded-full bg-amber-400/15 text-amber-300">
                <Bell className="size-4" />
              </span>
              <span className="block text-[11px] leading-snug text-muted-foreground">
                Assurance PNO
                <span className="block font-medium text-foreground">expire dans 3 mois</span>
              </span>
            </ChipCard>
          </Layer>
        </div>
      </div>
    </section>
  );
}
