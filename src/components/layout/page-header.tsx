interface PageHeaderProps {
  title: string;
  description?: string;
  /** Contenu affiché au-dessus du titre (fil d'Ariane, retour…). */
  eyebrow?: React.ReactNode;
  /** Actions affichées à droite (boutons, filtres…). */
  children?: React.ReactNode;
}

/** En-tête standard de page : titre, description, actions. */
export function PageHeader({ title, description, eyebrow, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        {eyebrow}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}
