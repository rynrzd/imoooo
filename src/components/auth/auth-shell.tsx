import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { NireoMark } from "@/components/marketing/nireo-logo";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Coquille des écrans d'authentification — une photographie, un formulaire.
 *
 * La grande carte sombre centrée a disparu. À la place, la composition de la
 * vitrine : la photographie du hero occupe le haut de l'écran (la colonne
 * gauche au bureau), et une surface blanc cassé remonte du bas avec ses deux
 * coins supérieurs arrondis. Pas de bordure extérieure, pas d'ombre portée,
 * pas de verre dépoli, pas de fond noir derrière les champs.
 *
 * - MOBILE : photo sur ~42 % de la hauteur visible, puis la surface qui prend
 *   tout le reste. Le formulaire commence donc juste sous la ligne de
 *   flottaison, sans espace mort.
 * - BUREAU (≥ 1024 px) : deux colonnes, 56 % pour la photographie, le
 *   formulaire limité à 460 px et centré verticalement dans la seconde.
 *
 * La photographie est l'asset DÉJÀ validé du hero (`public/photos/
 * hero-appartement.jpg`) : aucune image n'est générée. Son voile bleu nuit est
 * ce qui garantit la lisibilité, jamais la photo elle-même.
 *
 * `nireo-app-light` fige la palette claire : la page garde le même rendu même
 * si le visiteur navigue en thème sombre.
 */

export interface AuthShellProps {
  /** Petit label bleu au-dessus du titre (COMMENCER, BON RETOUR, ACCÈS…). */
  label: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Liens de bas de formulaire (déjà un compte, retour à la connexion…). */
  footer?: React.ReactNode;
}

/** Photographie du hero — asset partagé avec la vitrine. */
const PHOTO = "/photos/hero-appartement.jpg";

/** La promesse, identique sur les quatre écrans. */
const PROMISE = {
  title: "Votre patrimoine vous attend.",
  text: "Retrouvez tout, sans chercher.",
};

export function AuthShell({
  label,
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="nireo-auth nireo-app-light relative flex min-h-svh flex-col overflow-x-clip bg-[var(--auth-night)] lg:grid lg:min-h-svh lg:grid-cols-[56%_1fr] lg:items-stretch">
      {/* ---------------- La photographie ---------------- */}
      <section className="relative isolate h-[42svh] min-h-[15rem] shrink-0 overflow-hidden lg:h-auto lg:min-h-svh">
        <Image
          src={PHOTO}
          alt="Appartement haussmannien : parquet en point de Hongrie, cheminée en marbre et fenêtres ouvertes sur les toits"
          fill
          priority
          sizes="(min-width: 1024px) 56vw, 100vw"
          // Cadrage : le bandeau mobile est court et large, on privilégie donc
          // la pièce éclairée (la porte sombre suffit à porter la pastille de
          // marque). La colonne du bureau est haute : on revient vers le centre.
          className="-z-10 object-cover object-[68%_48%] lg:object-[52%_50%]"
        />
        {/* Voile bleu nuit : dense en bas (le texte s'y pose), léger en haut
            (la pastille de marque a son propre fond). */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(7_12_21/0.92)_0%,rgb(7_12_21/0.55)_45%,rgb(7_12_21/0.25)_75%,rgb(7_12_21/0.35)_100%)]"
        />

        {/* Retour à la vitrine + marque compacte. Aucun header public, aucun
            menu : deux éléments, dans une pastille lisible sur la photo. */}
        <div
          className="absolute inset-x-0 top-0 flex items-center gap-1 px-4 sm:px-6"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <Link
            href="/"
            aria-label="Retour à l'accueil"
            className="inline-grid size-11 place-items-center rounded-xl bg-[rgb(7_12_21/0.55)] text-white backdrop-blur-sm transition-colors duration-200 hover:bg-[rgb(7_12_21/0.75)] focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
          <Link
            href="/"
            aria-label="Nireo — accueil"
            className="flex min-h-11 items-center gap-2 rounded-xl bg-[rgb(7_12_21/0.55)] px-3 text-white backdrop-blur-sm transition-colors duration-200 hover:bg-[rgb(7_12_21/0.75)] focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            <NireoMark flat className="size-7 rounded-[0.4rem] bg-white text-[#1b52e8]" />
            <span className="text-[1.05rem] font-semibold tracking-[-0.03em]">Nireo</span>
          </Link>
        </div>

        {/* La promesse. Sur mobile elle est remontée de la hauteur du congé de
            la surface, pour ne jamais passer dessous. */}
        <div className="absolute inset-x-0 bottom-0 px-6 pb-9 sm:px-8 lg:px-12 lg:pb-14">
          <p className="text-[clamp(1.6rem,6vw,2.6rem)] leading-[1.1] font-semibold tracking-[-0.03em] text-balance text-white">
            {PROMISE.title}
          </p>
          <p className="mt-2 text-[clamp(0.95rem,2.6vw,1.1rem)] text-white/85">
            {PROMISE.text}
          </p>
        </div>
      </section>

      {/* ---------------- Le formulaire ---------------- */}
      <section className="animate-panel-in relative -mt-5 flex flex-1 flex-col rounded-t-3xl bg-background px-6 pt-7 sm:px-8 lg:mt-0 lg:justify-center lg:rounded-none lg:px-14 lg:py-12">
        <div
          className="mx-auto w-full max-w-[28.75rem] lg:mx-0"
          style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
        >
          <p className="text-[0.78rem] font-semibold tracking-[0.12em] text-primary uppercase">
            {label}
          </p>
          <h1 className="mt-2 text-[clamp(1.6rem,5.6vw,2.1rem)] leading-[1.12] font-semibold tracking-[-0.03em] text-balance text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="mt-2.5 text-[0.98rem] leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}

          {!isSupabaseConfigured ? (
            <p className="mt-5 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Mode démo : l&apos;authentification est désactivée tant que les clés
              Supabase ne sont pas renseignées.
            </p>
          ) : null}

          <div className="mt-7">{children}</div>

          {footer ? <div className="mt-6">{footer}</div> : null}
        </div>
      </section>
    </div>
  );
}
