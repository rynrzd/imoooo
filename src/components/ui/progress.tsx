import { cn } from "@/lib/utils";

interface ProgressProps {
  /** Valeur entre 0 et 100. */
  value: number;
  className?: string;
  /** Classe de la barre remplie (couleur d'état). */
  indicatorClassName?: string;
  "aria-label"?: string;
}

/** Barre de progression sobre, animée à l'affichage. */
export function Progress({
  value,
  className,
  indicatorClassName,
  ...props
}: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      {...props}
    >
      <div
        className={cn(
          "h-full rounded-full bg-foreground transition-[width] duration-500 ease-out",
          indicatorClassName
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
