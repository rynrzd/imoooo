import { AlertTriangle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Brand } from "@/components/layout/brand";
import { isSupabaseConfigured } from "@/lib/supabase/config";

interface AuthShellProps {
  title: string;
  description: string;
  children: React.ReactNode;
  /** Liens secondaires sous la carte. */
  footer?: React.ReactNode;
}

/** Coquille commune des écrans d'authentification. */
export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 px-4 py-10">
      <Brand />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSupabaseConfigured ? (
            <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              Mode démo : Supabase n&apos;est pas configuré. Renseignez vos clés
              dans .env.local pour activer l&apos;authentification.
            </p>
          ) : null}
          {children}
        </CardContent>
      </Card>
      {footer ? (
        <div className="text-center text-sm text-muted-foreground">{footer}</div>
      ) : null}
    </div>
  );
}
