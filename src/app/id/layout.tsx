import type { Metadata } from "next";
import { SITE_URL } from "@/lib/supabase/config";

/**
 * Segment /id — Nireo ID.
 *
 * Second produit de la marque Nireo, isolé de Nireo Immo : la classe
 * `.nid` applique sa propre palette (claire par défaut, sombre suivant le
 * thème de l'utilisateur) sans jamais affecter les autres routes.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Nireo ID — L’historique suit l’objet, pas le propriétaire",
    template: "%s · Nireo ID",
  },
  description:
    "Créez le passeport numérique de votre smartphone : documents, état, réparations et transmission de l’historique lors de la revente.",
};

export default function NireoIdLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="nid min-h-svh bg-background text-foreground">{children}</div>;
}
