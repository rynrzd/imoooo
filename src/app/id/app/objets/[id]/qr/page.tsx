import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Download, Printer, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAssetDetail } from "@/features/nireo-id/server/assets";
import { requireNidSession } from "@/features/nireo-id/server/guards";
import { publicUrl } from "@/features/nireo-id/server/sharing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "QR code du passeport",
  robots: { index: false, follow: false },
};

export default async function QrPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireNidSession(`/id/app/objets/${id}/qr`);

  const detail = await getAssetDetail(id);
  if (!detail) notFound();

  const target = publicUrl(detail.asset.public_id);
  // QR généré côté serveur à partir d'une URL construite par le serveur.
  const svg = await QRCode.toString(target, {
    type: "svg",
    margin: 1,
    width: 320,
    errorCorrectionLevel: "M",
  });

  return (
    <div className="space-y-5">
      <p className="text-sm">
        <Link
          href={`/id/app/objets/${id}`}
          className="text-muted-foreground underline-offset-2 hover:underline"
        >
          ← {detail.asset.brand} {detail.asset.model}
        </Link>
      </p>

      <div>
        <h1 className="text-2xl font-semibold text-foreground">QR code</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Deux usages différents : choisissez en connaissance de cause.
        </p>
      </div>

      <section className="nid-panel rounded-2xl p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-foreground">Aperçu public permanent</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ce QR pointe vers la page publique du passeport. Elle affiche
          uniquement la marque, le modèle, l’identifiant Nireo et des
          compteurs. Aucun document, aucun IMEI, aucune donnée personnelle.
        </p>

        <div className="mt-5 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div
            className="rounded-2xl border border-border bg-white p-3 [&_svg]:size-52"
            // Contenu produit par la bibliothèque QR à partir d'une URL
            // construite par le serveur : aucune entrée utilisateur.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <div className="min-w-0 flex-1 space-y-3">
            <p className="rounded-xl bg-muted px-3 py-2 text-xs break-all text-muted-foreground">
              {target}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                data-touch
                render={
                  <a href={`/api/nireo-id/qr?cible=public&objet=${id}&format=png`} download />
                }
              >
                <Download className="size-4" data-icon="inline-start" />
                PNG
              </Button>
              <Button
                variant="outline"
                data-touch
                render={
                  <a href={`/api/nireo-id/qr?cible=public&objet=${id}&format=svg`} download />
                }
              >
                <Download className="size-4" data-icon="inline-start" />
                SVG
              </Button>
              <Button
                variant="outline"
                data-touch
                render={<Link href={`/id/app/objets/${id}/qr/impression`} />}
              >
                <Printer className="size-4" data-icon="inline-start" />
                Vue imprimable
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="nid-panel rounded-2xl p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-foreground">Dossier partagé temporaire</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pour montrer l’état, l’historique ou une facture à un acheteur,
          créez un lien de partage : il expire, se révoque, et son QR code est
          téléchargeable au moment de sa création.
        </p>
        <div className="mt-4">
          <Button data-touch render={<Link href={`/id/app/objets/${id}/partager`} />}>
            <Share2 className="size-4" data-icon="inline-start" />
            Créer un lien de partage
          </Button>
        </div>
      </section>
    </div>
  );
}
