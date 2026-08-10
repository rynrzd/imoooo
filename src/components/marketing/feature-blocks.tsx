import { Reveal } from "@/components/marketing/reveal";
import {
  DocumentsPreview,
  ExpensesPreview,
  RentsPreview,
} from "@/components/marketing/product-previews";
import { cn } from "@/lib/utils";

/**
 * Les trois fonctionnalités principales, en blocs alternés (texte / interface).
 *
 * Chaque bloc montre un aperçu construit avec les primitives visuelles de
 * l'application et n'affirme que des fonctions réellement disponibles :
 * échéances de loyer et leurs statuts, bibliothèque de documents et de photos
 * par logement, dépenses par catégorie et suivi de chantier.
 * Les animations se limitent à une apparition douce au défilement (`Reveal`).
 */

const FEATURES = [
  {
    // « toujours à jour » laissait croire à un encaissement ou à une mise à
    // jour automatique : Nireo affiche et suit, il n'encaisse rien.
    title: "Vos loyers, enfin faciles à suivre.",
    text: "Visualisez les loyers reçus, ceux qui restent à vérifier et l’historique associé à chaque logement.",
    preview: <RentsPreview />,
  },
  {
    title: "Chaque document au bon endroit.",
    text: "Baux, assurances, factures et photos restent rattachés au logement — et donc au locataire qui l’occupe.",
    preview: <DocumentsPreview />,
  },
  {
    title: "Une vision claire de vos dépenses.",
    text: "Suivez les dépenses et les travaux sans multiplier les fichiers et les calculs : Nireo tient le total à votre place.",
    preview: <ExpensesPreview />,
  },
];

export function FeatureBlocks() {
  return (
    <div className="mt-8 space-y-14 sm:mt-12 sm:space-y-20">
      {FEATURES.map((feature, i) => {
        const reversed = i % 2 === 1;
        return (
          <div key={feature.title} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
            <Reveal className={cn(reversed && "lg:order-2")}>
              <h3 className="text-[1.4rem] font-semibold text-balance text-foreground sm:text-[1.75rem]">
                {feature.title}
              </h3>
              <p className="mt-5 max-w-md text-[0.98rem] leading-relaxed text-muted-foreground sm:text-base">
                {feature.text}
              </p>
            </Reveal>
            <Reveal delay={100} className={cn(reversed && "lg:order-1")}>
              {feature.preview}
            </Reveal>
          </div>
        );
      })}
    </div>
  );
}
