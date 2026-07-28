"use client";

import * as React from "react";
import {
  Banknote,
  Building2,
  ChevronRight,
  FileText,
  LineChart,
  Receipt,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Démonstration produit INTERACTIVE — le visiteur navigue entre six scénarios
 * réels de Nireo ; chaque changement recompose l'interface avec une transition
 * douce. Aucune image, aucune vidéo : de vraies maquettes d'écran.
 */

type Scene = {
  id: string;
  label: string;
  icon: LucideIcon;
  title: string;
  caption: string;
  render: () => React.ReactNode;
};

/* ------------------------------- Écrans ---------------------------- */

function RentScene() {
  const rows = [
    { name: "T3 · Tête d’Or", tenant: "Camille Roux", amount: "980 €", state: "Encaissé", tone: "emerald" },
    { name: "T2 · Part-Dieu", tenant: "Marc Lefèvre", amount: "840 €", state: "En attente", tone: "amber" },
    { name: "Studio · Croix-Rousse", tenant: "Léa Bernard", amount: "560 €", state: "En retard", tone: "rose" },
    { name: "T4 · Villeurbanne", tenant: "Yann Diallo", amount: "1 210 €", state: "Encaissé", tone: "emerald" },
  ];
  const tone: Record<string, string> = {
    emerald: "text-emerald-300 bg-emerald-400/10",
    amber: "text-amber-300 bg-amber-400/10",
    rose: "text-rose-300 bg-rose-400/10",
  };
  return (
    <div className="grid gap-4 sm:grid-cols-[1.6fr_1fr]">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Loyers · Juillet 2026</p>
          <p className="text-xs text-muted-foreground">4 échéances</p>
        </div>
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.name} className="flex items-center gap-3 rounded-xl border border-border bg-muted/50 px-3 py-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
                <Banknote className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">{r.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{r.tenant}</span>
              </span>
              <span className="text-sm font-semibold text-foreground">{r.amount}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", tone[r.tone])}>{r.state}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Encaissé ce mois</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">3 190 €</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary" style={{ width: "84%" }} />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">84 % du total attendu</p>
        </div>
        <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.05] p-4">
          <p className="text-xs font-medium text-amber-300">1 relance à envoyer</p>
          <p className="mt-1 text-sm text-foreground">Léa Bernard · retard de 6 jours</p>
        </div>
      </div>
    </div>
  );
}

function PropertyScene() {
  const props = [
    { name: "T3 Tête d’Or", meta: "68 m² · loué", yield: "5,1 %", grad: "from-sky-500/40 to-indigo-500/30" },
    { name: "Studio Croix-Rousse", meta: "26 m² · loué", yield: "5,4 %", grad: "from-violet-500/40 to-fuchsia-500/25" },
    { name: "T4 Villeurbanne", meta: "82 m² · loué", yield: "4,8 %", grad: "from-emerald-500/35 to-teal-500/25" },
    { name: "T2 Part-Dieu", meta: "44 m² · en travaux", yield: "—", grad: "from-amber-500/35 to-orange-500/25" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {props.map((p) => (
        <div key={p.name} className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className={cn("relative h-20 bg-gradient-to-br", p.grad)}>
            <Building2 className="absolute bottom-2 left-2 size-5 text-white/70" />
          </div>
          <div className="p-3">
            <p className="truncate text-xs font-semibold text-foreground">{p.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{p.meta}</p>
            <p className="mt-1.5 text-[11px] text-primary">Rendement {p.yield}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function DocumentsScene() {
  const cats = ["Tous", "Baux", "Diagnostics", "Assurances", "Factures"];
  const files = [
    { name: "Bail — T3 Tête d’Or", meta: "Bail · 1,2 Mo" },
    { name: "DPE (classe C) — T4", meta: "Diagnostic · 790 Ko" },
    { name: "Attestation PNO 2026", meta: "Assurance · expire dans 3 mois" },
    { name: "Facture chaudière", meta: "Facture · 310 Ko" },
  ];
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap gap-1.5">
        {cats.map((c, i) => (
          <span
            key={c}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px]",
              i === 0 ? "border-transparent bg-primary text-primary-foreground" : "border-border text-muted-foreground"
            )}
          >
            {c}
          </span>
        ))}
      </div>
      <ul className="mt-3 divide-y divide-border">
        {files.map((f) => (
          <li key={f.name} className="flex items-center gap-3 py-2.5">
            <FileText className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">{f.name}</span>
            <span className="hidden text-[11px] text-muted-foreground sm:block">{f.meta}</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExpensesScene() {
  const cats = [
    { label: "Travaux", value: 62, amount: "6 480 €" },
    { label: "Charges", value: 40, amount: "4 150 €" },
    { label: "Assurance", value: 22, amount: "2 260 €" },
    { label: "Taxe foncière", value: 34, amount: "3 540 €" },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-medium text-foreground">Dépenses par catégorie</p>
        <ul className="mt-4 space-y-3">
          {cats.map((c) => (
            <li key={c.label}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{c.label}</span>
                <span className="font-medium text-foreground">{c.amount}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary" style={{ width: `${c.value}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-4">
        <div>
          <p className="text-xs text-muted-foreground">Total dépenses (année)</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">16 430 €</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/50 p-3">
          <p className="text-[11px] text-muted-foreground">Reliées automatiquement</p>
          <p className="text-sm text-foreground">à vos travaux et à la comptabilité</p>
        </div>
      </div>
    </div>
  );
}

function TenantsScene() {
  const tenants = [
    { name: "Camille Roux", unit: "T3 Tête d’Or", since: "depuis mars 2024", deposit: "1 960 €" },
    { name: "Yann Diallo", unit: "T4 Villeurbanne", since: "depuis sept. 2023", deposit: "2 420 €" },
    { name: "Léa Bernard", unit: "Studio Croix-Rousse", since: "depuis janv. 2025", deposit: "1 120 €" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {tenants.map((t) => (
        <div key={t.name} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-primary/30 to-primary/5 text-sm font-semibold text-foreground ring-1 ring-border">
              {t.name.split(" ").map((w) => w[0]).join("")}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{t.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{t.unit}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-[11px]">
            <span className="text-muted-foreground">{t.since}</span>
            <span className="text-foreground">Dépôt {t.deposit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function PerformanceScene() {
  const bars = [48, 62, 55, 70, 64, 78, 73, 86, 81, 90, 85, 96];
  return (
    <div className="grid gap-4 sm:grid-cols-[1.6fr_1fr]">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Revenus nets · 12 mois</p>
          <p className="text-xs text-primary">+8,4 %</p>
        </div>
        <div className="mt-4 flex h-28 items-end gap-1.5">
          {bars.map((h, i) => (
            <span
              key={i}
              className={cn("flex-1 rounded-t-[3px]", i === bars.length - 1 ? "bg-gradient-to-t from-primary/60 to-primary" : "bg-muted")}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
        {[
          { l: "Résultat net", v: "21 340 €" },
          { l: "Rendement moyen", v: "5,1 %" },
          { l: "Taux d’occupation", v: "92 %" },
        ].map((k) => (
          <div key={k.l} className="rounded-2xl border border-border bg-card p-3">
            <p className="text-[11px] text-muted-foreground">{k.l}</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{k.v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const SCENES: Scene[] = [
  { id: "loyers", label: "Suivre les loyers", icon: Banknote, title: "Chaque loyer, à sa place", caption: "Encaissements, retards et relances suivis automatiquement, mois après mois.", render: RentScene },
  { id: "logements", label: "Gérer les logements", icon: Building2, title: "Tout votre parc en un regard", caption: "Chaque bien, son statut, son rendement — du studio à la SCI.", render: PropertyScene },
  { id: "documents", label: "Retrouver les documents", icon: FileText, title: "Le bon document en deux secondes", caption: "Baux, diagnostics, assurances et factures classés par logement.", render: DocumentsScene },
  { id: "depenses", label: "Suivre les dépenses", icon: Receipt, title: "Des dépenses toujours maîtrisées", caption: "Catégorisées, reliées aux travaux, prêtes pour la comptabilité.", render: ExpensesScene },
  { id: "locataires", label: "Suivre les locataires", icon: Users, title: "Vos locataires, dossiers complets", caption: "Baux, dates, dépôts de garantie — carrés et retrouvables.", render: TenantsScene },
  { id: "performances", label: "Analyser les performances", icon: LineChart, title: "La performance réelle de votre patrimoine", caption: "Résultat net, rendement et occupation calculés en continu.", render: PerformanceScene },
];

export function ProductDemo() {
  const [active, setActive] = React.useState(0);
  const scene = SCENES[active];

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      {/* Rail de scénarios */}
      <div
        role="tablist"
        aria-label="Scénarios de démonstration"
        className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] lg:flex-col lg:overflow-visible lg:pb-0"
      >
        {SCENES.map((s, i) => {
          const on = i === active;
          return (
            <button
              key={s.id}
              role="tab"
              aria-selected={on}
              onClick={() => setActive(i)}
              className={cn(
                "group flex shrink-0 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all lg:shrink",
                on
                  ? "nireo-glass border-primary/20 text-foreground"
                  : "border-border text-muted-foreground hover:border-primary/25 hover:text-foreground"
              )}
            >
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl border border-border transition-colors", on ? "bg-primary/15 text-primary" : "bg-muted")}>
                <s.icon className="size-4.5" />
              </span>
              <span className="text-sm font-medium whitespace-nowrap lg:whitespace-normal">{s.label}</span>
              <ChevronRight className={cn("ml-auto hidden size-4 transition-transform lg:block", on ? "translate-x-0 text-primary" : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100")} />
            </button>
          );
        })}
      </div>

      {/* Fenêtre de démonstration */}
      <div className="nireo-glass nireo-hairline overflow-hidden rounded-3xl">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
          </span>
          <span className="ml-1 text-xs font-medium text-muted-foreground">nireo.app / {scene.id}</span>
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" /> démo
          </span>
        </div>
        <div className="p-4 sm:p-6">
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-foreground">{scene.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{scene.caption}</p>
          </div>
          {/* La clé force une transition d'entrée à chaque changement de scène. */}
          <div key={scene.id} className="animate-nireo-rise">{scene.render()}</div>
        </div>
      </div>
    </div>
  );
}
