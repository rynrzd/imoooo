import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/** Page 404 globale — publique comme privée. */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
        Erreur 404
      </p>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Cette page n&apos;existe pas
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        L&apos;adresse est peut-être erronée, ou la ressource a été supprimée.
      </p>
      <div className="mt-2 flex gap-2">
        <Link href="/" className={buttonVariants({})}>
          Retour à l&apos;accueil
        </Link>
        <Link href="/connexion" className={buttonVariants({ variant: "outline" })}>
          Se connecter
        </Link>
      </div>
    </div>
  );
}
