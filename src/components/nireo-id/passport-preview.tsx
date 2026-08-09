import { Smartphone } from "lucide-react";
import { EVENT_TYPE_LABELS } from "@/features/nireo-id/constants";
import { EXAMPLE_EVENTS, EXAMPLE_PASSPORT } from "@/features/nireo-id/example";
import { formatEventDate } from "@/features/nireo-id/format";
import { cn } from "@/lib/utils";
import { TrustBadge } from "./trust-badge";

/**
 * Composition d'illustration du téléphone, construite avec les mêmes
 * briques que le produit réel (identifiant, timeline, niveaux de
 * confiance). Toujours accompagnée d'une mention « Exemple » : ce n'est
 * jamais une capture présentée comme un dossier réel.
 */
export function PassportPreview({ className }: { className?: string }) {
  return (
    <figure className={cn("nid-panel rounded-2xl p-5 sm:p-6", className)}>
      <figcaption className="sr-only">
        Exemple de téléphone Nireo ID : identifiant, appareil et trois
        événements d’historique avec leur niveau de confiance.
      </figcaption>

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
            <Smartphone className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-foreground">
              {EXAMPLE_PASSPORT.brand} {EXAMPLE_PASSPORT.model}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {EXAMPLE_PASSPORT.color} · {EXAMPLE_PASSPORT.storage_capacity}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          Exemple
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border bg-muted/60 p-2.5">
          <dt className="text-[10px] text-muted-foreground">Identifiant</dt>
          <dd className="mt-1 font-mono text-[11px] font-medium text-foreground">
            {EXAMPLE_PASSPORT.public_id}
          </dd>
        </div>
        <div className="rounded-xl border border-border bg-muted/60 p-2.5">
          <dt className="text-[10px] text-muted-foreground">Événements</dt>
          <dd className="mt-1 text-sm font-semibold text-foreground tabular-nums">
            {EXAMPLE_PASSPORT.events_total}
          </dd>
        </div>
        <div className="rounded-xl border border-border bg-muted/60 p-2.5">
          <dt className="text-[10px] text-muted-foreground">Validés pro</dt>
          <dd className="mt-1 text-sm font-semibold text-foreground tabular-nums">
            {EXAMPLE_PASSPORT.events_professional}
          </dd>
        </div>
      </dl>

      <ol className="mt-5 space-y-3">
        {EXAMPLE_EVENTS.map((event) => (
          <li key={event.title} className="relative pl-6">
            <span
              aria-hidden
              className="absolute top-1.5 left-0 size-2 rounded-full bg-primary ring-4 ring-[color-mix(in_srgb,var(--primary)_18%,transparent)]"
            />
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[13px] font-medium text-foreground">{event.title}</span>
              <TrustBadge level={event.trust_level} />
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {EVENT_TYPE_LABELS[event.type]} · {formatEventDate(event.date)} · {event.author}
            </p>
          </li>
        ))}
      </ol>
    </figure>
  );
}
