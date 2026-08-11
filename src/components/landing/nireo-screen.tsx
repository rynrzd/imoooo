import { Bell, FileText } from "lucide-react";
import { NireoMark } from "@/components/marketing/nireo-logo";
import { MAIN_NAV } from "@/config/nav";
import {
  DOCUMENT_CATEGORY_LABELS,
  EXPENSE_CATEGORY_LABELS,
  RENT_STATUS_LABELS,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

/**
 * L'écran Nireo de la landing — UN SEUL grand cadre, qui change d'état.
 *
 * Règles tenues ici :
 * - c'est le VRAI produit : la barre latérale reprend `src/config/nav.ts`, les
 *   statuts et les catégories viennent de `src/lib/labels.ts`. Rien n'est
 *   inventé plus beau que ce qui existe ;
 * - les montants sont des exemples : la page l'écrit UNE fois, sous le cadre
 *   (`product-showcase.tsx`), plutôt qu'une pastille répétée sur chaque écran ;
 * - un seul cadre : la barre de fenêtre et la barre latérale font partie du
 *   même bloc, jamais un cadre dans un cadre ;
 * - tout est rendu côté serveur, sans requête. Les micro-animations internes
 *   sont en CSS pur et ne tournent que sur l'état actif (`data-active`).
 */

export const SCREEN_STATES = ["loyers", "documents", "argent"] as const;

export type ScreenState = (typeof SCREEN_STATES)[number];

/**
 * Rubrique RÉELLE de l'application affichée par chaque état : les libellés
 * viennent de la navigation du produit, ils ne sont pas ressaisis ici.
 * « Dépenses et travaux » se lit dans Statistiques — l'analyse financière du
 * patrimoine sur 12 mois, où la catégorie « Travaux » est une dépense.
 */
const STATE_SECTION: Record<ScreenState, string> = {
  loyers: "Loyers",
  documents: "Documents",
  argent: "Statistiques",
};

/* ------------------------------------------------------------------ */
/*  Éléments communs                                                  */
/* ------------------------------------------------------------------ */

/** Indicateur nu — c'est le cadre qui encadre, jamais une carte de plus. */
function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "green";
}) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[1.05rem] font-semibold tracking-tight tabular-nums text-foreground sm:text-lg">
        {value}
      </p>
      {hint ? (
        <p
          className={cn(
            "mt-0.5 text-[11px] tabular-nums",
            tone === "green" ? "text-[var(--land-green)]" : "text-muted-foreground"
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Pastille d'état : liseré net, fond très pâle, libellé toujours écrit. */
function Status({ tone, children }: { tone: "paid" | "pending" | "late"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-[3px] border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap",
        tone === "paid" &&
          "border-[color-mix(in_srgb,var(--land-green)_35%,transparent)] bg-[color-mix(in_srgb,var(--land-green)_9%,var(--land-paper))] text-[var(--land-green)]",
        tone === "pending" && "border-border bg-muted text-muted-foreground",
        tone === "late" &&
          "border-[color-mix(in_srgb,var(--destructive)_35%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_8%,var(--land-paper))] text-[var(--destructive)]"
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Contenus par état                                                 */
/* ------------------------------------------------------------------ */

/** Loyers du mois : la deuxième ligne bascule à « Payé » — le geste du produit. */
function RentsPanel() {
  const rows = [
    { unit: "T3 Tête d’Or", month: "Juillet 2026", amount: "980 €", status: "paye" as const },
    { unit: "T4 Villeurbanne", month: "Juillet 2026", amount: "1 210 €", status: "swap" as const },
    { unit: "Studio Croix-Rousse", month: "Juillet 2026", amount: "560 €", status: "attente" as const },
    { unit: "T2 Monplaisir", month: "Juin 2026", amount: "755 €", status: "retard" as const },
  ];

  return (
    <>
      <div className="grid grid-cols-3 gap-x-3 border-b border-border pb-3">
        <Stat label="Attendus" value="4 505 €" />
        <Stat label="Encaissé" value="3 975 €" hint="+ 1 210 € aujourd’hui" tone="green" />
        <Stat label="En retard" value="755 €" hint="1 échéance" />
      </div>

      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={`${row.unit}-${row.month}`} className="flex items-center gap-2.5 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-foreground">{row.unit}</span>
              <span className="block text-[11px] text-muted-foreground">{row.month}</span>
            </span>
            <span className="shrink-0 text-xs tabular-nums text-foreground">{row.amount}</span>
            {row.status === "swap" ? (
              <span className="land-swap">
                <span data-from>
                  <Status tone="pending">À encaisser</Status>
                </span>
                <span data-to>
                  <Status tone="paid">{RENT_STATUS_LABELS.paye}</Status>
                </span>
              </span>
            ) : (
              <Status tone={row.status === "paye" ? "paid" : row.status === "retard" ? "late" : "pending"}>
                {RENT_STATUS_LABELS[row.status]}
              </Status>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-3 flex items-baseline justify-between border-t border-border pt-3 text-xs">
        <span className="text-muted-foreground">Résultat net du mois</span>
        <span className="font-semibold tabular-nums text-[var(--land-green)]">+ 2 860 €</span>
      </p>
    </>
  );
}

/** Chaque document est rangé dans le dossier du logement auquel il appartient. */
function DocumentsPanel() {
  const docs = [
    { name: "Bail de location.pdf", category: DOCUMENT_CATEGORY_LABELS.bail, target: "T4 Villeurbanne" },
    { name: "Attestation PNO 2026.pdf", category: DOCUMENT_CATEGORY_LABELS.assurance, target: "T3 Tête d’Or" },
    { name: "Facture chaudière.pdf", category: DOCUMENT_CATEGORY_LABELS.factures, target: "T2 Monplaisir" },
    { name: "DPE — classe C.pdf", category: DOCUMENT_CATEGORY_LABELS.diagnostics, target: "Studio Croix-Rousse" },
  ];

  return (
    <>
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-3">
        {[
          "Tous",
          DOCUMENT_CATEGORY_LABELS.bail,
          DOCUMENT_CATEGORY_LABELS.assurance,
          DOCUMENT_CATEGORY_LABELS.factures,
          DOCUMENT_CATEGORY_LABELS.diagnostics,
        ].map((tab, i) => (
          <span
            key={tab}
            className={cn(
              "rounded-[3px] border px-2 py-0.5 text-[11px]",
              i === 0
                ? "border-foreground bg-foreground text-[var(--land-paper)]"
                : "border-border text-muted-foreground"
            )}
          >
            {tab}
          </span>
        ))}
      </div>

      <ul className="divide-y divide-border">
        {docs.map((doc, i) => (
          <li key={doc.name} className="flex items-center gap-2.5 py-2.5">
            <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-foreground">{doc.name}</span>
              <span className="block text-[11px] text-muted-foreground">{doc.category}</span>
            </span>
            {/* Le classement se révèle ligne après ligne : le document rejoint
                son logement. Sans animation, la destination est déjà écrite. */}
            <span
              data-settle
              style={{ ["--d" as string]: `${200 + i * 120}ms` }}
              className="shrink-0 rounded-[3px] bg-[var(--land-blue-pale)] px-1.5 py-0.5 text-[10px] font-medium text-[color-mix(in_srgb,var(--land-blue)_82%,var(--land-ink))]"
            >
              {doc.target}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 border-t border-border pt-3 text-[11px] text-muted-foreground">
        Espace privé : chaque fichier n’est accessible qu’à votre compte.
      </p>
    </>
  );
}

/** Dépenses classées et chantier suivi : les chiffres se recalculent seuls. */
function MoneyPanel() {
  const expenses = [
    { label: EXPENSE_CATEGORY_LABELS.travaux, amount: "6 240 €", share: 88 },
    { label: EXPENSE_CATEGORY_LABELS.copropriete, amount: "2 180 €", share: 46 },
    { label: EXPENSE_CATEGORY_LABELS.taxe_fonciere, amount: "1 640 €", share: 34 },
    { label: EXPENSE_CATEGORY_LABELS.assurance, amount: "720 €", share: 16 },
  ];

  return (
    <>
      <div className="grid grid-cols-3 gap-x-3 border-b border-border pb-3">
        <Stat label="Revenus (année)" value="32 120 €" />
        <Stat label="Dépenses" value="10 780 €" />
        <Stat label="Rentabilité brute" value="5,1 %" hint="moyenne du parc" tone="green" />
      </div>

      <ul className="space-y-2 py-3">
        {expenses.map((row, i) => (
          <li key={row.label}>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-foreground">{row.label}</span>
              <span className="tabular-nums text-muted-foreground">{row.amount}</span>
            </div>
            <span className="mt-1 block h-[3px] overflow-hidden rounded-full bg-muted" aria-hidden>
              <span
                data-grow
                style={{ width: `${row.share}%`, ["--d" as string]: `${160 + i * 110}ms` }}
                className="block h-full rounded-full bg-[color-mix(in_srgb,var(--land-blue)_65%,transparent)]"
              />
            </span>
          </li>
        ))}
      </ul>

      <p className="flex items-baseline justify-between border-t border-border pt-3 text-xs">
        <span className="text-muted-foreground">Résultat net</span>
        <span className="font-semibold tabular-nums text-[var(--land-green)]">+ 21 340 €</span>
      </p>
    </>
  );
}

const PANELS: Record<ScreenState, () => React.ReactNode> = {
  loyers: RentsPanel,
  documents: DocumentsPanel,
  argent: MoneyPanel,
};

/* ------------------------------------------------------------------ */
/*  Le cadre                                                          */
/* ------------------------------------------------------------------ */

/**
 * Le grand écran de la page. Il ne change QUE de contenu : le cadre, la barre
 * latérale et la barre de titre restent en place d'un état à l'autre — c'est
 * bien le même produit qu'on parcourt, pas trois images différentes.
 */
export function NireoAppScreen({
  state,
  className,
  active = true,
}: {
  state: ScreenState;
  className?: string;
  /** Déclenche les micro-animations internes de l'état affiché. */
  active?: boolean;
}) {
  const Panel = PANELS[state];
  const section = STATE_SECTION[state];
  const SectionIcon = MAIN_NAV.find((item) => item.title === section)?.icon;

  return (
    <figure
      data-active={active ? "" : undefined}
      className={cn(
        "land-paper overflow-hidden rounded-xl",
        // Ombre froide et courte : une feuille posée, jamais un objet flottant.
        "shadow-[0_1px_2px_rgb(21_26_33/0.05),0_18px_40px_-30px_rgb(21_26_33/0.55)]",
        className
      )}
    >
      {/* Barre de titre — le seul « chrome » de l'écran. */}
      <div className="flex items-center gap-2 border-b border-border bg-[color-mix(in_srgb,var(--land-ivory)_70%,var(--land-paper))] px-3 py-2 sm:px-4">
        <NireoMark flat className="size-5 rounded-[4px]" />
        <span className="truncate text-xs font-medium text-foreground">
          Nireo <span className="text-muted-foreground">· {section}</span>
        </span>
        <Bell className="ml-auto size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="shrink-0 text-[11px] whitespace-nowrap text-muted-foreground">
          Mon compte
        </span>
      </div>

      <div className="grid sm:grid-cols-[8.75rem_1fr]">
        {/* Barre latérale : les rubriques RÉELLES de l'application. */}
        <nav
          aria-hidden
          className="hidden flex-col gap-0.5 bg-[var(--land-night)] px-2 py-3 sm:flex"
        >
          {MAIN_NAV.map((item) => {
            const current = item.title === section;
            return (
              <span
                key={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-[4px] px-2 py-1.5 text-[11px] whitespace-nowrap",
                  current
                    ? "bg-[color-mix(in_srgb,var(--land-blue)_55%,transparent)] font-medium text-[var(--land-paper)]"
                    : "text-[rgb(252_251_248/0.6)]"
                )}
              >
                <item.icon className="size-3.5 shrink-0" />
                {item.title}
              </span>
            );
          })}
        </nav>

        <div className="min-w-0 p-3 sm:p-4">
          {/* Sur mobile la barre latérale est masquée : la rubrique courante
              reste écrite, jamais devinée par la seule couleur. */}
          <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-medium text-primary sm:hidden">
            {SectionIcon ? <SectionIcon className="size-3.5 shrink-0" aria-hidden /> : null}
            {section}
          </p>
          <Panel />
        </div>
      </div>
    </figure>
  );
}
