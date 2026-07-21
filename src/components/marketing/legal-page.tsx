import { CONTACT_EMAIL } from "@/components/marketing/site-footer";

/**
 * Gabarit commun des pages légales. Le contenu est un cadre honnête et
 * clairement identifié comme provisoire : il devra être complété et validé
 * juridiquement avant toute commercialisation.
 */

export interface LegalSection {
  title: string;
  paragraphs: string[];
}

export function LegalPage({
  title,
  updatedAt,
  intro,
  sections,
}: {
  title: string;
  updatedAt: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-2 text-xs text-muted-foreground">Dernière mise à jour : {updatedAt}</p>

      <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-foreground">
        <p className="font-medium">Document provisoire</p>
        <p className="mt-1 text-muted-foreground">
          Ce document décrit fidèlement le fonctionnement actuel du service,
          mais n&apos;a pas encore été validé par un professionnel du droit. Il
          sera complété avant l&apos;ouverture commerciale de Nireo.
        </p>
      </div>

      <p className="mt-6 text-sm leading-relaxed text-muted-foreground">{intro}</p>

      <div className="mt-8 space-y-8">
        {sections.map((section, index) => (
          <section key={section.title}>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {index + 1}. {section.title}
            </h2>
            {section.paragraphs.map((paragraph) => (
              <p
                key={paragraph.slice(0, 40)}
                className="mt-2 text-sm leading-relaxed text-muted-foreground"
              >
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>

      <p className="mt-10 border-t border-border pt-6 text-sm text-muted-foreground">
        Pour toute question relative à ce document :{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-foreground underline-offset-2 hover:underline"
        >
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    </div>
  );
}
