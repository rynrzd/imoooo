import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Smartphone, Wrench } from "lucide-react";
import { requireNidSession } from "@/features/nireo-id/server/guards";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Bienvenue" };

/**
 * Premier écran après la connexion.
 * Ce choix lance seulement le bon parcours : il ne fixe PAS le type de
 * compte, et rien n'est irréversible.
 */
const CHOICES = [
  {
    href: "/id/app/objets/nouveau",
    icon: Smartphone,
    title: "Ajouter mon téléphone",
    text: "Enregistrez votre téléphone, sa facture et son état en moins de deux minutes.",
  },
  {
    href: "/id/app/espaces/nouveau?type=entreprise",
    icon: Building2,
    title: "Gérer les téléphones de mon entreprise",
    text: "Créez un espace entreprise, importez votre parc et affectez les téléphones.",
  },
  {
    href: "/id/app/espaces/nouveau?type=atelier",
    icon: Wrench,
    title: "Enregistrer une réparation",
    text: "Créez votre espace atelier pour compléter l’historique des téléphones réparés.",
  },
];

export default async function WelcomePage() {
  await requireNidSession("/id/app/bienvenue");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">
          Que souhaitez-vous faire aujourd’hui ?
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ce choix ouvre simplement le bon parcours. Vous pourrez faire les autres plus tard.
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-3">
        {CHOICES.map((choice) => (
          <li key={choice.href}>
            <Link
              href={choice.href}
              className="nid-panel flex h-full flex-col rounded-lg p-5 transition-colors hover:bg-muted/50"
            >
              <choice.icon className="size-5 text-primary" aria-hidden />
              <span className="mt-4 text-[17px] font-medium text-foreground">{choice.title}</span>
              <span className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {choice.text}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p>
        <Link href="/id/app" className="text-sm text-primary underline underline-offset-2">
          Passer cette étape
        </Link>
      </p>
    </div>
  );
}
