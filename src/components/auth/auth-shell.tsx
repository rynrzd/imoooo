import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Clock,
  Lock,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { NireoLogo } from "@/components/marketing/nireo-logo";
import { isSupabaseConfigured } from "@/lib/supabase/config";

interface AuthShellProps {
  title: string;
  description: string;
  children: React.ReactNode;
  /** Liens secondaires sous la carte. */
  footer?: React.ReactNode;
}

const TRUST = [
  { icon: ShieldCheck, label: "Données isolées par compte" },
  { icon: Lock, label: "Stockage privé & liens signés" },
  { icon: Clock, label: "Sauvegarde automatique" },
];

/* ------------------------------------------------------------------ */
/*  Scène de gauche — l'aperçu premium qui donne envie d'entrer.       */
/* ------------------------------------------------------------------ */
function AuthScene() {
  return (
    <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
      {/* Aurore locale */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="nireo-aurora absolute -top-24 -left-24 h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(closest-side,var(--nireo-glow-a),transparent)] opacity-40 blur-2xl" />
        <div
          className="nireo-aurora absolute right-0 bottom-0 h-96 w-96 rounded-full bg-[radial-gradient(closest-side,var(--nireo-glow-b),transparent)] opacity-30 blur-2xl"
          style={{ animationDelay: "-7s" }}
        />
        <div className="nireo-grid absolute inset-0" />
      </div>

      <NireoLogo />

      <div className="max-w-md">
        <h2 className="text-4xl font-semibold text-balance text-foreground">
          Reprenez le contrôle de votre{" "}
          <span className="nireo-shine">patrimoine.</span>
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          Votre poste de pilotage vous attend : loyers, locataires, documents
          et travaux, réunis dans un espace clair et à jour en permanence.
        </p>

        {/* Cockpit flottant */}
        <div className="nireo-float mt-10" style={{ "--float-dur": "8s" } as React.CSSProperties}>
          <div className="nireo-glass nireo-hairline w-full max-w-sm rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-foreground">Ce mois-ci</p>
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                <span className="size-1.5 rounded-full bg-emerald-400" /> À jour
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { l: "Loyers", v: "4 505 €" },
                { l: "Encaissé", v: "96 %" },
                { l: "Rendement", v: "5,4 %" },
              ].map((k) => (
                <div key={k.l} className="rounded-xl border border-white/8 bg-white/[0.03] p-2.5">
                  <p className="text-[10px] text-muted-foreground">{k.l}</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{k.v}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
              <span className="grid size-7 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
                <Check className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1 text-xs text-foreground">Loyer de juillet encaissé</span>
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-300">
                <TrendingUp className="size-3" /> +840 €
              </span>
            </div>
          </div>
        </div>

        <ul className="mt-10 space-y-2.5">
          {TRUST.map((t) => (
            <li key={t.label} className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <t.icon className="size-4 text-primary" />
              {t.label}
            </li>
          ))}
        </ul>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
        Nireo · le logiciel des propriétaires bailleurs
        <ArrowUpRight className="size-3.5" />
      </p>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  Coquille commune des écrans d'authentification — split-screen.     */
/* ------------------------------------------------------------------ */
export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <div className="dark nireo relative min-h-svh overflow-hidden bg-background text-foreground">
      {/* Décor ambiant global (visible surtout côté formulaire / mobile). */}
      <div aria-hidden className="nireo-ambient">
        <div className="nireo-noise" />
      </div>

      <div className="relative z-10 grid min-h-svh lg:grid-cols-2">
        <AuthScene />

        {/* Colonne formulaire */}
        <div className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-sm">
            {/* Marque affichée ici sur mobile (la scène est masquée). */}
            <div className="mb-8 flex justify-center lg:hidden">
              <NireoLogo />
            </div>

            <div className="nireo-glass nireo-hairline animate-nireo-rise rounded-3xl p-6 sm:p-8">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>

              {!isSupabaseConfigured ? (
                <p className="mt-5 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-300">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  Mode démo : Supabase n’est pas configuré. Renseignez vos clés
                  dans .env.local pour activer l’authentification.
                </p>
              ) : null}

              <div className="nireo-auth mt-6">{children}</div>
            </div>

            {footer ? (
              <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
