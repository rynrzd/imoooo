import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { CompanyEditor } from "@/components/admin/company-editor";
import { VitrineLink } from "@/components/admin/vitrine-link";
import { saveCompanyProfile } from "@/lib/admin/actions/company";
import { getCompanyProfile } from "@/lib/admin/company";
import { SITE_URL } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Présentation de l'entreprise" };
export const dynamic = "force-dynamic";

/**
 * /admin/entreprise — CMS de la vitrine officielle de Nireo.
 * Tout le contenu de la page publique /entreprise se pilote ici, sans code.
 */
export default async function AdminCompanyPage() {
  const profile = await getCompanyProfile();
  // Lien PUBLIC de la vitrine (accessible sans connexion), à partager.
  const vitrineUrl = `${SITE_URL.replace(/\/$/, "")}/entreprise`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Présentation de l’entreprise</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            La vitrine officielle de Nireo. Chaque section vide est automatiquement
            masquée sur la page publique. Modifications appliquées en direct, sans
            toucher au code — chaque enregistrement est journalisé dans l’audit.
          </p>
        </div>
        <Link
          href="/entreprise"
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Voir la vitrine <ExternalLink className="size-3.5" />
        </Link>
      </div>

      {/* Lien public partageable de la vitrine. */}
      <VitrineLink url={vitrineUrl} />

      <CompanyEditor initial={profile} action={saveCompanyProfile} />
    </div>
  );
}
