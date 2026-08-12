import Link from "next/link";
import { Building2 } from "lucide-react";

/**
 * Logo + nom du produit, utilisé dans la sidebar et le header mobile.
 *
 * `min-h-11` : le lien reste une cible tactile confortable dans le header
 * mobile, sans changer la taille apparente du logo.
 */
export function Brand() {
  return (
    <Link
      href="/"
      className="flex min-h-11 items-center gap-2 px-1"
      aria-label="Nireo — accueil"
    >
      <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Building2 className="size-4.5" />
      </span>
      <span className="text-base font-semibold tracking-[-0.02em] text-foreground">
        Nireo
      </span>
    </Link>
  );
}
