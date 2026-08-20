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
    <div className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-8 sm:py-20">
      {/* Même en-tête que les pages de contenu : le document juridique
          appartient au site, il n'est pas une annexe posée à côté. */}
      <header data-reveal className="nl-seq">
        <p
          data-seq
          className="flex items-center gap-3 text-[0.72rem] font-medium tracking-[0.22em] text-[var(--nl-gray)] uppercase"
        >
          <span
            aria-hidden
            data-seq-rule
            style={{ ["--nl-delay" as string]: "120ms", ["--nl-dur" as string]: "0.5s" }}
            className="h-px w-8 bg-[var(--nl-cobalt)]"
          />
          MENTIONS
        </p>
        <h1 className="mt-6 text-[clamp(1.9rem,5vw,2.8rem)] font-semibold text-balance text-foreground">
          <span data-mask-line style={{ ["--nl-delay" as string]: "80ms" }}>
            <span>{title}</span>
          </span>
        </h1>
        <p data-seq style={{ ["--nl-delay" as string]: "260ms" }} className="mt-4 text-xs text-muted-foreground">
          Dernière mise à jour : {updatedAt}
        </p>
      </header>

      <div
        data-reveal
        className="mt-8 border-l-2 border-[var(--nl-cobalt)] bg-[color-mix(in_srgb,var(--nl-ink)_4%,transparent)] py-4 pr-4 pl-5 text-sm text-foreground"
      >
        <p className="font-medium">Document provisoire</p>
        <p className="mt-1 text-muted-foreground">
          Ce document décrit fidèlement le fonctionnement actuel du service,
          mais n&apos;a pas encore été validé par un professionnel du droit. Il
          sera complété avant l&apos;ouverture commerciale de Nireo.
        </p>
      </div>

      <p className="mt-6 text-sm leading-relaxed text-muted-foreground">{intro}</p>

      <div className="mt-10 space-y-10">
        {sections.map((section, index) => (
          <section key={section.title} data-reveal className="nl-seq">
            <h2 className="text-[1.15rem] font-semibold tracking-tight text-foreground">
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
