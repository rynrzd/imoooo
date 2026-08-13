import Link from "next/link";
import { NireoMark } from "@/components/marketing/nireo-logo";

/**
 * Marque de l'espace connecté — le VRAI logo Nireo, le même que la landing,
 * l'inscription et la connexion.
 *
 * Il ne reste rien de l'ancienne pastille (une icône d'immeuble générique dans
 * un carré bleu plein) : elle ne disait pas « Nireo », elle disait
 * « application immobilière », et faisait cohabiter deux identités dans le même
 * produit. `NireoMark flat` est la version claire du monogramme, dessinée pour
 * les surfaces blanc cassé.
 *
 * `min-h-11` : le lien reste une cible tactile confortable dans le header
 * mobile, sans changer la taille apparente du logo.
 */
export function Brand() {
  return (
    <Link
      href="/"
      className="flex min-h-11 items-center gap-2"
      aria-label="Nireo — accueil"
    >
      <NireoMark flat className="size-8 rounded-[0.45rem]" />
      <span className="text-base font-semibold tracking-[-0.03em] text-foreground">
        Nireo
      </span>
    </Link>
  );
}
