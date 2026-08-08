import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Ressource Nireo ID introuvable — ou n'appartenant pas à ce compte. */
export default function NireoIdNotFound() {
  return (
    <div className="flex min-h-svh items-center justify-center px-4 py-16">
      <div className="nid-panel w-full max-w-md rounded-2xl p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <SearchX className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-foreground">Page introuvable</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Cette page n’existe pas, ou la ressource demandée ne fait pas partie
          de votre compte. Si vous pensez qu’il s’agit d’une erreur, vérifiez
          le lien reçu.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button data-touch render={<Link href="/id/app" />}>
            Mes objets
          </Button>
          <Button variant="outline" data-touch render={<Link href="/id" />}>
            Accueil Nireo ID
          </Button>
        </div>
      </div>
    </div>
  );
}
