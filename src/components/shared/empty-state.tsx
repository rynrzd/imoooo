import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Action optionnelle (bouton ou lien). */
  children?: React.ReactNode;
}

/**
 * ÉTAT VIDE — il dit ce qui manque, et ce que Nireo fera ensuite.
 *
 * Plus de grand cadre en pointillés au milieu de l'écran : une icône sobre
 * dans une pastille bleu très pâle, un titre à l'encre, une phrase, une
 * action. Le même vocabulaire que le reste de l'application — un écran vide
 * n'est pas un écran d'erreur, c'est un écran qui n'a pas encore servi.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: EmptyStateProps) {
  return (
    <section className="animate-panel-in space-y-5 py-8">
      <span
        aria-hidden
        className="grid size-12 place-items-center rounded-xl bg-primary-soft text-primary"
      >
        <Icon className="size-6" />
      </span>
      <div className="space-y-2">
        <p className="text-xl leading-tight font-semibold tracking-[-0.02em] text-foreground">
          {title}
        </p>
        <p className="max-w-md text-[0.95rem] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}
