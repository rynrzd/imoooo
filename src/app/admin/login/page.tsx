import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { AdminLoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion administrateur" };

/**
 * /admin/login — connexion administrateur, distincte de /connexion.
 * Aucune inscription possible ici : les comptes admin sont créés
 * uniquement côté serveur (voir supabase/README).
 */
export default function AdminLoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <ShieldCheck className="size-5.5" />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">
            Administration Nireo
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Espace réservé. Chaque tentative de connexion est journalisée.
          </p>
        </div>
        <div className="mt-8 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <AdminLoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <a
            href="/connexion"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Retour à la connexion client
          </a>
        </p>
      </div>
    </div>
  );
}
