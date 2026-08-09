import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssetList } from "@/components/nireo-id/asset-list";
import { listAssets } from "@/features/nireo-id/server/assets";
import { requireNidSession } from "@/features/nireo-id/server/guards";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Mes téléphones" };

export default async function NireoIdPhonesPage() {
  await requireNidSession("/id/app/telephones");
  const assets = await listAssets();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Mes téléphones</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {assets.length === 0
              ? "Aucun téléphone pour le moment."
              : assets.length === 1
                ? "1 téléphone suivi."
                : `${assets.length} téléphones suivis.`}
          </p>
        </div>
        <Button data-touch render={<Link href="/id/app/objets/nouveau" />}>
          <Plus className="size-4" data-icon="inline-start" />
          Ajouter mon téléphone
        </Button>
      </header>

      {assets.length === 0 ? (
        <section className="nid-panel rounded-2xl px-6 py-12 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent text-accent-foreground">
            <Smartphone className="size-7" aria-hidden />
          </span>
          <h2 className="mt-5 text-lg font-semibold text-foreground">
            Ajoutez votre premier téléphone
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Conservez sa facture, suivez son état et retrouvez ses réparations.
          </p>
          <div className="mt-6">
            <Button data-touch render={<Link href="/id/app/objets/nouveau" />}>
              Ajouter mon téléphone
            </Button>
          </div>
        </section>
      ) : (
        <AssetList items={assets} />
      )}
    </div>
  );
}
