import {
  ArrowUpRight,
  Building2,
  Camera,
  FileText,
  Hammer,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/**
 * Aperçus produit STATIQUES pour la landing page.
 * Construits avec les mêmes primitives visuelles que l'application
 * (bordures, rayons, typographie) — aucune requête, aucune donnée
 * d'utilisateur : uniquement des données d'illustration assumées.
 */

function Frame({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
        className
      )}
    >
      <figcaption className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
        </span>
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <span className="ml-auto text-[10px] text-muted-foreground/70">
          Aperçu — données d&apos;illustration
        </span>
      </figcaption>
      <div className="p-4 sm:p-5">{children}</div>
    </figure>
  );
}

function MiniStat({
  label,
  value,
  hint,
  positive,
}: {
  label: string;
  value: string;
  hint?: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tracking-tight text-foreground">{value}</p>
      {hint ? (
        <p
          className={cn(
            "mt-0.5 flex items-center gap-1 text-[11px]",
            positive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
          )}
        >
          {positive ? <TrendingUp className="size-3" /> : null}
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Cockpit : indicateurs + barres mensuelles (formes pures, sans lib). */
export function DashboardPreview({ className }: { className?: string }) {
  const bars = [42, 58, 50, 66, 61, 74, 70, 82, 78, 88, 84, 92];
  return (
    <Frame title="Tableau de bord — cockpit du patrimoine" className={className}>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <MiniStat label="Logements" value="6" hint="5 loués" />
        <MiniStat label="Loyers du mois" value="4 505 €" hint="+2,1 % vs n−1" positive />
        <MiniStat label="Encaissé" value="3 975 €" hint="88 %" />
        <MiniStat label="Résultat net (année)" value="21 340 €" hint="+8,4 %" positive />
      </div>
      <div className="mt-4 rounded-xl border border-border bg-background p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-foreground">Revenus mensuels</p>
          <p className="text-[11px] text-muted-foreground">12 derniers mois</p>
        </div>
        <div className="mt-3 flex h-24 items-end gap-1.5" aria-hidden>
          {bars.map((height, i) => (
            <span
              key={i}
              style={{ height: `${height}%` }}
              className={cn(
                "flex-1 rounded-t-sm",
                i === bars.length - 1 ? "bg-primary" : "bg-primary/25"
              )}
            />
          ))}
        </div>
      </div>
    </Frame>
  );
}

/** Dossier logement : identité du bien + onglets du dossier vivant. */
export function PropertyDossierPreview({ className }: { className?: string }) {
  const tabs = ["Aperçu", "Locataire", "Loyers", "Documents", "Photos", "Travaux"];
  return (
    <Frame title="Dossier logement — T2 Part-Dieu" className={className}>
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Building2 className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold tracking-tight text-foreground">T2 Part-Dieu</p>
            <Badge variant="secondary">Loué</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            42 m² · 2 pièces · 780 € + 60 € de charges
          </p>
        </div>
        <p className="hidden text-right text-xs text-muted-foreground sm:block">
          Rendement brut
          <span className="block text-sm font-semibold text-foreground">4,9 %</span>
        </p>
      </div>
      <div className="mt-4 flex gap-1 overflow-hidden border-b border-border">
        {tabs.map((tab, i) => (
          <span
            key={tab}
            className={cn(
              "px-2.5 pb-2 text-xs whitespace-nowrap",
              i === 0
                ? "border-b-2 border-foreground font-medium text-foreground"
                : "text-muted-foreground"
            )}
          >
            {tab}
          </span>
        ))}
      </div>
      <ul className="mt-3 space-y-2">
        {[
          { icon: Wallet, text: "Loyer de juillet encaissé", meta: "840 €" },
          { icon: FileText, text: "Bail de location — signé", meta: "PDF · 1,1 Mo" },
          { icon: Camera, text: "Photos d'état des lieux", meta: "8 photos" },
        ].map((row) => (
          <li
            key={row.text}
            className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2"
          >
            <row.icon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-xs text-foreground">{row.text}</span>
            <span className="text-[11px] text-muted-foreground">{row.meta}</span>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

/** Bibliothèque documentaire : catégories + lignes de fichiers. */
export function DocumentsPreview({ className }: { className?: string }) {
  return (
    <Frame title="Documents — bibliothèque du patrimoine" className={className}>
      <div className="flex flex-wrap gap-1.5">
        {["Tous", "Baux", "Diagnostics", "Assurance", "Factures"].map((cat, i) => (
          <span
            key={cat}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px]",
              i === 0
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground"
            )}
          >
            {cat}
          </span>
        ))}
      </div>
      <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-background">
        {[
          { name: "Bail de location — Studio Croix-Rousse", meta: "Bail · 1,2 Mo" },
          { name: "DPE (classe C) — T3 Tête d'Or", meta: "Diagnostic · 790 Ko" },
          { name: "Attestation PNO 2026", meta: "Assurance · expire dans 3 mois" },
          { name: "Facture — remplacement chaudière", meta: "Facture · 310 Ko" },
        ].map((doc) => (
          <li key={doc.name} className="flex items-center gap-2.5 px-3 py-2.5">
            <FileText className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-xs text-foreground">{doc.name}</span>
            <span className="hidden text-[11px] whitespace-nowrap text-muted-foreground sm:block">
              {doc.meta}
            </span>
            <ArrowUpRight className="size-3.5 text-muted-foreground" />
          </li>
        ))}
      </ul>
    </Frame>
  );
}

/** Suivi de chantier : budget, avancement, coût réel. */
export function WorksPreview({ className }: { className?: string }) {
  return (
    <Frame title="Travaux — suivi de chantier" className={className}>
      <div className="rounded-xl border border-border bg-background p-3.5">
        <div className="flex items-start gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Hammer className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              Rénovation cuisine et salle de bain
            </p>
            <p className="text-[11px] text-muted-foreground">
              T2 Monplaisir · BâtiRhône · budget 18 400 €
            </p>
          </div>
          <Badge>En cours</Badge>
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Avancement</span>
            <span className="font-medium text-foreground">65 %</span>
          </div>
          <Progress value={65} aria-label="Avancement du chantier" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Budget", value: "18 400 €" },
            { label: "Engagé", value: "11 960 €" },
            { label: "Facture liée", value: "Devis signé" },
          ].map((cell) => (
            <div key={cell.label} className="rounded-lg bg-muted/50 px-2 py-1.5">
              <p className="text-[10px] text-muted-foreground">{cell.label}</p>
              <p className="text-xs font-medium text-foreground">{cell.value}</p>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/** Statistiques : rentabilité par logement. */
export function StatsPreview({ className }: { className?: string }) {
  const rows = [
    { name: "T4 Villeurbanne", net: "+9 120 €", yieldLabel: "5,4 %", width: 92 },
    { name: "T3 Tête d'Or", net: "+7 480 €", yieldLabel: "4,8 %", width: 76 },
    { name: "Studio Croix-Rousse", net: "+3 940 €", yieldLabel: "5,0 %", width: 40 },
  ];
  return (
    <Frame title="Statistiques — rentabilité par logement" className={className}>
      <ul className="space-y-2.5">
        {rows.map((row) => (
          <li key={row.name} className="rounded-xl border border-border bg-background p-3">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-foreground">{row.name}</span>
              <span className="text-muted-foreground">
                rendement brut{" "}
                <span className="font-medium text-foreground">{row.yieldLabel}</span>
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2.5">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${row.width}%` }}
                />
              </span>
              <span className="text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {row.net}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Frame>
  );
}
