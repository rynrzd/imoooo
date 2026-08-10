import { CreditCard, DatabaseBackup, Quote, Server, ShieldCheck } from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";
import { SpotlightCard } from "@/components/marketing/spotlight-card";
import type { ProofPayload, Testimonial } from "@/lib/landing/types";

/**
 * Bloc de réassurance de la landing — compact, deux versions testables.
 *
 * Règle absolue du projet : aucun chiffre client inventé, aucun témoignage
 * fabriqué. Les engagements listés ici sont ceux que l'infrastructure tient
 * réellement (hébergement européen, isolation par compte au niveau de la base,
 * enregistrement immédiat, plan Gratuit sans carte bancaire). Les témoignages
 * ne s'affichent que s'ils ont été saisis dans l'administration — la variante
 * est sinon retirée de l'expérimentation.
 */

/**
 * Une phrase courte par engagement — et rien qui dépasse ce que
 * l'infrastructure fait réellement. « Enregistrement immédiat » décrit une
 * écriture en base à chaque action : ce n'est PAS une promesse de sauvegarde
 * automatique restaurable, qui serait fausse.
 */
const GUARANTEES = [
  {
    icon: Server,
    title: "Hébergement européen",
    text: "Infrastructure et fichiers hébergés en Europe, échanges chiffrés.",
  },
  {
    icon: ShieldCheck,
    title: "Données isolées par compte",
    text: "Un compte ne peut jamais lire les données d’un autre.",
  },
  {
    icon: DatabaseBackup,
    title: "Enregistrement immédiat",
    text: "Chaque modification est écrite tout de suite, rien à sauvegarder.",
  },
  {
    icon: CreditCard,
    title: "Gratuit sans carte bancaire",
    text: "Le plan Gratuit est permanent, aucun moyen de paiement demandé.",
  },
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

  if (kind === "testimonials") {
    return (
      <Reveal className="mt-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.slice(0, 3).map((testimonial) => (
            <SpotlightCard
              key={`${testimonial.author}-${testimonial.quote.slice(0, 12)}`}
              className="p-5"
            >
              <Quote className="size-4 text-primary" aria-hidden />
              <blockquote className="mt-3 text-sm leading-relaxed text-foreground">
                « {testimonial.quote} »
              </blockquote>
              <figcaption className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{testimonial.author}</span>
                {testimonial.role ? ` · ${testimonial.role}` : null}
              </figcaption>
            </SpotlightCard>
          ))}
        </div>
      </Reveal>
    );
  }

  // Une seule enveloppe. Sur mobile : quatre lignes séparées par un filet.
  // Sur ordinateur : grille 2 × 2. Jamais une carte par engagement.
  return (
    <Reveal className="mt-8 sm:mt-10">
      <div className="nireo-glass mx-auto max-w-4xl rounded-2xl px-4 max-sm:divide-y max-sm:divide-border sm:grid sm:grid-cols-2 sm:gap-x-8 sm:gap-y-5 sm:rounded-3xl sm:p-8">
        {GUARANTEES.map((item) => (
          <div key={item.title} className="flex items-start gap-3 py-3.5 sm:py-0">
            <item.icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{item.text}</p>
            </div>
          </div>
        ))}
      </div>
    </Reveal>
  );
}

/** Titre de la section, adapté à la version servie. */
export function proofHeading(kind: ProofPayload["kind"], hasTestimonials: boolean) {
  if (kind === "testimonials" && hasTestimonials) {
    return { title: "Ce qu’en disent", keyword: "les propriétaires." };
  }
  return { title: "Vos données,", keyword: "en sécurité." };
}
