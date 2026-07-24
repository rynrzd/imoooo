import { Sparkles } from "lucide-react";

/**
 * Bannière marketing pilotée depuis l'admin (P6) — présentation pure,
 * utilisable côté serveur ET client. Ne s'affiche que si elle est activée
 * et porte un contenu. Le type est décrit localement pour rester découplé
 * des modules serveur (settings).
 */
export interface PromoBannerData {
  enabled: boolean;
  title: string;
  subtitle: string;
  message: string;
  code: string;
}

export function PromoBanner({
  promo,
  className,
}: {
  promo: PromoBannerData | null | undefined;
  className?: string;
}) {
  if (!promo || !promo.enabled) return null;
  const hasContent = promo.title || promo.subtitle || promo.message || promo.code;
  if (!hasContent) return null;

  return (
    <div
      className={
        "rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5" +
        (className ? ` ${className}` : "")
      }
    >
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="space-y-1">
          {promo.title ? (
            <p className="font-semibold text-foreground">{promo.title}</p>
          ) : null}
          {promo.subtitle ? (
            <p className="text-sm text-muted-foreground">{promo.subtitle}</p>
          ) : null}
          {promo.message ? <p className="text-sm text-foreground">{promo.message}</p> : null}
          {promo.code ? (
            <p className="pt-1 text-sm text-foreground">
              Code :{" "}
              <span className="rounded-md bg-primary/15 px-2 py-0.5 font-mono font-semibold text-primary">
                {promo.code}
              </span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
