import { Clock, Layers, Quote, ShieldCheck, Smartphone } from "lucide-react";
import { CountUp } from "@/components/marketing/count-up";
import { Reveal } from "@/components/marketing/reveal";
import { SpotlightCard } from "@/components/marketing/spotlight-card";
import type { ProofPayload, Testimonial } from "@/lib/landing/types";

/**
 * Bloc de réassurance de la landing — trois versions testables.
 *
 * Règle absolue du projet : aucun chiffre client inventé, aucun témoignage
 * fabriqué. Les garanties et les chiffres décrivent ce que le produit fait
 * réellement ; les témoignages ne s'affichent que s'ils ont été saisis dans
 * l'administration (et la variante est sinon retirée de l'expérimentation).
 */

const GUARANTEES = [
  {
    icon: ShieldCheck,
    title: "Vos données restent les vôtres",
    text: "Chaque compte est isolé au niveau de la base : personne d'autre ne peut lire vos logements, vos baux ou vos montants.",
  },
  {
    icon: Layers,
    title: "Hébergement européen",
    text: "Infrastructure et sauvegardes hébergées en Europe, avec chiffrement des échanges de bout en bout.",
  },
  {
    icon: Clock,
    title: "Sauvegarde automatique",
    text: "Chaque modification est enregistrée immédiatement. Rien à exporter, rien à penser à sauvegarder.",
  },
  {
    icon: Smartphone,
    title: "Partout, tout de suite",
    text: "Ordinateur, tablette ou téléphone : la même interface, sans installation ni synchronisation manuelle.",
  },
];

const FIGURES = [
  { value: 6, suffix: "", label: "modules réunis dans un seul espace" },
  { value: 1, suffix: "", label: "logement suivi gratuitement, à vie" },
  { value: 100, suffix: " %", label: "de vos données isolées de tout autre compte" },
  { value: 24, suffix: "/7", label: "accès à votre patrimoine, partout" },
];

export function ProofSection({
  variant,
  testimonials,
}: {
  variant: ProofPayload["kind"];
  testimonials: Testimonial[];
}) {
  // Repli sûr : sans témoignages réels, on ne montre jamais un bloc vide.
  const kind = variant === "testimonials" && testimonials.length < 2 ? "guarantees" : variant;

  if (kind === "figures") {
    return (
      <Reveal className="mt-12">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {FIGURES.map((figure) => (
            <div key={figure.label} className="text-center">
              <p className="text-4xl font-semibold tracking-tight sm:text-5xl">
                <span className="nireo-shine">
                  <CountUp value={figure.value} suffix={figure.suffix} />
                </span>
              </p>
              <p className="mx-auto mt-3 max-w-[16ch] text-sm text-muted-foreground">{figure.label}</p>
            </div>
          ))}
        </div>
      </Reveal>
    );
  }

  if (kind === "testimonials") {
    return (
      <Reveal className="mt-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.slice(0, 6).map((testimonial) => (
            <SpotlightCard key={`${testimonial.author}-${testimonial.quote.slice(0, 12)}`} className="p-6">
              <Quote className="size-5 text-primary" aria-hidden />
              <blockquote className="mt-4 text-sm leading-relaxed text-foreground">
                « {testimonial.quote} »
              </blockquote>
              <figcaption className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{testimonial.author}</span>
                {testimonial.role ? ` · ${testimonial.role}` : null}
              </figcaption>
            </SpotlightCard>
          ))}
        </div>
      </Reveal>
    );
  }

  return (
    <Reveal className="mt-12">
      <div className="grid gap-4 sm:grid-cols-2">
        {GUARANTEES.map((item) => (
          <SpotlightCard key={item.title} className="p-6">
            <span className="grid size-11 place-items-center rounded-xl border border-border bg-primary/8 text-primary">
              <item.icon className="size-5" />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
          </SpotlightCard>
        ))}
      </div>
    </Reveal>
  );
}

/** Titre de la section, adapté à la version servie. */
export function proofHeading(kind: ProofPayload["kind"], hasTestimonials: boolean) {
  if (kind === "testimonials" && hasTestimonials) {
    return { eyebrow: "Ils utilisent Nireo", title: "Ce qu'en disent", keyword: "les propriétaires." };
  }
  if (kind === "figures") {
    return { eyebrow: "Ce que Nireo garantit", title: "Des bénéfices", keyword: "concrets." };
  }
  return { eyebrow: "Réassurance", title: "Ce sur quoi vous pouvez", keyword: "compter." };
}
