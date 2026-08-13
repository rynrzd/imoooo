"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SOUS-PAGES DU PROFIL — une page = un sujet.
 *
 * Le hub Profil ne contient AUCUN formulaire : chaque ligne ouvre une page
 * dédiée qui ne parle que d'une chose. C'est ce qui remplace les sept onglets
 * de l'ancien écran Paramètres, où tout cohabitait derrière une barre qui
 * débordait sur téléphone.
 */
export function SettingsPageShell({
  title,
  description,
  children,
  backHref = "/profil",
  backLabel = "Profil",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="nireo-form mx-auto w-full max-w-xl">
      <Link
        href={backHref}
        className="-ml-2 mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {backLabel}
      </Link>

      <div className="space-y-1.5 pb-6">
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>

      <div className="space-y-8">{children}</div>
    </div>
  );
}

/** Bloc thématique d'une sous-page : un intertitre, puis son contenu. */
export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold tracking-[0.02em] text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Listes de navigation du hub                                        */
/* ------------------------------------------------------------------ */

/** Intertitre d'un groupe du hub (« VOTRE COMPTE », « VOS DONNÉES »). */
export function SettingsGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1">
      <h2 className="px-1 pb-1 text-[0.7rem] font-semibold tracking-[0.08em] text-primary uppercase">
        {label}
      </h2>
      <ul className="divide-y divide-border">{children}</ul>
    </section>
  );
}

/**
 * Une ligne du hub : icône sobre, libellé, précision, chevron. Aucune carte,
 * aucune ombre — un simple filet sépare les lignes, exactement comme la
 * maquette.
 */
export function SettingsRow({
  href,
  icon: Icon,
  label,
  detail,
  onClick,
  tone = "default",
}: {
  href?: string;
  icon: LucideIcon;
  label: string;
  detail?: string;
  onClick?: () => void;
  tone?: "default" | "danger";
}) {
  const body = (
    <>
      <Icon
        className={cn(
          "size-5 shrink-0",
          tone === "danger" ? "text-danger" : "text-foreground"
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[0.95rem]",
            tone === "danger" ? "text-danger" : "text-foreground"
          )}
        >
          {label}
        </span>
        {detail ? (
          <span className="block truncate text-xs text-muted-foreground">
            {detail}
          </span>
        ) : null}
      </span>
      {href ? (
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground/60"
          aria-hidden
        />
      ) : null}
    </>
  );

  const shared =
    "flex min-h-14 w-full items-center gap-3.5 rounded-lg px-1 py-2.5 text-left transition-colors duration-200 hover:bg-accent/50";

  return (
    <li>
      {href ? (
        <Link href={href} className={shared}>
          {body}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={shared}>
          {body}
        </button>
      )}
    </li>
  );
}
