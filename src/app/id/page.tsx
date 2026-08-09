import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  Check,
  FileText,
  RefreshCw,
  Send,
  Smartphone,
  Wrench,
} from "lucide-react";
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
  { title: "Ajoutez le téléphone", text: "Dès l’achat : marque, modèle, facture." },
  { title: "Faites un bilan rapide", text: "Une question par mois, une réponse en un clic." },
  { title: "Conservez les réparations", text: "Chaque intervention rejoint le même historique." },
  { title: "Transmettez son historique", text: "À la revente, le suivi part avec l’appareil." },
];

const AUDIENCES = [
  {
    id: "particuliers",
    icon: Smartphone,
    title: "Pour les particuliers",
    items: [
      "Facture et garantie conservées",
      "État du téléphone à jour",
      "Rappels réguliers",
      "Réparations enregistrées",
      "Partage et transfert",
    ],
  },
  {
    id: "entreprises",
    icon: Building2,
    title: "Pour les entreprises",
    items: [
      "Parc de téléphones",
      "Affectations aux salariés",
      "Bilans salariés",
      "Réparations",
      "Coûts et historique",
    ],
  },
  {
    id: "reparateurs",
    icon: Wrench,
    title: "Pour les réparateurs",
    items: [
      "Accès par lien ou QR",
      "Intervention détaillée",
      "Photos et facture jointes",
      "Validation par le client",
    ],
  },
];

const PRIVACY = [
  {
    title: "Données privées",
    text: "Votre suivi n’est visible de personne tant que vous ne partagez rien.",
  },
  {
    title: "Identifiants masqués",
    text: "L’IMEI et le numéro de série complets ne sortent jamais d’un rapport partagé.",
  },
  {
    title: "Partage contrôlé",
    text: "Vous choisissez ce que contient le rapport, sa durée, et vous le coupez quand vous voulez.",
  },
  {
    title: "Aucune surveillance",
    text: "Un employeur ne voit ni appels, ni messages, ni position, ni applications : seulement l’état matériel.",
  },
];

const FAQ = [
  {
    question: "Nireo vérifie-t-il qu’un téléphone n’est pas volé ?",
    answer:
      "Non. Nireo ID n’est relié à aucun fichier officiel. Un téléphone peut être « déclaré volé » par son propriétaire ou son entreprise : c’est une déclaration, pas une vérification.",
  },
  {
    question: "Nireo lit-il l’IMEI automatiquement ?",
    answer:
      "Non. Une application web n’a pas accès à cet identifiant. Vous pouvez le scanner depuis la boîte, l’importer depuis une image ou le saisir : dans tous les cas vous confirmez la valeur.",
  },
  {
    question: "Que voit mon employeur sur mon téléphone professionnel ?",
    answer:
      "L’état matériel que vous déclarez et le besoin de réparation. Rien d’autre : pas d’appels, pas de messages, pas de position, pas de temps d’écran.",
  },
  {
    question: "Que se passe-t-il quand je revends le téléphone ?",
    answer:
      "Vous ouvrez un transfert vers l’adresse de l’acheteur, qui doit l’accepter. L’historique suit l’appareil ; vos documents privés, eux, ne partent que si vous le décidez.",
  },
  {
    question: "Une réparation est-elle certifiée par Nireo ?",
    answer:
      "Non. Elle est « attestée par un réparateur » lorsque l’atelier a une identité professionnelle approuvée, sinon elle reste « déclarée par l’atelier ». Nireo ne certifie rien automatiquement.",
  },
  {
    question: "Puis-je utiliser Nireo ID gratuitement ?",
    answer:
      "Oui. L’offre personnelle gratuite couvre jusqu’à trois téléphones, avec les bilans, les réparations, le partage et le transfert.",
  },
];

/** Fiche d'exemple du hero — visuel sobre, aucune donnée réelle. */
function ExampleCard() {
  const timeline = [
    { icon: FileText, label: "Achat", date: "12 mars 2026" },
    { icon: RefreshCw, label: "Bilan mensuel", date: "2 août 2026" },
    { icon: Wrench, label: "Réparation", date: "18 juin 2026" },
    { icon: Send, label: "Transfert", date: "à la revente" },
  ];

  return (
    <div className="nid-panel w-full rounded-2xl p-5" aria-hidden>
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-11 shrink-0 place-items-center rounded-lg border border-border bg-secondary">
          <Smartphone className="size-5 text-muted-foreground" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">iPhone 16 Pro</p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-[var(--nid-success)]">
            <Check className="size-4" />
            Bon état
          </p>
        </div>
      </div>

      <p className="mt-4 rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
        Prochain bilan dans 6 jours
      </p>

      <ul className="mt-4 space-y-3 border-t border-border pt-4">
        {timeline.map((item) => (
          <li key={item.label} className="flex items-center gap-3 text-sm">
            <item.icon className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-foreground">{item.label}</span>
            <span className="text-muted-foreground">{item.date}</span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-muted-foreground">Exemple d’affichage.</p>
    </div>
  );
}

export default function NireoIdLandingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <NidPublicHeader />

      <main id="contenu" className="flex-1">
        {/* ---------------- Hero ---------------- */}
        <section className="border-b border-border bg-card">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
            <div>
              <h1 className="text-3xl font-semibold text-balance text-foreground sm:text-4xl">
                {NID_TAGLINE}
              </h1>
              <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
                {NID_SUBLINE}
              </p>
              <div className="mt-8">
                <Button size="lg" data-touch render={<Link href={SIGNUP_HREF} />}>
                  Ajouter mon téléphone
                </Button>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Gratuit jusqu’à 3 téléphones. Aucune carte bancaire.
              </p>
            </div>

            <div className="md:justify-self-end md:pl-6">
              <ExampleCard />
            </div>
          </div>
        </section>

        {/* ---------------- Comment ça marche ---------------- */}
        <section id="fonctionnement" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold text-foreground">Comment ça marche</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="nid-panel rounded-2xl p-5">
                <span className="inline-grid size-8 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                  {index + 1}
                </span>
                <h3 className="mt-4 font-medium text-foreground">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------------- Publics ---------------- */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-16 sm:px-6 lg:grid-cols-3">
            {AUDIENCES.map((audience) => (
              <section
                key={audience.id}
                id={audience.id}
                className="nid-panel scroll-mt-20 rounded-2xl p-6"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <audience.icon className="size-5" aria-hidden />
                </span>
                <h2 className="mt-4 text-lg font-semibold text-foreground">{audience.title}</h2>
                <ul className="mt-4 space-y-2.5">
                  {audience.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                      <Check
                        className="mt-0.5 size-4 shrink-0 text-[var(--nid-success)]"
                        aria-hidden
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>

        {/* ---------------- Confidentialité ---------------- */}
        <section id="confidentialite" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold text-foreground">Confidentialité</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {PRIVACY.map((item) => (
              <div key={item.title} className="nid-panel rounded-2xl p-5">
                <h3 className="font-medium text-foreground">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- Tarifs ---------------- */}
        <section id="tarifs" className="border-y border-border bg-card">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-semibold text-foreground">Tarifs</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              La création d’un téléphone, la consultation de son historique et le transfert
              restent gratuits. L’abonnement Nireo ID est indépendant de Nireo Immo.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {NID_PLAN_LIST.map((plan) => (
                <div key={plan.id} className="nid-panel flex flex-col rounded-2xl p-6">
                  <h3 className="font-medium text-foreground">{plan.label}</h3>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {formatNidPrice(plan)}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{plan.summary}</p>
                  <ul className="mt-4 flex-1 space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground">
                        <Check
                          className="mt-0.5 size-4 shrink-0 text-[var(--nid-success)]"
                          aria-hidden
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <div className="nid-panel flex flex-col rounded-2xl p-6">
                <h3 className="font-medium text-foreground">Flotte supérieure</h3>
                <p className="mt-2 text-2xl font-semibold text-foreground">Sur devis</p>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">
                  Au-delà de 150 téléphones, écrivez-nous : nous étudions votre organisation avant
                  de proposer un tarif.
                </p>
                <div className="mt-4">
                  <Button variant="outline" render={<Link href="/contact" />}>
                    Nous écrire
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <Button size="lg" data-touch render={<Link href={SIGNUP_HREF} />}>
                Ajouter mon téléphone
              </Button>
            </div>
          </div>
        </section>

        {/* ---------------- FAQ ---------------- */}
        <section id="faq" className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold text-foreground">Questions fréquentes</h2>
          <dl className="mt-8 space-y-4">
            {FAQ.map((item) => (
              <div key={item.question} className="nid-panel rounded-2xl p-5">
                <dt className="font-medium text-foreground">{item.question}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <NidPublicFooter />
    </div>
  );
}
