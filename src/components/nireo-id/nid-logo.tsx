import Link from "next/link";
import { cn } from "@/lib/utils";

interface NidLogoProps {
  href?: string;
  className?: string;
  /** Taille compacte pour les barres de navigation denses. */
  size?: "sm" | "md";
}

/**
 * Mot-symbole : « Nireo » à l'encre, « ID » en petites capitales espacées.
 * Aucune pastille colorée — un produit de la marque, pas un badge.
 */
export function NidLogo({ href = "/id", className, size = "md" }: NidLogoProps) {
  const content = (
    <span className={cn("inline-flex items-baseline gap-1.5", className)}>
      <span
        className={cn(
          "font-semibold tracking-[-0.015em] text-foreground",
          size === "sm" ? "text-[15px]" : "text-lg"
        )}
      >
        Nireo
      </span>
      <span
        className={cn(
          "font-medium tracking-[0.16em] text-primary uppercase",
          size === "sm" ? "text-[10px]" : "text-[11px]"
        )}
      >
        ID
      </span>
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} aria-label="Nireo ID — accueil" className="rounded-sm outline-none">
      {content}
    </Link>
  );
}
