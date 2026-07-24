import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MarketingSupports } from "@/components/admin/marketing/marketing-supports";
import { generateQrDataUrl } from "@/lib/marketing/qr";
import { buildPartnerLink } from "@/lib/marketing/referral";
import type { MarketingPartnerRow } from "@/lib/marketing/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Supports marketing" };
export const dynamic = "force-dynamic";

const SELECT_CLASS =
  "h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none transition-colors " +
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40";

/** /admin/marketing/supports — génère cartes, flyers, affiches, QR pour un partenaire. */
export default async function SupportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const selectedId = typeof params.partenaire === "string" ? params.partenaire : "";

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("marketing_partners")
    .select("id, name, referral_slug")
    .order("name");
  if (error) throw new Error(`Lecture des partenaires impossible : ${error.message}`);
  const partners = (data ?? []) as Pick<MarketingPartnerRow, "id" | "name" | "referral_slug">[];

  const partner = partners.find((p) => p.id === selectedId) ?? partners[0] ?? null;
  const link = partner ? buildPartnerLink(partner.referral_slug) : "";
  const qrDataUrl = partner ? await generateQrDataUrl(link, 1024) : "";

  return (
    <div className="animate-page-in space-y-6">
      <div>
        <Link href="/admin/marketing" className="mb-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Tableau de bord marketing
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Supports marketing</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Supports imprimables prêts à distribuer : carte de visite, flyer A5, affichage comptoir,
          affiche A4 et QR seul. Le QR encode le lien unique du partenaire (vérifié) — propre et haute
          résolution.
        </p>
      </div>

      {partners.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Aucun partenaire pour l’instant.{" "}
            <Link href="/admin/marketing/partenaires" className="text-primary hover:underline">
              Créez un partenaire
            </Link>{" "}
            pour générer ses supports.
          </p>
        </div>
      ) : (
        <>
          <form className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/60 p-3" action="/admin/marketing/supports" method="get">
            <label className="text-sm text-muted-foreground">Partenaire</label>
            <select name="partenaire" defaultValue={partner?.id} className={SELECT_CLASS}>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button type="submit" className="h-9 rounded-lg border border-border bg-card px-3 text-sm hover:bg-muted">
              Afficher
            </button>
          </form>

          {partner ? (
            <MarketingSupports partnerName={partner.name} shortLink={link} qrDataUrl={qrDataUrl} />
          ) : null}
        </>
      )}
    </div>
  );
}
