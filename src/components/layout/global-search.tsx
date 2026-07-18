"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  FileText,
  Hammer,
  Search,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatMonth } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Recherche globale (Ctrl/⌘ + K) — instantanée, côté client, sur les
 * données réelles déjà chargées (RLS : uniquement celles de l'utilisateur).
 * Résultats groupés : logements, locataires, baux, loyers, documents, travaux.
 */

interface SearchResult {
  id: string;
  group: string;
  icon: LucideIcon;
  label: string;
  detail: string;
  href: string;
}

/** Minuscule sans accents : « Éte » trouve « été ». */
function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const GROUP_ORDER = ["Logements", "Locataires", "Baux", "Loyers", "Documents", "Travaux"];
const MAX_PER_GROUP = 5;

export function GlobalSearch({ variant = "sidebar" }: { variant?: "sidebar" | "icon" }) {
  const { data } = useAppStore();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);

  // Raccourci clavier global.
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = React.useMemo<SearchResult[]>(() => {
    const needle = fold(query.trim());
    if (needle.length < 2) return [];
    const matches = (...fields: (string | null | undefined)[]) =>
      fields.some((f) => f && fold(f).includes(needle));
    const propertyName = (id: string) =>
      data.properties.find((p) => p.id === id)?.name ?? "Logement";

    const found: SearchResult[] = [];

    for (const property of data.properties) {
      if (!matches(property.name, property.address, property.city)) continue;
      found.push({
        id: `p-${property.id}`,
        group: "Logements",
        icon: Building2,
        label: property.name,
        detail: `${property.address}, ${property.city}`,
        href: `/logements/${property.id}`,
      });
    }
    for (const tenant of data.tenants) {
      const fullName = `${tenant.firstName} ${tenant.lastName}`;
      if (!matches(fullName, tenant.email, tenant.phone)) continue;
      found.push({
        id: `t-${tenant.id}`,
        group: "Locataires",
        icon: UserRound,
        label: fullName,
        detail: propertyName(tenant.propertyId),
        href: `/locataires/${tenant.id}`,
      });
      // Le bail est porté par le locataire (un locataire = un bail).
      if (matches(fullName, propertyName(tenant.propertyId))) {
        found.push({
          id: `b-${tenant.id}`,
          group: "Baux",
          icon: FileText,
          label: `Bail — ${propertyName(tenant.propertyId)}`,
          detail: `${fullName} · ${tenant.exitDate ? "terminé" : "en cours"}`,
          href: `/locataires/${tenant.id}`,
        });
      }
    }
    for (const payment of data.rentPayments) {
      if (!matches(propertyName(payment.propertyId), payment.month)) continue;
      found.push({
        id: `r-${payment.id}`,
        group: "Loyers",
        icon: Wallet,
        label: `${formatMonth(payment.month)} — ${propertyName(payment.propertyId)}`,
        detail: `${formatCurrency(payment.received)} / ${formatCurrency(payment.expected)}`,
        href: "/loyers",
      });
    }
    for (const document of data.documents) {
      if (!matches(document.name, propertyName(document.propertyId))) continue;
      found.push({
        id: `d-${document.id}`,
        group: "Documents",
        icon: FileText,
        label: document.name,
        detail: propertyName(document.propertyId),
        href: "/documents",
      });
    }
    for (const work of data.works) {
      if (!matches(work.title, work.company, propertyName(work.propertyId))) continue;
      found.push({
        id: `w-${work.id}`,
        group: "Travaux",
        icon: Hammer,
        label: work.title,
        detail: `${propertyName(work.propertyId)}${work.company ? ` · ${work.company}` : ""}`,
        href: "/travaux",
      });
    }

    // Groupes ordonnés, plafonnés — navigation lisible.
    return GROUP_ORDER.flatMap((group) =>
      found.filter((r) => r.group === group).slice(0, MAX_PER_GROUP)
    );
  }, [data, query]);

  const go = React.useCallback(
    (result: SearchResult) => {
      setOpen(false);
      setQuery("");
      router.push(result.href);
    },
    [router]
  );

  const onInputKey = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter" && results[active]) {
      event.preventDefault();
      go(results[active]);
    }
  };

  let lastGroup = "";

  return (
    <>
      {variant === "sidebar" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Search className="size-3.5" aria-hidden />
          Rechercher…
          <kbd className="ml-auto rounded border border-border bg-muted px-1.5 text-[10px] font-medium">
            Ctrl K
          </kbd>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Rechercher"
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Search className="size-4" />
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-24 max-w-lg translate-y-0 p-0">
          <DialogTitle className="sr-only">Recherche globale</DialogTitle>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0); // la sélection repart en tête à chaque frappe
              }}
              onKeyDown={onInputKey}
              placeholder="Logement, locataire, document, chantier…"
              aria-label="Rechercher dans votre patrimoine"
              className="w-full bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {query.trim().length < 2 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Tapez au moins 2 caractères pour rechercher dans tout votre patrimoine.
              </p>
            ) : results.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Aucun résultat pour « {query.trim()} ».
              </p>
            ) : (
              results.map((result, index) => {
                const showGroup = result.group !== lastGroup;
                lastGroup = result.group;
                return (
                  <React.Fragment key={result.id}>
                    {showGroup ? (
                      <p className="px-3 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                        {result.group}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => go(result)}
                      onMouseEnter={() => setActive(index)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left",
                        index === active ? "bg-accent" : "hover:bg-accent/60"
                      )}
                    >
                      <result.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {result.label}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {result.detail}
                        </span>
                      </span>
                    </button>
                  </React.Fragment>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
