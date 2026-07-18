import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChartCardProps {
  title: string;
  description?: string;
  /** Légende ou filtre affiché sous le titre. */
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}

/** Carte standard qui héberge un graphique. */
export function ChartCard({ title, description, toolbar, children }: ChartCardProps) {
  return (
    <Card>
      <CardHeader className="space-y-1.5">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
        {toolbar}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
