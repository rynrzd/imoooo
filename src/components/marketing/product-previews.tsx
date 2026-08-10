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
import { EXPENSE_CATEGORY_LABELS, RENT_STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

/**
 * Aperçus produit STATIQUES pour la landing page.
 * Construits avec les mêmes primitives visuelles que l'application
 * (bordures, rayons, typographie) — aucune requête, aucune donnée
 * d'utilisateur : uniquement des données d'illustration assumées.
 *
 * Règle de composition : UN SEUL cadre par aperçu. La fenêtre extérieure
 * (`Frame`) porte la bordure, le rayon, la barre de titre, les trois points
 * et la mention « Aperçu — données d'illustration ». À l'intérieur, plus
 * aucune carte encadrée : uniquement des filets de séparation. C'est ce qui
 * évite l'effet « Nireo affiché dans Nireo ».
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
      <FrameBar title={title} />
      <div className="p-3 sm:p-4">{children}</div>
    </figure>
  );
}

/**
 * Barre de titre — exportée pour que le hero réutilise EXACTEMENT la même
 * (et n'en empile jamais une seconde par-dessus l'aperçu).
 */
export function FrameBar({ title, className }: { title: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 sm:px-4",
        className
      )}
    >
      <span className="flex gap-1.5" aria-hidden>
        <span className="size-2 rounded-full bg-border sm:size-2.5" />
        <span className="size-2 rounded-full bg-border sm:size-2.5" />
        <span className="size-2 rounded-full bg-border sm:size-2.5" />
      </span>
      <span className="truncate text-xs font-medium text-muted-foreground">{title}</span>
      {/* Mention d'honnêteté : jamais masquée, même à 320 px — c'est le titre
          qui se tronque si la place manque. */}
      <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/70">
        Aperçu — données d&apos;illustration
      </span>
    </div>
  );
}

/** Indicateur nu : aucune bordure, aucun fond — c'est le cadre qui encadre. */
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
    <div>
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

/**
 * Contenu du tableau de bord, SANS cadre : statistiques puis graphique.
 * Le hero l'insère directement dans son propre panneau de verre — un seul
 * cadre, une seule barre de titre, une seule mention « données d'illustration ».
 */
export function DashboardPreviewBody() {
  const bars = [42, 58, 50, 66, 61, 74, 70, 82, 78, 88, 84, 92];
  return (
    <>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <MiniStat label="Logements" value="6" hint="5 loués" />
        <MiniStat label="Loyers du mois" value="4 505 €" hint="+2,1 % vs n−1" positive />
        <MiniStat label="Encaissé" value="3 975 €" hint="88 %" />
        <MiniStat label="Résultat net (année)" value="21 340 €" hint="+8,4 %" positive />
      </div>
      <div className="mt-3.5 border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-foreground">Revenus mensuels</p>
          <p className="text-[11px] text-muted-foreground">12 derniers mois</p>
        </div>
        <div className="mt-2.5 flex h-16 items-end gap-1.5 sm:h-24" aria-hidden>
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
    </>
  );
}

/** Cockpit : indicateurs + barres mensuelles (formes pures, sans lib). */
export function DashboardPreview({ className }: { className?: string }) {
  return (
    <Frame title="Tableau de bord" className={className}>
      <DashboardPreviewBody />
    </Frame>
  );
}

/**
 * Loyers : échéances mensuelles avec les statuts RÉELS du produit
 * (`RENT_STATUS_LABELS`) et le rappel de l'historique par logement.
 */
export function RentsPreview({ className }: { className?: string }) {
  const rows = [
    { month: "Juillet 2026", unit: "T3 Tête d’Or", expected: "980 €", received: "980 €", status: "paye" },
    { month: "Juillet 2026", unit: "T4 Villeurbanne", expected: "1 210 €", received: "1 210 €", status: "paye" },
    { month: "Juillet 2026", unit: "Studio Croix-Rousse", expected: "560 €", received: "—", status: "attente" },
    { month: "Juin 2026", unit: "T2 Monplaisir", expected: "755 €", received: "400 €", status: "partiel" },
  ] as const;

  const TONE: Record<string, string> = {
    paye: "border-primary/30 bg-primary/10 text-primary",
    attente: "border-border bg-muted/60 text-muted-foreground",
    partiel: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    retard: "border-destructive/30 bg-destructive/10 text-destructive",
  };

  return (
    <Frame title="Loyers du mois" className={className}>
      <div className="grid grid-cols-2 gap-x-4">
        <MiniStat label="Prévu ce mois" value="3 505 €" />
        <MiniStat label="Encaissé" value="2 590 €" hint="1 échéance à vérifier" />
      </div>
      <ul className="mt-3 divide-y divide-border border-t border-border">
        {rows.map((row) => (
          <li key={`${row.month}-${row.unit}`} className="flex items-center gap-2.5 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-foreground">{row.unit}</span>
              <span className="block text-[11px] text-muted-foreground">{row.month}</span>
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">{row.received}</span>
            <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
              / {row.expected}
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                TONE[row.status]
              )}
            >
              {RENT_STATUS_LABELS[row.status]}
            </span>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

/**
 * Dépenses & travaux : catégories réelles (`EXPENSE_CATEGORY_LABELS`) et
 * suivi d'un chantier relié au logement.
 */
export function ExpensesPreview({ className }: { className?: string }) {
  const rows = [
    { category: "travaux" as const, amount: "6 240 €", share: 88 },
    { category: "copropriete" as const, amount: "2 180 €", share: 46 },
    { category: "taxe_fonciere" as const, amount: "1 640 €", share: 34 },
    { category: "assurance" as const, amount: "720 €", share: 16 },
  ];
  return (
    <Frame title="Dépenses" className={className}>
      <div className="grid grid-cols-2 gap-x-4">
        <MiniStat label="Dépenses" value="10 780 €" />
        <MiniStat label="Résultat net" value="21 340 €" hint="revenus − dépenses" positive />
      </div>
      <ul className="mt-3 space-y-2 border-t border-border pt-3">
        {rows.map((row) => (
          <li key={row.category}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-foreground">{EXPENSE_CATEGORY_LABELS[row.category]}</span>
              <span className="tabular-nums text-muted-foreground">{row.amount}</span>
            </div>
            <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span
                className="block h-full rounded-full bg-primary/70"
                style={{ width: `${row.share}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-2.5 border-t border-border pt-3">
        <Hammer className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-xs text-foreground">
          Rénovation cuisine — T2 Monplaisir
        </span>
        <Badge variant="secondary">En cours</Badge>
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
    <Frame title="Documents" className={className}>
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
      <ul className="mt-3 divide-y divide-border border-t border-border">
        {[
          { name: "Bail de location — Studio Croix-Rousse", meta: "Bail · 1,2 Mo" },
          { name: "DPE (classe C) — T3 Tête d'Or", meta: "Diagnostic · 790 Ko" },
          { name: "Attestation PNO 2026", meta: "Assurance · expire dans 3 mois" },
          { name: "Facture — remplacement chaudière", meta: "Facture · 310 Ko" },
        ].map((doc) => (
          <li key={doc.name} className="flex items-center gap-2.5 py-2.5">
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
