"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, Share2, Smartphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ASSET_STATUS_LABELS } from "@/features/nireo-id/constants";
import { formatEventDate } from "@/features/nireo-id/format";
import type { AssetListItem } from "@/features/nireo-id/types";
import { cn } from "@/lib/utils";
import { HealthBadge } from "./state-badge";

/**
 * Liste des téléphones du propriétaire avec recherche locale (marque,
 * modèle, identifiant Nireo). Aucun compteur inventé : tout provient de
 * requêtes réelles passées en props.
 */
export function AssetList({ items }: { items: AssetListItem[] }) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      [item.brand, item.model, item.color, item.public_id]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [items, query]);

  return (
    <div className="space-y-4">
      {items.length > 3 ? (
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher une marque, un modèle ou un identifiant"
            aria-label="Rechercher parmi mes téléphones"
            className="pl-9"
          />
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Aucun téléphone ne correspond à « {query} ».
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((item) => (
            <li key={item.id}>
              <Link
                href={`/id/app/objets/${item.id}`}
                className="nid-panel flex items-center gap-4 rounded-2xl p-4 transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted">
                  {item.photo_url ? (
                    <Image
                      src={item.photo_url}
                      alt=""
                      width={56}
                      height={56}
                      unoptimized
                      className="size-full object-cover"
                    />
                  ) : (
                    <Smartphone className="size-6 text-muted-foreground" aria-hidden />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[15px] font-semibold text-foreground">
                      {item.brand} {item.model}
                    </span>
                    {item.status !== "active" ? (
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          item.status === "transfer_pending"
                            ? "border-[color-mix(in_srgb,var(--nid-info)_35%,transparent)] text-[var(--nid-info)]"
                            : "border-border text-muted-foreground"
                        )}
                      >
                        {ASSET_STATUS_LABELS[item.status]}
                      </span>
                    ) : null}
                  </span>

                  <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                    {item.public_id}
                  </span>

                  <span className="mt-1.5 flex flex-wrap items-center gap-2">
                    <HealthBadge state={item.health_state} />
                    {item.check_overdue ? (
                      <span className="text-xs text-[var(--nid-warning)]">Bilan en retard</span>
                    ) : item.next_check_on ? (
                      <span className="text-xs text-muted-foreground">
                        Prochain bilan le{" "}
                        {new Date(`${item.next_check_on}T00:00:00`).toLocaleDateString("fr-FR")}
                      </span>
                    ) : null}
                    {item.last_event ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {item.last_event.title} · {formatEventDate(item.last_event.effective_date)}
                      </span>
                    ) : null}
                  </span>
                </span>

                {item.active_shares > 0 ? (
                  <span
                    className="flex shrink-0 items-center gap-1 text-xs text-primary"
                    title={`${item.active_shares} lien de partage actif`}
                  >
                    <Share2 className="size-3.5" aria-hidden />
                    {item.active_shares}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
