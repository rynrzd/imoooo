import { EVENT_TYPE_LABELS } from "@/features/nireo-id/constants";
import { EXAMPLE_EVENTS, EXAMPLE_PASSPORT } from "@/features/nireo-id/example";
import { formatEventDate } from "@/features/nireo-id/format";
import { cn } from "@/lib/utils";
import { SourceBadge } from "./state-badge";

/**
 * Composition d'illustration d'un téléphone, construite avec les mêmes
 * briques que le produit réel (identifiant, chronologie, provenance).
 * Toujours accompagnée de la mention « Exemple » : ce n'est jamais une
 * capture présentée comme un suivi réel.
 */
export function PassportPreview({ className }: { className?: string }) {
  const sources = ["atteste_reparateur", "document_fourni", "declare_proprietaire"];

  return (
    <figure className={cn("border-l-2 border-primary pl-5", className)}>
      <figcaption className="text-sm text-muted-foreground">Exemple d’affichage</figcaption>

      <p className="mt-3 text-lg font-medium text-foreground">
        {EXAMPLE_PASSPORT.brand} {EXAMPLE_PASSPORT.model}
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {EXAMPLE_PASSPORT.color} · {EXAMPLE_PASSPORT.storage_capacity} ·{" "}
        <span className="font-mono text-[12px]">{EXAMPLE_PASSPORT.public_id}</span>
      </p>

      <ol className="mt-5">
        {EXAMPLE_EVENTS.map((event, index) => (
          <li key={event.title} className="nid-rule py-3.5 first:border-0 first:pt-0">
            <p className="text-[15px] text-foreground">{event.title}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>
                {EVENT_TYPE_LABELS[event.type]} · {formatEventDate(event.date)}
              </span>
              <SourceBadge source={sources[index] ?? "declare_proprietaire"} />
            </p>
          </li>
        ))}
      </ol>
    </figure>
  );
}
