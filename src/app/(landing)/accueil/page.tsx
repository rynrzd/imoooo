import type { Metadata } from "next";
import Link from "next/link";
import { Centralisation } from "@/components/landing/centralisation";
import { LandingFaq, landingFaqItems } from "@/components/landing/faq-section";
import { FinalCta } from "@/components/landing/final-cta";
import { LandingHero } from "@/components/landing/hero";
import { LandingTracker } from "@/components/landing/landing-tracker";
import { LinkedSection } from "@/components/landing/linked-section";
import { PointerShift } from "@/components/landing/motion";
import { ProductPreview } from "@/components/landing/product-preview";
import { RevealOnScroll } from "@/components/landing/reveal-on-scroll";
import { SecuritySection } from "@/components/landing/security-section";
import { StorySection } from "@/components/landing/story-section";
import { JsonLd } from "@/components/seo/json-ld";
import { CTA_MARKER } from "@/lib/funnel";
import { payloadOf } from "@/lib/landing/catalog";
import { getLandingResolution } from "@/lib/landing/server";
import {
  faqPageJsonLd,
  jsonLdGraph,
  organizationJsonLd,
  softwareApplicationJsonLd,
  webSiteJsonLd,
} from "@/lib/seo/jsonld";
import { isStripeConfigured } from "@/lib/stripe/config";
import { SITE_URL } from "@/lib/supabase/config";

/**
 * Landing publique de Nireo.
 *
 * Huit temps, dans cet ordre : le hook sur une photographie plein écran
 * (#decouvrir), le produit réel (#produit), la section signature, l'histoire
 * d'un logement, la centralisation, la sécurité (#securite), les questions
 * fréquentes (#faq) et l'appel à l'action.
 *
 * Les quatre ancres du menu vivent donc TOUTES ici : plus aucune entrée de
 * navigation ne renvoie vers une page restée à l'ancienne identité. La grille
 * tarifaire complète reste sur /tarifs, avec la FAQ longue qui la commente.
 *
 * Un seul `h1` (le hook). Chaque section a son `h2`. Tout le contenu est rendu
 * côté serveur : les seules parties client sont le header (menu, session), le
 * lien d'ancre fluide, l'accordéon de la FAQ, les deux micro-mouvements et
 * l'observateur de révélations — aucune ne masque de texte.
 *
 * Ce que le moteur de personnalisation décide encore : la destination et les
 * libellés des appels à l'action (visiteur / membre connecté) et le texte du
 * sous-titre. Les repères de mesure existants (`data-lx-section`, `data-lx`)
 * sont conservés à l'identique — `hero`, `features`, `unify`, `proof`, `cta`
 * mesurent exactement les mêmes sections qu'avant, les statistiques restent
 * donc comparables. Les deux nouvelles sections ont leurs propres clés
 * (`story`, `security`, `faq`).
 */

export const metadata: Metadata = {
  title: {
    absolute: "Nireo — Loyers, baux et documents réunis dans un seul espace",
  },
  description:
    "Nireo réunit vos loyers, vos baux, vos locataires et vos documents dans un seul espace clair. Gratuit pour un premier logement, sans carte bancaire.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Nireo",
    locale: "fr_FR",
    title: "Nireo — Loyers, baux et documents réunis dans un seul espace",
    description:
      "Loyers, baux, locataires et documents réunis dans un espace conçu pour les propriétaires bailleurs.",
    url: "/",
    images: [
      { url: "/opengraph-image", width: 1200, height: 630, alt: "Nireo — Le logiciel de gestion locative" },
    ],
  },
};

/** La personnalisation lit les cookies : la page est rendue à chaque requête. */
export const dynamic = "force-dynamic";

/**
 * Les questions REELLEMENT affichées ici — et rien d'autre. Le balisage
 * FAQPage suit toujours la même règle : il n'existe que là où les questions
 * sont visibles, et il décrit exactement celles-là (la FAQ longue de /tarifs
 * garde la sienne, avec son propre jeu de questions).
 */
const FAQ_ITEMS = landingFaqItems({ paymentsEnabled: isStripeConfigured });

const JSON_LD = jsonLdGraph([
  organizationJsonLd,
  webSiteJsonLd,
  softwareApplicationJsonLd,
  faqPageJsonLd(FAQ_ITEMS, `${SITE_URL}/`),
]);

/** Paramètres de campagne recopiés tels quels vers l'inscription. */
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Recopie les seuls paramètres UTM présents sur l'URL vers la destination.
 *
 * Le projet exploite déjà ces paramètres (le proxy en déduit le segment du
 * visiteur et les mémorise dans son cookie) : les conserver sur le lien
 * garantit qu'une campagne reste attribuée si le visiteur partage l'URL ou
 * revient par ce lien. Rien d'autre n'est recopié — ni identifiant, ni
 * paramètre inconnu.
 */
function withUtm(href: string, params: SearchParams): string {
  const query = new URLSearchParams();
  for (const key of UTM_KEYS) {
    const raw = params[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value) query.set(key, value.slice(0, 120));
  }
  const suffix = query.toString();
  if (!suffix) return href;
  return `${href}${href.includes("?") ? "&" : "?"}${suffix}`;
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [{ content, profile }, params] = await Promise.all([
    getLandingResolution(),
    searchParams,
  ]);

  // Garde-fou : la variante « membre » du CTA renvoie vers /, c'est-à-dire le
  // tableau de bord. Servie à un visiteur ANONYME (variante épinglée dans la
  // configuration du moteur, règle mal ciblée…), elle le ferait rebondir sur
  // la connexion au lieu d'ouvrir l'inscription. On ne la sert donc que si la
  // session existe réellement ; sinon on retombe sur la formulation visiteur
  // du catalogue. Le moteur garde toutes ses autres décisions.
  const cta = profile.isAuthenticated ? content.cta : payloadOf("hero_cta", "control");

  return (
    <>
      <JsonLd data={JSON_LD} />

      {/* ---------------- Le hook, sur la photographie ---------------- */}
      <div data-lx-section="hero">
        <LandingHero cta={cta} subheadline={content.subheadline.text} />
      </div>

      {/* ---------------- Le produit, tel qu'il est ---------------- */}
      <section
        id="produit"
        data-lx-section="features"
        className="bg-[var(--nl-paper)] py-16 sm:py-28"
      >
        {/* Une SEULE séquence pour toute la section : le titre se découpe
            ligne à ligne, l'aperçu monte, puis ses composants internes
            arrivent l'un après l'autre. Un seul déclencheur, donc une
            narration — pas dix fondus indépendants au gré du défilement. */}
        <div data-reveal className="nl-seq mx-auto w-full max-w-[82rem] px-6 sm:px-8">
          <h2 className="text-[clamp(1.9rem,6vw,3.2rem)] font-semibold text-[var(--nl-ink)]">
            <span data-mask-line>
              <span>Vous ouvrez Nireo.</span>
            </span>
            <span data-mask-line style={{ ["--nl-delay" as string]: "100ms" }}>
              <span>Tout est déjà clair.</span>
            </span>
          </h2>
          <p
            data-seq
            style={{ ["--nl-delay" as string]: "220ms" }}
            className="mt-5 max-w-md text-[clamp(0.95rem,2.4vw,1.08rem)] leading-relaxed text-[var(--nl-gray)]"
          >
            <span className="block">Vos biens, vos documents et vos chiffres.</span>
            <span className="block">Rien à recouper.</span>
          </p>

          {/* Sur mobile l'aperçu est CADRÉ, pas déroulé : hauteur bornée, ce
              qui dépasse est coupé, et un fondu blanc cassé dit que
              l'interface continue. Le rendu au-dessus de 768 px est intact —
              hauteur automatique, aucun fondu.
              `PointerShift` n'ajoute que quatre pixels de déplacement au
              pointeur, sur ordinateur uniquement. */}
          <PointerShift className="relative mt-10 h-[clamp(480px,62vh,540px)] overflow-hidden rounded-lg sm:mt-14 md:h-auto md:overflow-visible">
            <div data-seq style={{ ["--nl-delay" as string]: "120ms" }}>
              <ProductPreview />
            </div>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(to_top,var(--nl-paper),transparent)] md:hidden"
            />
          </PointerShift>

          {/* L'honnêteté est dite une fois, discrètement, sous l'aperçu. */}
          <p
            data-seq
            style={{ ["--nl-delay" as string]: "460ms" }}
            className="mt-5 text-[0.78rem] text-[var(--nl-gray)]"
          >
            Aperçu de l’interface Nireo. Les logements et les montants affichés sont
            des exemples&nbsp;: aucune donnée réelle n’est utilisée.
          </p>

          {/* Conclusion naturelle de la démonstration : « ce que vous venez de
              voir, avec VOTRE logement ». Un lien éditorial, pas un second
              bouton — la page n'a qu'un seul bouton plein par écran. Zone
              tactile de 44 px garantie par `min-h-11`, la flèche n'avance
              qu'au survol (jamais au chargement, jamais en mouvement réduit).
              Les paramètres de campagne présents sur l'URL sont conservés. */}
          <p data-seq style={{ ["--nl-delay" as string]: "520ms" }} className="mt-6">
            <Link
              href={withUtm(cta.href, params)}
              data-lx={CTA_MARKER.product_preview}
              data-lx-cta=""
              className="nl-focus group inline-flex min-h-11 items-center gap-2 text-[0.98rem] font-medium text-[var(--nl-cobalt)] underline-offset-4 hover:underline"
            >
              Essayer avec mon premier logement
              <span
                aria-hidden
                className="transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
              >
                →
              </span>
            </Link>
          </p>
        </div>
      </section>

      {/* ---------------- Tout reste lié ---------------- */}
      <div data-lx-section="unify">
        <LinkedSection />
      </div>

      {/* ---------------- Un logement, toute son histoire ---------------- */}
      <div data-lx-section="story">
        <StorySection />
      </div>

      {/* ---------------- Un seul endroit ---------------- */}
      <div data-lx-section="proof">
        <Centralisation />
      </div>

      {/* ---------------- Sécurité ---------------- */}
      <SecuritySection />

      {/* ---------------- Questions fréquentes ---------------- */}
      <LandingFaq items={FAQ_ITEMS} />

      {/* ---------------- Action ---------------- */}
      <FinalCta href={cta.href} label={cta.primary} />

      {/* Révélations au défilement (aucune si le visiteur limite les animations). */}
      <RevealOnScroll />
      {/* Mesure du comportement réel (anonyme, non bloquante). */}
      <LandingTracker />
    </>
  );
}
