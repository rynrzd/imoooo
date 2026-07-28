import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Marque Nireo pour la vitrine — monogramme géométrique dessiné à la main
 * (aucune icône générique). Le « N » ascendant évoque la progression du
 * patrimoine ; le socle discret, la pierre / le bien immobilier.
 * Réservé aux pages publiques : la marque de l'application reste inchangée.
 */
export function NireoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-[0.7rem]",
        "bg-gradient-to-br from-white to-[oklch(0.965_0.014_162)] ring-1 ring-[oklch(0.52_0.113_162/0.28)]",
        "shadow-[0_1px_0_0_rgba(255,255,255,0.9)_inset,0_10px_24px_-14px_oklch(0.52_0.113_162/0.55)]",
        className
      )}
    >
      {/* Halo interne émeraude */}
      <span
        aria-hidden
        className="absolute -inset-2 bg-[radial-gradient(60%_60%_at_30%_20%,var(--nireo-glow-a),transparent_70%)] opacity-30"
      />
      <svg viewBox="0 0 24 24" className="relative size-5" fill="none" aria-hidden>
        <defs>
          <linearGradient id="nireo-mark" x1="4" y1="20" x2="20" y2="4" gradientUnits="userSpaceOnUse">
            <stop stopColor="oklch(0.45 0.128 162)" />
            <stop offset="0.55" stopColor="oklch(0.52 0.113 162)" />
            <stop offset="1" stopColor="oklch(0.58 0.1 190)" />
          </linearGradient>
        </defs>
        {/* N ascendant — la progression du patrimoine */}
        <path
          d="M5 18.5V6.5M5 6.5L19 18.5M19 18.5V6.5"
          stroke="url(#nireo-mark)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Socle / pierre */}
        <path d="M4 21h16" stroke="url(#nireo-mark)" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
      </svg>
    </span>
  );
}

export function NireoLogo({
  className,
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      aria-label="Nireo — accueil"
      className={cn("group flex items-center gap-2.5", className)}
    >
      <NireoMark className="transition-transform duration-300 group-hover:scale-[1.04]" />
      <span className="text-[1.05rem] font-semibold tracking-[-0.03em] text-foreground">
        Nireo
      </span>
    </Link>
  );
}
