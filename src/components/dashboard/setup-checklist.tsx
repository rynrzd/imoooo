"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight } from "lucide-react";
import { AddDocumentDialog } from "@/components/documents/add-document-dialog";
import { AddTenantDialog } from "@/components/tenants/add-tenant-dialog";
import { ONBOARDING_EVENT } from "@/lib/onboarding";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Checklist de mise en route — le relais discret du guide.
 *
 * Elle remplace la visite forcée : quatre lignes, dérivées des DONNÉES
 * RÉELLES du compte (aucun état inventé, rien à persister), qui ouvrent
 * directement la bonne action. Elle disparaît d'elle-même dès que tout est
 * fait, et le guide complet reste relançable depuis Paramètres → Aide.
 *
 * Une ligne peut être « sans objet » plutôt que « à faire » : un portefeuille
 * entièrement vacant n'a ni bail ni loyer à suivre, la checklist ne réclame
 * donc rien — elle ne nag jamais pour quelque chose d'inapplicable.
 */
export function SetupChecklist() {
  const { data, loading } = useAppStore();
  const router = useRouter();
  const [dialog, setDialog] = React.useState<"tenant" | "document" | null>(null);

  const hasProperty = data.properties.length > 0;
  const activeLeases = data.tenants.filter((t) => !t.exitDate);
  const allVacant =
    hasProperty && data.properties.every((p) => p.status !== "loue");
  const hasLease = activeLeases.length > 0;
  const hasBail = data.documents.some((d) => d.category === "bail");
  const hasTrackedRent = data.rentPayments.some((p) => p.received > 0);

  const items = [
    {
      id: "property",
      label: "Logement ajouté",
      done: hasProperty,
      hint: hasProperty ? undefined : "Le point de départ de tout le reste",
      // Parcours dédié : la création d'un logement n'est pas une modale.
      action: () => router.push("/logements/nouveau"),
    },
    {
      id: "lease",
      label: "Location configurée",
      done: hasLease || (hasProperty && allVacant),
      hint: hasLease
        ? undefined
        : allVacant
          ? "Aucune location en cours"
          : "Locataire, loyer et date d'entrée",
      action: () => setDialog("tenant"),
      disabled: !hasProperty,
    },
    {
      id: "bail",
      label: "Bail ajouté",
      done: hasBail || (hasProperty && !hasLease),
      hint: hasBail ? undefined : "Le document signé, dans votre bibliothèque privée",
      action: () => setDialog("document"),
      disabled: !hasProperty,
    },
    {
      id: "rent",
      label: "Premier loyer suivi",
      done: hasTrackedRent || (hasProperty && !hasLease),
      hint: hasTrackedRent ? undefined : "Marquez une échéance comme encaissée",
      action: () => router.push("/loyers"),
      disabled: !hasLease,
    },
  ];

  const remaining = items.filter((item) => !item.done).length;

  // Tout est fait (ou les données chargent encore) : la checklist s'efface.
  if (loading || remaining === 0) return null;

  return (
    <section
      aria-labelledby="mise-en-route"
      className="animate-panel-in overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-3 py-2.5">
        <h2 id="mise-en-route" className="text-sm font-medium text-foreground">
          Mise en route
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {items.length - remaining}/{items.length}
        </span>
      </div>

      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={item.action}
              disabled={item.done || item.disabled}
              className={cn(
                "flex min-h-12 w-full items-center gap-3 border-b border-border px-3 py-2 text-left last:border-b-0 transition-colors duration-200",
                item.done || item.disabled
                  ? "cursor-default"
                  : "hover:bg-accent/50"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full border",
                  item.done
                    ? "border-success bg-success text-white"
                    : "border-border"
                )}
              >
                {item.done ? <Check className="size-3" /> : null}
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-sm",
                    item.done ? "text-muted-foreground line-through" : "text-foreground"
                  )}
                >
                  {item.label}
                </span>
                {!item.done && item.hint ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.hint}
                  </span>
                ) : null}
              </span>

              {!item.done && !item.disabled ? (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden />
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      <div className="border-t border-border px-3 py-2">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent(ONBOARDING_EVENT))}
          className="min-h-9 text-xs text-primary underline-offset-4 hover:underline"
        >
          Reprendre le guide pas à pas
        </button>
      </div>

      {/* Les vrais formulaires de l'application — aucun doublon. */}
      {dialog === "tenant" ? (
        <AddTenantDialog showTrigger={false} open onOpenChange={(o) => !o && setDialog(null)} />
      ) : null}
      {dialog === "document" ? (
        <AddDocumentDialog showTrigger={false} open onOpenChange={(o) => !o && setDialog(null)} />
      ) : null}
    </section>
  );
}
