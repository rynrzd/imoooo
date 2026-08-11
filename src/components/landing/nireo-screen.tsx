import {
  Building2,
  Camera,
  FileText,
  Hammer,
  Receipt,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { NireoMark } from "@/components/marketing/nireo-logo";
import {
  DOCUMENT_CATEGORY_LABELS,
  EXPENSE_CATEGORY_LABELS,
  RENT_STATUS_LABELS,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

/**
 * Les écrans Nireo montrés sur la landing.
 *
 * Règles tenues ici :
 * - on montre le VRAI produit : mêmes rubriques, mêmes statuts, mêmes
 *   libellés que l'application (`src/lib/labels.ts`) — jamais une interface
 *   inventée plus belle que celle qui existe ;
 * - les chiffres sont des données d'illustration, et le cadre le dit
 *   explicitement à chaque écran ;
 * - aucun état n'est porté par la seule couleur : il est toujours écrit ;
 * - tout est rendu côté serveur, sans requête ni JavaScript. Les seules
 *   animations sont déclenchées par l'attribut `data-active` posé par la
 *   section produit (CSS pur, désactivé si le visiteur limite les animations).
 */

/* ------------------------------------------------------------------ */
/*  Cadre                                                             */
/* ------------------------------------------------------------------ */

function Screen({
  section,
  children,
  className,
  active = false,
}: {
  /** Rubrique de l'application affichée (« Loyers », « Documents »…). */
  section: string;
  children: React.ReactNode;
  className?: string;
  /** Déclenche les micro-animations internes de l'écran. */
  active?: boolean;
}) {
  return (
    <figure
      data-active={active ? "" : undefined}
      className={cn(
        "land-paper overflow-hidden rounded-xl",
        // Ombre froide et courte : une feuille posée, jamais un objet flottant.
        "shadow-[0_1px_2px_rgb(21_26_33/0.05),0_12px_28px_-22px_rgb(21_26_33/0.5)]",
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-border bg-[color-mix(in_srgb,var(--land-ivory)_70%,var(--land-paper))] px-3 py-2 sm:px-3.5">
        <NireoMark flat className="size-5 rounded-[4px]" />
        <span className="truncate text-xs font-medium text-foreground">
          Nireo <span className="text-muted-foreground">· {section}</span>
        </span>
        {/* Mention d'honnêteté : jamais masquée, même à 320 px. */}
        <span className="ml-auto shrink-0 text-[10px] whitespace-nowrap text-muted-foreground">
          Données d&apos;illustration
        </span>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </figure>
  );
}

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
  tone?: "green" | "muted";
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
/*  Tableau de bord (hero)                                            */
/* ------------------------------------------------------------------ */

/** Revenus mensuels : mêmes proportions que le graphique du tableau de bord. */
const MONTHS = [46, 58, 52, 64, 60, 72, 68, 80, 76, 86, 82, 91];

export function DashboardScreen({ className, active }: { className?: string; active?: boolean }) {
  return (
    <Screen section="Tableau de bord" className={className} active={active}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Stat label="Logements" value="6" hint="5 loués · 1 vacant" />
        <Stat label="Loyers du mois" value="4 505 €" hint="attendus" />
        <Stat label="Encaissé" value="3 975 €" hint="88 % du mois" tone="green" />
        <Stat label="Résultat net (année)" value="21 340 €" hint="revenus − dépenses" tone="green" />
      </div>

      <div className="mt-3.5 border-t border-border pt-3">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-medium text-foreground">Revenus mensuels</p>
          <p className="text-[11px] text-muted-foreground">12 derniers mois</p>
        </div>
        <div className="mt-2.5 flex h-14 items-end gap-[3px] sm:h-20 sm:gap-1.5" aria-hidden>
          {MONTHS.map((height, i) => (
            <span
              key={i}
              style={{ height: `${height}%` }}
              className={cn(
                "flex-1 rounded-t-[2px]",
                i === MONTHS.length - 1 ? "bg-primary" : "bg-[color-mix(in_srgb,var(--land-blue)_22%,transparent)]"
              )}
            />
          ))}
        </div>
      </div>

      <ul className="mt-3 divide-y divide-border border-t border-border">
        {[
          { icon: Wallet, text: "Loyer de juillet encaissé — T3 Tête d’Or", meta: "980 €" },
          { icon: FileText, text: "Bail de location signé — Studio Croix-Rousse", meta: "PDF · 1,2 Mo" },
          { icon: Hammer, text: "Rénovation cuisine — T2 Monplaisir", meta: "en cours" },
        ].map((row) => (
          <li key={row.text} className="flex items-center gap-2.5 py-2">
            <row.icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-xs text-foreground">{row.text}</span>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{row.meta}</span>
          </li>
        ))}
      </ul>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/*  Loyers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Loyers du mois. La deuxième ligne bascule d'« À encaisser » à
 * « {RENT_STATUS_LABELS.paye} » quand l'écran devient actif : c'est le geste
 * central du produit. Sans animation, la ligne est simplement affichée payée.
 */
export function RentsScreen({ className, active }: { className?: string; active?: boolean }) {
  const rows = [
    { unit: "T3 Tête d’Or", month: "Juillet 2026", amount: "980 €", status: "paye" as const },
    { unit: "T4 Villeurbanne", month: "Juillet 2026", amount: "1 210 €", status: "swap" as const },
    { unit: "Studio Croix-Rousse", month: "Juillet 2026", amount: "560 €", status: "attente" as const },
    { unit: "T2 Monplaisir", month: "Juin 2026", amount: "755 €", status: "retard" as const },
  ];

  return (
    <Screen section="Loyers" className={className} active={active}>
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
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/*  Documents                                                         */
/* ------------------------------------------------------------------ */

/** Chaque document est rangé dans le dossier du logement auquel il appartient. */
export function DocumentsScreen({ className, active }: { className?: string; active?: boolean }) {
  const docs = [
    { name: "Bail de location.pdf", category: DOCUMENT_CATEGORY_LABELS.bail, target: "T4 Villeurbanne" },
    { name: "Attestation PNO 2026.pdf", category: DOCUMENT_CATEGORY_LABELS.assurance, target: "T3 Tête d’Or" },
    { name: "Facture chaudière.pdf", category: DOCUMENT_CATEGORY_LABELS.factures, target: "T2 Monplaisir" },
    { name: "DPE — classe C.pdf", category: DOCUMENT_CATEGORY_LABELS.diagnostics, target: "Studio Croix-Rousse" },
  ];

  return (
    <Screen section="Documents" className={className} active={active}>
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-3">
        {["Tous", DOCUMENT_CATEGORY_LABELS.bail, DOCUMENT_CATEGORY_LABELS.assurance, DOCUMENT_CATEGORY_LABELS.factures, DOCUMENT_CATEGORY_LABELS.diagnostics].map(
          (tab, i) => (
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
          )
        )}
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
              style={{ ["--d" as string]: `${240 + i * 130}ms` }}
              className="shrink-0 rounded-[3px] bg-[var(--land-blue-pale)] px-1.5 py-0.5 text-[10px] font-medium text-[color-mix(in_srgb,var(--land-blue)_82%,var(--land-ink))]"
            >
              {doc.target}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
        <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
        Espace privé : chaque fichier n’est accessible qu’à votre compte.
      </p>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/*  Dépenses & travaux                                                */
/* ------------------------------------------------------------------ */

export function MoneyScreen({ className, active }: { className?: string; active?: boolean }) {
  const expenses = [
    { label: EXPENSE_CATEGORY_LABELS.travaux, amount: "6 240 €", share: 88 },
    { label: EXPENSE_CATEGORY_LABELS.copropriete, amount: "2 180 €", share: 46 },
    { label: EXPENSE_CATEGORY_LABELS.taxe_fonciere, amount: "1 640 €", share: 34 },
    { label: EXPENSE_CATEGORY_LABELS.assurance, amount: "720 €", share: 16 },
  ];

  return (
    <Screen section="Dépenses & travaux" className={className} active={active}>
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
                style={{ width: `${row.share}%`, ["--d" as string]: `${180 + i * 110}ms` }}
                className="block h-full rounded-full bg-[color-mix(in_srgb,var(--land-blue)_65%,transparent)]"
              />
            </span>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2.5 border-t border-border pt-3">
        <Hammer className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-xs text-foreground">
          Rénovation cuisine — T2 Monplaisir
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">11 960 € / 18 400 €</span>
      </div>

      <p className="mt-3 flex items-baseline justify-between border-t border-border pt-3 text-xs">
        <span className="text-muted-foreground">Résultat net</span>
        <span className="font-semibold tabular-nums text-[var(--land-green)]">+ 21 340 €</span>
      </p>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/*  Dossier d'un logement (section « Tout votre patrimoine »)          */
/* ------------------------------------------------------------------ */

/** Les rubriques rattachées à un logement, telles qu'elles existent. */
const PROPERTY_TABS = [
  { key: "apercu", label: "Aperçu", icon: Building2 },
  { key: "locataire", label: "Locataire", icon: Wallet },
  { key: "loyers", label: "Loyers", icon: Receipt },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "photos", label: "Photos", icon: Camera },
  { key: "travaux", label: "Travaux", icon: Hammer },
] as const;

export function PropertyScreen({ className }: { className?: string }) {
  return (
    <Screen section="Logements · T2 Part-Dieu" className={className}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-[6px] bg-[var(--land-blue-pale)] text-primary">
          <Building2 className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold tracking-tight text-foreground">T2 Part-Dieu</p>
          <p className="text-[11px] text-muted-foreground">
            Lyon 3ᵉ · 42 m² · 2 pièces · 780 € + 60 € de charges
          </p>
        </div>
        <p className="hidden shrink-0 text-right text-[11px] text-muted-foreground sm:block">
          Rendement brut
          <span className="mt-0.5 block text-sm font-semibold tabular-nums text-foreground">4,9 %</span>
        </p>
      </div>

      {/* Les onglets débordent comme dans l'application : le dégradé de droite
          dit que la barre continue, plutôt que de trancher un libellé net. */}
      <div className="mt-3.5 -mx-3 flex gap-0.5 overflow-hidden border-b border-border px-3 [mask-image:linear-gradient(to_right,#000_86%,transparent)] sm:-mx-4 sm:px-4 sm:[mask-image:none]">
        {PROPERTY_TABS.map((tab, i) => (
          <span
            key={tab.key}
            className={cn(
              "px-2 pb-2 text-[11px] whitespace-nowrap sm:text-xs",
              i === 0
                ? "-mb-px border-b-2 border-primary font-medium text-foreground"
                : "text-muted-foreground"
            )}
          >
            {tab.label}
          </span>
        ))}
      </div>

      <ul className="divide-y divide-border">
        {[
          { icon: Wallet, text: "Loyer de juillet", meta: RENT_STATUS_LABELS.paye, paid: true },
          { icon: FileText, text: "Bail de location — signé", meta: "PDF · 1,1 Mo" },
          { icon: Camera, text: "Photos d’état des lieux", meta: "8 photos" },
          { icon: Hammer, text: "Remplacement chaudière", meta: "terminé" },
        ].map((row) => (
          <li key={row.text} className="flex items-center gap-2.5 py-2">
            <row.icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-xs text-foreground">{row.text}</span>
            <span
              className={cn(
                "shrink-0 text-[11px]",
                row.paid ? "font-medium text-[var(--land-green)]" : "text-muted-foreground"
              )}
            >
              {row.meta}
            </span>
          </li>
        ))}
      </ul>
    </Screen>
  );
}
