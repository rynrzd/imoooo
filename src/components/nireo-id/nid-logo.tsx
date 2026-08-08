import Link from "next/link";
import { cn } from "@/lib/utils";

interface NidLogoProps {
  href?: string;
  className?: string;
  /** Taille compacte pour les barres de navigation denses. */
  size?: "sm" | "md";
}

/**
 * Logo produit : le mot-symbole Nireo reste inchangé, « ID » est ajouté
 * dans une capsule sobre — un produit de la marque, pas une marque à part.
 */
export function NidLogo({ href = "/id", className, size = "md" }: NidLogoProps) {
  const content = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "font-semibold tracking-[-0.03em] text-foreground",
          size === "sm" ? "text-[15px]" : "text-lg"
        )}
      >
        Nireo
      </span>
      <span
        className={cn(
          "rounded-md bg-accent font-semibold tracking-wide text-accent-foreground",
          size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"
        )}
      >
        ID
      </span>
    </span>
  );

  if (!href) return content;
  return (
    <Link
      href={href}
      aria-label="Nireo ID — accueil"
      className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {content}
    </Link>
  );
}
