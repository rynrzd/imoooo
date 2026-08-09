import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TransferForm } from "@/components/nireo-id/transfer-form";
import { formatDateTime } from "@/features/nireo-id/format";
import { getAssetDetail } from "@/features/nireo-id/server/assets";
import { requireNidSession } from "@/features/nireo-id/server/guards";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Transférer un téléphone",
  robots: { index: false, follow: false },
};

export default async function TransferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireNidSession(`/id/app/objets/${id}/transfert`);

  const detail = await getAssetDetail(id);
  if (!detail) notFound();

  const label = `${detail.asset.brand} ${detail.asset.model}`;

  return (
    <div className="space-y-5">
      <p className="text-sm">
        <Link
          href={`/id/app/objets/${id}`}
          className="text-muted-foreground underline-offset-2 hover:underline"
        >
          ← {label}
        </Link>
      </p>

      <div>
        <h1 className="text-2xl font-semibold text-foreground">Transférer ce téléphone</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          L’acheteur reçoit l’historique de l’appareil. Vous conservez un reçu
          de transfert, sans accès à ses futures données.
        </p>
      </div>

      {detail.pending_transfer ? (
        <div className="nid-panel space-y-3 rounded-2xl p-5">
          <h2 className="text-base font-semibold text-foreground">Transfert déjà en cours</h2>
          <p className="text-sm text-muted-foreground">
            Une demande est ouverte vers{" "}
            <strong className="text-foreground">
              {detail.pending_transfer.recipient_email}
            </strong>{" "}
            jusqu’au {formatDateTime(detail.pending_transfer.expires_at)}. Un
            seul transfert peut être actif à la fois : annulez-le pour en
            ouvrir un autre.
          </p>
          <Button variant="outline" render={<Link href="/id/app/transferts" />}>
            Gérer mes transferts
          </Button>
        </div>
      ) : detail.asset.status === "archived" ? (
        <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Ce téléphone est archivé. Réactivez-le depuis la page « Modifier »
          avant de le transférer.
        </p>
      ) : (
        <TransferForm
          assetId={id}
          deviceLabel={label}
          documents={detail.documents.filter(
            (document) => document.status === "actif" && document.visible_to_owner
          )}
        />
      )}
    </div>
  );
}
