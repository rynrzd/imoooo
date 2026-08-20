import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import {
  ContentCards,
  ContentColumn,
  ContentCta,
  ContentHeader,
  ContentPageShell,
} from "@/components/seo/content";
import { GUIDES, PILLAR_PAGE, RESOURCES_PAGE, TOOLS } from "@/config/seo-pages";
import {
  breadcrumbJsonLd,
  jsonLdGraph,
  organizationJsonLd,
  webPageJsonLd,
  webSiteJsonLd,
} from "@/lib/seo/jsonld";

/**
 * /ressources — point d'entrée éditorial : la page pilier et les guides.
 * Aucune liste d'URL n'est saisie ici : tout vient de src/config/seo-pages.ts,
 * la même source que le sitemap et le maillage interne.
 */

export const metadata: Metadata = {
  title: { absolute: `${RESOURCES_PAGE.title} | Nireo` },
  description: RESOURCES_PAGE.description,
  alternates: { canonical: RESOURCES_PAGE.path },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: RESOURCES_PAGE.path,
    title: RESOURCES_PAGE.title,
    description: RESOURCES_PAGE.description,
  },
};

const CRUMBS = [
  { name: "Accueil", path: "/" },
  { name: RESOURCES_PAGE.shortTitle, path: RESOURCES_PAGE.path },
];

const JSON_LD = jsonLdGraph([
  organizationJsonLd,
  webSiteJsonLd,
  webPageJsonLd({
    name: RESOURCES_PAGE.title,
    description: RESOURCES_PAGE.description,
    path: RESOURCES_PAGE.path,
    dateModified: RESOURCES_PAGE.updatedAt,
  }),
  breadcrumbJsonLd(CRUMBS),
]);

export default function RessourcesPage() {
  return (
    <ContentPageShell>
      <JsonLd data={JSON_LD} />

      <ContentColumn>
        <Breadcrumbs crumbs={CRUMBS} />
        <ContentHeader
          eyebrow="Ressources"
          h1="Ressources sur la gestion locative"
          lead="Des guides écrits à partir du fonctionnement réel de Nireo : ce que l'outil fait, ce qu'il ne fait pas, et comment organiser sa gestion quand on est propriétaire bailleur."
          updatedAt={RESOURCES_PAGE.updatedAt}
        />
      </ContentColumn>

      <ContentColumn className="space-y-16">
        {/* Page pilier — mise en avant, c'est le point de départ. */}
        <section aria-labelledby="point-de-depart" data-reveal className="nl-seq">
          <h2 id="point-de-depart" className="text-[clamp(1.4rem,3.6vw,1.9rem)] font-semibold text-[var(--nl-ink)]">
            <span data-mask-line>
              <span>Commencer ici</span>
            </span>
          </h2>
          <div data-seq style={{ ["--nl-delay" as string]: "160ms" }} className="mt-5">
            <ContentCards pages={[PILLAR_PAGE]} withDate emphasis />
          </div>
        </section>

        <section aria-labelledby="guides" data-reveal className="nl-seq">
          <h2 id="guides" className="text-[clamp(1.4rem,3.6vw,1.9rem)] font-semibold text-[var(--nl-ink)]">
            <span data-mask-line>
              <span>Les guides</span>
            </span>
          </h2>
          <p
            data-seq
            style={{ ["--nl-delay" as string]: "160ms" }}
            className="mt-4 text-[0.98rem] leading-relaxed text-[var(--nl-gray)]"
          >
            Chaque guide traite une situation précise. Ils sont indépendants :
            lisez uniquement celui qui vous concerne.
          </p>
          <div className="mt-7">
            <ContentCards pages={GUIDES} withDate />
          </div>
        </section>

        {/* Outils : utilisables sans compte, listés à part des guides. */}
        <section aria-labelledby="outils" data-reveal className="nl-seq">
          <h2 id="outils" className="text-[clamp(1.4rem,3.6vw,1.9rem)] font-semibold text-[var(--nl-ink)]">
            <span data-mask-line>
              <span>Outils gratuits</span>
            </span>
          </h2>
          <p
            data-seq
            style={{ ["--nl-delay" as string]: "160ms" }}
            className="mt-4 text-[0.98rem] leading-relaxed text-[var(--nl-gray)]"
          >
            Utilisables tout de suite, sans compte et sans carte bancaire.
          </p>
          <div className="mt-7">
            <ContentCards pages={TOOLS} />
          </div>
        </section>

        <section aria-labelledby="a-propos-des-guides" data-reveal className="nl-seq">
          <h2
            id="a-propos-des-guides"
            className="text-[clamp(1.4rem,3.6vw,1.9rem)] font-semibold text-[var(--nl-ink)]"
          >
            <span data-mask-line>
              <span>Comment ces guides sont écrits</span>
            </span>
          </h2>
          <p
            data-seq
            style={{ ["--nl-delay" as string]: "160ms" }}
            className="mt-4 text-[0.98rem] leading-relaxed text-[var(--nl-gray)]"
          >
            Ils sont rédigés par l&apos;équipe Nireo à partir du produit
            lui-même. Une fonction n&apos;y est citée que si elle existe
            aujourd&apos;hui dans l&apos;application ; les limites de chaque
            plan sont reprises directement de la grille tarifaire ; et ce que
            Nireo ne fait pas — comptabilité légale, déclarations fiscales,
            gestion déléguée — est écrit noir sur blanc plutôt que passé sous
            silence. Une question sans réponse ici ?{" "}
            <Link
              href="/contact"
              className="nl-focus font-medium text-[var(--nl-cobalt)] underline-offset-4 hover:underline"
            >
              Écrivez-nous
            </Link>
            .
          </p>
        </section>

        <ContentCta
          title="Essayez avec votre premier logement"
          description="Le plan Gratuit est permanent et ne demande aucune carte bancaire — de quoi vérifier concrètement si Nireo vous convient."
        />
      </ContentColumn>
    </ContentPageShell>
  );
}
