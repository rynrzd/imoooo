import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import {
  ContentColumn,
  ContentCta,
  ContentHeader,
  ContentPageShell,
} from "@/components/seo/content";
import { GUIDES, PILLAR_PAGE, RESOURCES_PAGE, TOOLS, formatUpdatedAt } from "@/config/seo-pages";
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

      <ContentColumn className="space-y-10">
        {/* Page pilier — mise en avant, c'est le point de départ. */}
        <section aria-labelledby="point-de-depart">
          <h2
            id="point-de-depart"
            className="text-xl font-semibold tracking-tight text-foreground"
          >
            Commencer ici
          </h2>
          <Link
            href={PILLAR_PAGE.path}
            className="group nireo-glass nireo-hairline mt-5 flex flex-col rounded-3xl p-6 transition-colors hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none sm:p-8"
          >
            <span className="flex items-start justify-between gap-4">
              <span className="text-lg font-semibold text-balance text-foreground sm:text-xl">
                {PILLAR_PAGE.title}
              </span>
              <ArrowUpRight
                className="mt-1 size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                aria-hidden
              />
            </span>
            <span className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {PILLAR_PAGE.summary}
            </span>
            <span className="mt-4 text-xs text-muted-foreground">
              Mis à jour le{" "}
              <time dateTime={PILLAR_PAGE.updatedAt}>
                {formatUpdatedAt(PILLAR_PAGE.updatedAt)}
              </time>
            </span>
          </Link>
        </section>

        <section aria-labelledby="guides">
          <h2 id="guides" className="text-xl font-semibold tracking-tight text-foreground">
            Les guides
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Chaque guide traite une situation précise. Ils sont indépendants :
            lisez uniquement celui qui vous concerne.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {GUIDES.map((guide) => (
              <li key={guide.path}>
                <Link
                  href={guide.path}
                  className="group nireo-hairline flex h-full flex-col rounded-2xl border border-border bg-card/70 p-5 transition-colors hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-sm font-semibold text-balance text-foreground">
                      {guide.shortTitle}
                    </span>
                    <ArrowUpRight
                      className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                      aria-hidden
                    />
                  </span>
                  <span className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {guide.summary}
                  </span>
                  <span className="mt-4 text-xs text-muted-foreground">
                    Mis à jour le{" "}
                    <time dateTime={guide.updatedAt}>{formatUpdatedAt(guide.updatedAt)}</time>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Outils : utilisables sans compte, listés à part des guides. */}
        <section aria-labelledby="outils">
          <h2 id="outils" className="text-xl font-semibold tracking-tight text-foreground">
            Outils gratuits
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Utilisables tout de suite, sans compte et sans carte bancaire.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {TOOLS.map((tool) => (
              <li key={tool.path}>
                <Link
                  href={tool.path}
                  className="group nireo-hairline flex h-full flex-col rounded-2xl border border-border bg-card/70 p-5 transition-colors hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-sm font-semibold text-balance text-foreground">
                      {tool.shortTitle}
                    </span>
                    <ArrowUpRight
                      className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                      aria-hidden
                    />
                  </span>
                  <span className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {tool.summary}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="a-propos-des-guides">
          <h2
            id="a-propos-des-guides"
            className="text-xl font-semibold tracking-tight text-foreground"
          >
            Comment ces guides sont écrits
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Ils sont rédigés par l&apos;équipe Nireo à partir du produit
            lui-même. Une fonction n&apos;y est citée que si elle existe
            aujourd&apos;hui dans l&apos;application ; les limites de chaque
            plan sont reprises directement de la grille tarifaire ; et ce que
            Nireo ne fait pas — comptabilité légale, déclarations fiscales,
            gestion déléguée — est écrit noir sur blanc plutôt que passé sous
            silence. Une question sans réponse ici ?{" "}
            <Link
              href="/contact"
              className="text-foreground underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
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
