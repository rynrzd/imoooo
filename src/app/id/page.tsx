import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NidPublicFooter } from "@/components/nireo-id/public-footer";
import { NidPublicHeader } from "@/components/nireo-id/public-header";
import { NID_SUBLINE, NID_TAGLINE } from "@/features/nireo-id/constants";
import { formatNidPrice, NID_PLAN_LIST } from "@/features/nireo-id/plans";

export const metadata: Metadata = {
  title: "Nireo ID — Le suivi simple de votre téléphone",
  description:
    "Ajoutez votre téléphone dès son achat, répondez à un bilan rapide, conservez ses réparations et transmettez son historique.",
  alternates: { canonical: "/id" },
};

const SIGNUP_HREF = "/inscription?next=%2Fid%2Fapp%2Fobjets%2Fnouveau";

const STEPS = [
  ["Ajoutez le téléphone", "Dès l’achat : marque, modèle, facture. Moins de deux minutes."],
  ["Faites un bilan rapide", "Une question par mois. « Tout va bien » se répond en un clic."],
  ["Conservez les réparations", "Chaque intervention rejoint le même historique."],
  ["Transmettez son historique", "À la revente, le suivi part avec l’appareil."],
];

const AUDIENCES = [
  {
    id: "particuliers",
    title: "Pour les particuliers",
    lead: "Un téléphone, ses papiers, son état.",
    items: [
      ["Facture et garantie", "conservées dans votre espace privé"],
      ["État du téléphone", "mis à jour par vos bilans"],
      ["Rappels", "à la fréquence que vous choisissez"],
      ["Réparations", "avec les pièces et la garantie d’intervention"],
      ["Partage et transfert", "vous décidez de ce qui est visible"],
    ],
  },
  {
    id: "entreprises",
    title: "Pour les entreprises",
    lead: "Un parc, des détenteurs, des coûts.",
    items: [
      ["Parc", "tous les téléphones et leur état"],
      ["Affectations", "qui détient quoi, depuis quand"],
      ["Bilans salariés", "l’état matériel, rien d’autre"],
      ["Réparations", "validées avant d’entrer dans l’historique"],
      ["Coûts et historique", "exportables"],
    ],
  },
  {
    id: "reparateurs",
    title: "Pour les réparateurs",
    lead: "Une intervention, pas un accès général.",
    items: [
      ["Scan ou lien", "envoyé par le client"],
      ["Intervention", "diagnostic, opération, pièces"],
      ["Preuves", "montant, garantie, date"],
      ["Validation client", "avant inscription à l’historique"],
    ],
  },
];

const PRIVACY = [
  ["Données privées", "Votre suivi n’est visible de personne tant que vous ne partagez rien."],
  [
    "Identifiants masqués",
    "L’IMEI et le numéro de série complets ne sortent jamais d’un rapport partagé.",
  ],
  [
    "Partage contrôlé",
    "Vous choisissez ce que contient le rapport, sa durée, et vous le coupez quand vous voulez.",
  ],
  [
    "Aucune surveillance",
    "Un employeur ne voit ni appels, ni messages, ni position, ni applications : seulement l’état matériel.",
  ],
];

const FAQ = [
  [
    "Nireo vérifie-t-il qu’un téléphone n’est pas volé ?",
    "Non. Nireo ID n’est relié à aucun fichier officiel. Un téléphone peut être « déclaré volé » par son propriétaire ou son entreprise : c’est une déclaration, pas une vérification.",
  ],
  [
    "Nireo lit-il l’IMEI automatiquement ?",
    "Non. Une application web n’a pas accès à cet identifiant. Vous pouvez le scanner depuis la boîte, l’importer depuis une image ou le saisir : dans tous les cas vous confirmez la valeur.",
  ],
  [
    "Que voit mon employeur sur mon téléphone professionnel ?",
    "L’état matériel que vous déclarez et le besoin de réparation. Rien d’autre : pas d’appels, pas de messages, pas de position, pas de temps d’écran.",
  ],
  [
    "Que se passe-t-il quand je revends le téléphone ?",
    "Vous ouvrez un transfert vers l’adresse de l’acheteur, qui doit l’accepter. L’historique suit l’appareil ; vos documents privés, eux, ne partent que si vous le décidez.",
  ],
  [
    "Une réparation est-elle certifiée par Nireo ?",
    "Non. Elle est « attestée par un réparateur » lorsque l’atelier a une identité professionnelle approuvée, sinon elle reste « déclarée par l’atelier ». Nireo ne certifie rien automatiquement.",
  ],
  [
    "Puis-je utiliser Nireo ID gratuitement ?",
    "Oui. L’offre personnelle gratuite couvre jusqu’à trois téléphones, avec les bilans, les réparations, le partage et le transfert.",
  ],
];

/** Aperçu du suivi — filets et texte, aucune image ni pastille d'icône. */
function TrackingPreview() {
  const lines = [
    ["12 mars 2026", "Achat", "Déclaré par le propriétaire"],
    ["18 juin 2026", "Réparation — écran", "Attesté par un réparateur"],
    ["2 août 2026", "Bilan mensuel — tout fonctionne", "Déclaré par le propriétaire"],
  ];

  return (
    <figure className="border-l-2 border-primary pl-5">
      <figcaption className="text-sm text-muted-foreground">Exemple d’affichage</figcaption>
      <p className="mt-3 text-lg font-medium text-foreground">iPhone 16 Pro</p>
      <p className="mt-0.5 text-sm text-foreground">Bon état · prochain bilan dans 6 jours</p>
      <dl className="mt-5">
        {lines.map(([date, label, source]) => (
          <div key={label} className="nid-rule py-3.5 first:border-0 first:pt-0">
            <dt className="text-[15px] text-foreground">{label}</dt>
            <dd className="mt-0.5 text-sm text-muted-foreground">
              {date} · {source}
            </dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}

export default function NireoIdLandingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <NidPublicHeader />

      <main id="contenu" tabIndex={-1} className="flex-1">
        {/* ---------------- Hero ---------------- */}
        <section className="mx-auto w-full max-w-5xl px-5 pt-16 pb-14 sm:px-8 md:pt-24 md:pb-20">
          <div className="grid gap-12 md:grid-cols-[1.15fr_1fr] md:items-start md:gap-16">
            <div>
              <h1 className="max-w-xl text-[2.1rem] leading-[1.08] font-semibold text-balance text-foreground sm:text-[2.75rem]">
                {NID_TAGLINE}
              </h1>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
                {NID_SUBLINE}
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-5">
                <Button size="lg" data-touch render={<Link href={SIGNUP_HREF} />}>
                  Ajouter mon téléphone
                </Button>
                <p className="text-sm text-muted-foreground">
                  Gratuit jusqu’à 3 téléphones, sans carte bancaire.
                </p>
              </div>
            </div>

            <TrackingPreview />
          </div>
        </section>

        {/* ---------------- Comment ça marche ---------------- */}
        <section
          id="fonctionnement"
          className="nid-rule mx-auto w-full max-w-5xl scroll-mt-20 px-5 py-14 sm:px-8"
        >
          <h2 className="text-2xl font-semibold text-foreground">Comment ça marche</h2>
          <ol className="mt-8">
            {STEPS.map(([title, text], index) => (
              <li
                key={title}
                className="nid-rule grid gap-1 py-5 first:border-0 first:pt-0 sm:grid-cols-[3rem_16rem_1fr] sm:items-baseline sm:gap-6"
              >
                <span className="nid-step">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="text-[17px] font-medium text-foreground">{title}</h3>
                <p className="text-[15px] leading-relaxed text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------------- Publics ---------------- */}
        {AUDIENCES.map((audience) => (
          <section
            key={audience.id}
            id={audience.id}
            className="nid-rule mx-auto w-full max-w-5xl scroll-mt-20 px-5 py-14 sm:px-8"
          >
            <div className="grid gap-8 md:grid-cols-[19rem_1fr] md:gap-16">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">{audience.title}</h2>
                <p className="mt-2 text-[15px] text-muted-foreground">{audience.lead}</p>
              </div>
              <dl>
                {audience.items.map(([term, detail]) => (
                  <div
                    key={term}
                    className="nid-rule flex flex-wrap gap-x-3 gap-y-1 py-3 first:border-0 first:pt-0"
                  >
                    <dt className="min-w-52 text-[15px] font-medium text-foreground">{term}</dt>
                    <dd className="flex-1 text-[15px] text-muted-foreground">{detail}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        ))}

        {/* ---------------- Confidentialité ---------------- */}
        <section
          id="confidentialite"
          className="nid-rule mx-auto w-full max-w-5xl scroll-mt-20 px-5 py-14 sm:px-8"
        >
          <h2 className="text-2xl font-semibold text-foreground">Confidentialité</h2>
          <div className="mt-8 grid gap-x-16 gap-y-8 sm:grid-cols-2">
            {PRIVACY.map(([title, text]) => (
              <div key={title} className="border-l-2 border-border pl-4">
                <h3 className="text-[17px] font-medium text-foreground">{title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- Tarifs ---------------- */}
        <section
          id="tarifs"
          className="nid-rule mx-auto w-full max-w-5xl scroll-mt-20 px-5 py-14 sm:px-8"
        >
          <h2 className="text-2xl font-semibold text-foreground">Tarifs</h2>
          <p className="mt-2 max-w-2xl text-[15px] text-muted-foreground">
            La création d’un téléphone, la consultation de son historique et le transfert restent
            gratuits. L’abonnement Nireo ID est indépendant de Nireo Immo.
          </p>

          <dl className="mt-8">
            {NID_PLAN_LIST.map((plan) => (
              <div
                key={plan.id}
                className="nid-rule grid gap-x-8 gap-y-2 py-5 first:border-0 first:pt-0 sm:grid-cols-[14rem_9rem_1fr] sm:items-baseline"
              >
                <dt className="text-[17px] font-medium text-foreground">{plan.label}</dt>
                <dd className="text-[17px] text-foreground tabular-nums">{formatNidPrice(plan)}</dd>
                <dd className="text-[15px] leading-relaxed text-muted-foreground">
                  {plan.summary} {plan.features.slice(0, 3).join(" · ")}.
                </dd>
              </div>
            ))}

            <div className="nid-rule grid gap-x-8 gap-y-2 py-5 sm:grid-cols-[14rem_9rem_1fr] sm:items-baseline">
              <dt className="text-[17px] font-medium text-foreground">Flotte supérieure</dt>
              <dd className="text-[17px] text-foreground">Sur devis</dd>
              <dd className="text-[15px] leading-relaxed text-muted-foreground">
                Au-delà de 150 téléphones, écrivez-nous : nous étudions votre organisation avant de
                proposer un tarif.{" "}
                <Link href="/contact" className="text-foreground underline underline-offset-4">
                  Nous écrire
                </Link>
                .
              </dd>
            </div>
          </dl>

          <div className="mt-10">
            <Button size="lg" data-touch render={<Link href={SIGNUP_HREF} />}>
              Ajouter mon téléphone
            </Button>
          </div>
        </section>

        {/* ---------------- FAQ ---------------- */}
        <section
          id="faq"
          className="nid-rule mx-auto w-full max-w-3xl scroll-mt-20 px-5 py-14 sm:px-8"
        >
          <h2 className="text-2xl font-semibold text-foreground">Questions fréquentes</h2>
          <dl className="mt-8">
            {FAQ.map(([question, answer]) => (
              <div key={question} className="nid-rule py-5 first:border-0 first:pt-0">
                <dt className="text-[17px] font-medium text-foreground">{question}</dt>
                <dd className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <NidPublicFooter />
    </div>
  );
}
