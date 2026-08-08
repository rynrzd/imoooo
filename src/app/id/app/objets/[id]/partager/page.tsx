import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShareForm } from "@/components/nireo-id/share-form";
import { getAssetDetail } from "@/features/nireo-id/server/assets";
import { requireNidSession } from "@/features/nireo-id/server/guards";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Partager un passeport",
  robots: { index: false, follow: false },
};

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireNidSession(`/id/app/objets/${id}/partager`);

  const detail = await getAssetDetail(id);
  if (!detail) notFound();

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
        <h1 className="text-2xl font-semibold text-foreground">Partager ce passeport</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vous choisissez ce qui est visible, pour combien de temps, et vous
          pouvez couper l’accès à tout moment.
        </p>
      </div>

      <ShareForm
        assetId={id}
        documents={detail.documents.filter((document) => document.status === "actif")}
        hasSerial={Boolean(detail.asset.serial_last4)}
      />
    </div>
  );
}
