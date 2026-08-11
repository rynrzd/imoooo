import { Reveal } from "@/components/marketing/reveal";
import type { Testimonial } from "@/lib/landing/types";

/**
 * Témoignages RÉELS, saisis dans l'administration.
 *
 * Règle absolue du projet : aucun avis inventé. Ce bloc n'existe donc que si
 * l'administration en a publié au moins deux ET que le moteur a servi la
 * variante « témoignages » — sinon la page n'affiche que les engagements
 * vérifiables de la bande de confiance.
 */
export function TestimonialsBand({ testimonials }: { testimonials: Testimonial[] }) {
  if (testimonials.length < 2) return null;

  return (
    <Reveal>
      <p className="land-eyebrow text-muted-foreground">Paroles de propriétaires</p>
      <div className="mt-6 grid grid-cols-1 gap-x-12 border-t border-border sm:grid-cols-2">
        {testimonials.slice(0, 2).map((testimonial) => (
          <figure
            key={`${testimonial.author}-${testimonial.quote.slice(0, 12)}`}
            className="border-b border-border py-6 sm:border-b-0"
          >
            <blockquote className="text-[1.05rem] leading-relaxed text-balance text-foreground">
              « {testimonial.quote} »
            </blockquote>
            <figcaption className="mt-4 text-[0.82rem] text-muted-foreground">
              <span className="font-medium text-foreground">{testimonial.author}</span>
              {testimonial.role ? ` · ${testimonial.role}` : null}
            </figcaption>
          </figure>
        ))}
      </div>
    </Reveal>
  );
}
