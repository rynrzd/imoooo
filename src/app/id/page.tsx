import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  EyeOff,
  FileWarning,
  KeyRound,
  Link2Off,
  Receipt,
  ShieldCheck,
  Smartphone,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NidPublicFooter } from "@/components/nireo-id/public-footer";
import { NidPublicHeader } from "@/components/nireo-id/public-header";
import { PassportPreview } from "@/components/nireo-id/passport-preview";
import { TrustLegend } from "@/components/nireo-id/trust-badge";

export const metadata: Metadata = {
  title: "Nireo ID — L’historique suit l’objet, pas le propriétaire",
  description:
    "Créez le passeport numérique de votre smartphone, conservez ses documents et transmettez son historique lorsque vous le vendez.",
  alternates: { canonical: "/id" },
};

const SIGNUP_HREF = "/inscription?next=%2Fid%2Fapp%2Fobjets%2Fnouveau";

const PROBLEMS = [
  {
    icon: Receipt,
    title: "La facture a disparu",
    text: "Elle était dans une boîte mail, un tiroir ou un téléphone revendu. Sans elle, plus de garantie ni de preuve d’achat.",
  },
  {
    icon: Wrench,
    title: "La réparation est invisible",
    text: "Écran changé, batterie remplacée, appareil ouvert : rien ne le montre sur l’objet lui-même.",
  },
  {
    icon: FileWarning,
    title: "La garantie ne se transmet pas",
    text: "L’acheteur reprend un appareil sans savoir ce qui est encore couvert, ni par qui.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Créez l’identité du smartphone",
    text: "Marque, modèle, photo, et si vous le souhaitez le numéro de série. Nireo génère un identifiant unique et un dossier privé.",
  },
  {
    number: "02",
    title: "Enrichissez son historique",
    text: "Ajoutez la facture, l’état constaté, les réparations. Un réparateur approuvé peut y inscrire son intervention.",
  },
  {
    number: "03",
    title: "Transférez-le avec son passeport",
    text: "À la revente, vous transmettez le dossier à l’acheteur. Vous choisissez document par document ce qui suit l’objet.",
  },
];

const PRIVACY = [
  {
    icon: EyeOff,
    title: "Privé par défaut",
    text: "Votre dossier n’est visible de personne tant que vous ne partagez rien.",
  },
  {
    icon: KeyRound,
    title: "IMEI et numéro de série masqués",
    text: "Ils ne sortent jamais d’une page publique. Au maximum les quatre derniers caractères, si vous l’autorisez.",
  },
  {
    icon: Link2Off,
    title: "Liens révocables",
    text: "Un partage dure 24 h, 7 ou 30 jours, ne contient que les sections choisies, et se coupe en un clic.",
  },
  {
    icon: ShieldCheck,
    title: "Documents jamais publics",
    text: "Factures et comptes rendus ne deviennent jamais publics automatiquement — même après un transfert.",
  },
];

const FAQ = [
  {
    question: "Nireo garantit-il que le téléphone n’est pas volé ?",
    answer:
      "Non. Nireo ID n’est relié à aucun fichier officiel d’appareils déclarés volés et ne réalise aucun contrôle de ce type. Le produit affiche l’historique déclaré par les propriétaires successifs et les interventions enregistrées par des professionnels approuvés — rien de plus.",
  },
  {
    question: "Qui peut voir mon IMEI et mes factures ?",
    answer:
      "Vous seul, tant que vous ne partagez rien. L’aperçu public ne montre jamais l’IMEI complet ni un document. Un dossier partagé n’affiche que les sections et les documents que vous avez explicitement cochés, pour la durée choisie.",
  },
  {
    question: "Que se passe-t-il lorsque je vends mon téléphone ?",
    answer:
      "Vous ouvrez un transfert vers l’adresse e-mail de l’acheteur. Il doit être connecté avec cette adresse pour accepter. À l’acceptation, la propriété change, l’historique suit l’objet, vos liens de partage sont révoqués, et vous conservez un reçu de transfert.",
  },
  {
    question: "Un ancien propriétaire peut-il modifier l’historique ?",
    answer:
      "Non. Dès l’acceptation du transfert, il perd tout droit de modification sur le passeport. Les événements déjà inscrits restent, et une correction passe toujours par une révocation motivée, jamais par un effacement silencieux.",
  },
  {
    question: "Comment une réparation devient-elle validée par un professionnel ?",
    answer:
      "Le professionnel dépose une candidature, examinée par l’équipe Nireo. Une fois son compte approuvé, il ne peut intervenir que sur les passeports pour lesquels vous lui avez donné accès. Son intervention porte alors son identité et le niveau « Validé par un professionnel ».",
  },
];

export default function NireoIdLandingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <NidPublicHeader />

      <main className="flex-1">
        {/* ---------------------------------------------------------- */}
        {/*  Hero                                                       */}
        {/* ---------------------------------------------------------- */}
        <section className="relative overflow-hidden border-b border-border">
          <div
            aria-hidden
            className="nid-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(120%_80%_at_50%_0%,#000_20%,transparent_75%)]"
          />
          <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
            <div className="nid-in">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <Smartphone className="size-3.5 text-primary" aria-hidden />
                Première catégorie : les smartphones
              </span>

              <h1 className="mt-5 text-4xl font-semibold text-balance text-foreground sm:text-5xl">
                L’historique suit l’objet.{" "}
                <span className="text-[var(--nid-accent-strong)]">Pas le propriétaire.</span>
              </h1>

              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
                Créez le passeport numérique de votre smartphone, conservez ses
                documents et transmettez son historique lorsque vous le vendez.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" data-touch render={<Link href={SIGNUP_HREF} />}>
                  Créer gratuitement mon premier passeport
                  <ArrowRight className="size-4" data-icon="inline-end" />
                </Button>
                <Button variant="outline" size="lg" data-touch render={<Link href="/id/exemple" />}>
                  Voir un exemple
                </Button>
              </div>

              <p className="mt-5 max-w-md text-xs leading-relaxed text-muted-foreground">
                Nireo ID n’est ni une certification officielle, ni un contrôle
                anti-vol. Le produit distingue toujours une déclaration
                personnelle d’une validation professionnelle.
              </p>
            </div>

            <PassportPreview className="nid-in lg:justify-self-end lg:max-w-md" />
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/*  Problème                                                   */}
        {/* ---------------------------------------------------------- */}
        <section className="border-b border-border">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <h2 className="max-w-2xl text-3xl font-semibold text-balance text-foreground">
              Quand le téléphone change de main, son histoire disparaît.
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              L’acheteur d’occasion achète un objet dont il ne sait presque
              rien. Le vendeur, lui, ne sait pas comment transmettre ce qu’il a
              conservé pendant des années.
            </p>

            <ul className="mt-10 grid gap-4 md:grid-cols-3">
              {PROBLEMS.map((problem) => (
                <li key={problem.title} className="nid-panel rounded-2xl p-5">
                  <span className="grid size-10 place-items-center rounded-xl bg-muted text-foreground">
                    <problem.icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-foreground">{problem.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {problem.text}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/*  Fonctionnement                                             */}
        {/* ---------------------------------------------------------- */}
        <section id="fonctionnement" className="scroll-mt-20 border-b border-border bg-card">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <h2 className="text-3xl font-semibold text-foreground">Comment ça fonctionne</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Trois étapes, sans jargon et sans promesse que le produit ne tient pas.
            </p>

            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {STEPS.map((step) => (
                <li key={step.number} className="rounded-2xl border border-border bg-background p-5">
                  <span className="font-mono text-xs font-medium tracking-widest text-primary">
                    {step.number}
                  </span>
                  <h3 className="mt-3 text-base font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/*  Confiance                                                  */}
        {/* ---------------------------------------------------------- */}
        <section id="confiance" className="scroll-mt-20 border-b border-border">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:py-20">
            <div>
              <h2 className="text-3xl font-semibold text-balance text-foreground">
                Chaque information dit d’où elle vient.
              </h2>
              <p className="mt-3 text-muted-foreground">
                Nireo ID ne mélange jamais ce que vous déclarez et ce qu’un
                professionnel a constaté. Quatre niveaux, un vocabulaire fixe,
                aucune ambiguïté.
              </p>
              <p className="mt-4 rounded-xl border border-border bg-muted/60 p-4 text-sm leading-relaxed text-muted-foreground">
                Nous n’employons jamais la mention « vérifié par Nireo » :
                aucun protocole de contrôle Nireo n’existe aujourd’hui, et nous
                n’affichons pas une garantie que nous ne réalisons pas.
              </p>
            </div>
            <div className="nid-panel rounded-2xl p-6">
              <TrustLegend />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/*  Professionnels                                             */}
        {/* ---------------------------------------------------------- */}
        <section id="professionnels" className="scroll-mt-20 border-b border-border bg-card">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-20">
            <div>
              <h2 className="text-3xl font-semibold text-balance text-foreground">
                Chaque intervention devient une preuve utile pour votre client.
              </h2>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Réparateur, reconditionneur ou atelier de diagnostic : votre
                travail disparaît aujourd’hui avec le ticket de caisse. Avec un
                compte professionnel approuvé, votre intervention s’inscrit dans
                le passeport de l’appareil, sous votre nom, et reste visible par
                tous ses futurs propriétaires.
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-muted-foreground">
                <li className="flex gap-2.5">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  Accès uniquement sur autorisation du propriétaire — jamais de
                  recherche libre dans la base.
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  Pièces remplacées, origine, garantie d’intervention et photos
                  avant/après.
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  Correction possible par révocation motivée : l’historique
                  reste traçable.
                </li>
              </ul>
              <div className="mt-8">
                <Button size="lg" data-touch render={<Link href="/id/pro/candidature" />}>
                  Demander un compte professionnel
                  <ArrowRight className="size-4" data-icon="inline-end" />
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background p-6">
              <h3 className="text-sm font-semibold text-foreground">
                Comment se déroule la validation
              </h3>
              <ol className="mt-4 space-y-4">
                {[
                  "Vous déposez votre candidature : nom commercial, SIRET, responsable, activité.",
                  "L’équipe Nireo l’examine et rend une décision motivée.",
                  "Une fois approuvé, vous accédez aux passeports pour lesquels un client vous autorise.",
                  "Vos interventions portent votre identité et le niveau « Validé par un professionnel ».",
                ].map((line, index) => (
                  <li key={line} className="flex gap-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
                      {index + 1}
                    </span>
                    <span className="text-sm leading-relaxed text-muted-foreground">{line}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
                Tant que votre compte n’est pas approuvé, aucune intervention ne
                peut être enregistrée comme validée : la règle est appliquée par
                le serveur, pas seulement par l’interface.
              </p>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/*  Confidentialité                                            */}
        {/* ---------------------------------------------------------- */}
        <section className="border-b border-border">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <h2 className="text-3xl font-semibold text-foreground">Vos données restent les vôtres</h2>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PRIVACY.map((item) => (
                <li key={item.title} className="nid-panel rounded-2xl p-5">
                  <item.icon className="size-5 text-primary" aria-hidden />
                  <h3 className="mt-3 text-sm font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/*  FAQ                                                        */}
        {/* ---------------------------------------------------------- */}
        <section id="faq" className="scroll-mt-20 border-b border-border bg-card">
          <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:py-20">
            <h2 className="text-3xl font-semibold text-foreground">Questions fréquentes</h2>
            <div className="mt-8 divide-y divide-border rounded-2xl border border-border bg-background">
              {FAQ.map((item) => (
                <details key={item.question} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-1 text-[15px] font-medium text-foreground marker:content-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                    {item.question}
                    <span
                      aria-hidden
                      className="grid size-6 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="pt-2 pb-1 text-sm leading-relaxed text-muted-foreground">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/*  Appel final                                                */}
        {/* ---------------------------------------------------------- */}
        <section>
          <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center sm:px-6 lg:py-20">
            <h2 className="text-3xl font-semibold text-balance text-foreground">
              Commencez par un seul smartphone.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              La création d’un passeport prend quelques minutes. Vous pourrez
              tout compléter plus tard : documents, état, réparations.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" data-touch render={<Link href={SIGNUP_HREF} />}>
                Créer gratuitement mon premier passeport
              </Button>
              <Button variant="ghost" size="lg" data-touch render={<Link href="/" />}>
                Découvrir Nireo Immo
              </Button>
            </div>
          </div>
        </section>
      </main>

      <NidPublicFooter />
    </div>
  );
}
