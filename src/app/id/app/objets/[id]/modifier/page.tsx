import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AssetSettings } from "@/components/nireo-id/asset-settings";
import { getAssetDetail } from "@/features/nireo-id/server/assets";
import { requireNidSession } from "@/features/nireo-id/server/guards";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Modifier un passeport",
  robots: { index: false, follow: false },
};

export default async function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireNidSession(`/id/app/objets/${id}/modifier`);

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

      <h1 className="text-2xl font-semibold text-foreground">Réglages du passeport</h1>

      <AssetSettings asset={detail.asset} />
    </div>
  );
}
