import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventForm } from "@/components/nireo-id/event-form";
import { getAssetDetail } from "@/features/nireo-id/server/assets";
import { requireNidSession } from "@/features/nireo-id/server/guards";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ajouter un événement",
  robots: { index: false, follow: false },
};

export default async function AddEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireNidSession(`/id/app/objets/${id}/evenement`);

  const detail = await getAssetDetail(id);
  if (!detail) notFound();

  if (detail.asset.status === "archived") {
    return (
      <div className="space-y-4">
        <p className="text-sm">
          <Link
            href={`/id/app/objets/${id}`}
            className="text-muted-foreground underline-offset-2 hover:underline"
          >
            ← Retour au téléphone
          </Link>
        </p>
        <p className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
          Ce téléphone est archivé : réactivez-le depuis la page « Modifier »
          pour enrichir son historique.
        </p>
      </div>
    );
  }

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
        <h1 className="text-2xl font-semibold text-foreground">Ajouter un événement</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cet événement sera enregistré comme déclaré par vous. Pour une
          intervention validée, invitez un réparateur approuvé depuis l’onglet
          Accès.
        </p>
      </div>
      <EventForm assetId={id} />
    </div>
  );
}
