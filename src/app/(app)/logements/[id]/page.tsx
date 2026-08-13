"use client";

import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  FileText,
  History,
  LayoutGrid,
  Receipt,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentLibrary } from "@/components/documents/document-library";
import { AddPhotoDialog } from "@/components/photos/add-photo-dialog";
import { PhotoGallery } from "@/components/photos/photo-gallery";
import { PropertyFinancesTab } from "@/components/properties/property-finances-tab";
import { PropertyHeader } from "@/components/properties/property-header";
import { PropertyOverview } from "@/components/properties/property-overview";
import { PropertySummary } from "@/components/properties/property-summary";
import { PropertyRentsTab } from "@/components/properties/property-rents-tab";
import { TenantLeaseTab } from "@/components/properties/tenant-lease-tab";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { DropZone } from "@/components/shared/drop-zone";
import { EmptyState } from "@/components/shared/empty-state";
import { useAppStore } from "@/lib/store";

/**
 * QUATRE sections, et rien d'autre : Aperçu, Location, Documents, Finances.
 *
 * La fiche en comptait sept, dans une barre d'onglets qui débordait de
 * l'écran sur téléphone. Aucune fonction n'a disparu, elles ont retrouvé leur
 * place : les loyers du bien sont dans Location (c'est le bail qui les
 * produit), les photos dans Documents, l'historique au bas de l'Aperçu.
 */
const TAB_VALUES = new Set(["overview", "location", "documents", "finances"]);

/** Anciennes ancres encore présentes dans des liens ou des favoris. */
const TAB_ALIASES: Record<string, string> = {
  tenant: "location",
  rents: "location",
  works: "finances",
  photos: "documents",
  history: "overview",
};

/** Pastille de compteur affichée dans les onglets. */
function TabCount({ value }: { value: number }) {
  if (value === 0) return null;
  return (
    <span className="rounded-full bg-muted px-1.5 py-px text-[11px] font-medium tabular-nums text-muted-foreground">
      {value}
    </span>
  );
}

export default function PropertyDetailPage({
  params,
  searchParams,
}: PageProps<"/logements/[id]">) {
  const { id } = React.use(params);
  // Onglet initial optionnel (ex. « Historique » depuis le portefeuille).
  const search = React.use(searchParams);
  const rawTab = typeof search.tab === "string" ? search.tab : "";
  const tabParam = TAB_ALIASES[rawTab] ?? rawTab;
  const initialTab = TAB_VALUES.has(tabParam) ? tabParam : "overview";
  const { data } = useAppStore();
  // Photo déposée dans l'onglet Photos.
  const [droppedPhoto, setDroppedPhoto] = React.useState<File | null>(null);

  const property = data.properties.find((p) => p.id === id);
  if (!property) notFound();

  const payments = data.rentPayments.filter((p) => p.propertyId === property.id);
  const documents = data.documents.filter((d) => d.propertyId === property.id);
  const photos = data.photos.filter((p) => p.propertyId === property.id);
  const works = data.works.filter((w) => w.propertyId === property.id);
  const expenses = data.expenses.filter((e) => e.propertyId === property.id);
  const history = data.activity.filter((a) => a.propertyId === property.id);

  return (
    <>
      <div className="space-y-4">
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/logements" />}>
          <ArrowLeft data-icon="inline-start" />
          Retour aux logements
        </Button>

        <PropertyHeader property={property} />
      </div>

      <Tabs defaultValue={initialTab}>
        {/* Quatre onglets qui tiennent sans défilement dès 320 px : au doigt
            les icônes disparaissent et les libellés se partagent la largeur —
            avec elles et les pastilles de comptage, la barre débordait de
            24 px sur un iPhone. */}
        <TabsList
          variant="line"
          className="w-full justify-start border-b border-border"
        >
          <TabsTrigger value="overview" className="flex-1 px-1 sm:flex-none sm:px-3">
            <LayoutGrid data-icon="inline-start" className="max-sm:hidden" />
            Aperçu
          </TabsTrigger>
          <TabsTrigger value="location" className="flex-1 px-1 sm:flex-none sm:px-3">
            <UserRound data-icon="inline-start" className="max-sm:hidden" />
            Location
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex-1 px-1 sm:flex-none sm:px-3">
            <FileText data-icon="inline-start" className="max-sm:hidden" />
            Documents
            <TabCount value={documents.length + photos.length} />
          </TabsTrigger>
          <TabsTrigger value="finances" className="flex-1 px-1 sm:flex-none sm:px-3">
            <Receipt data-icon="inline-start" className="max-sm:hidden" />
            Finances
            <TabCount value={works.length + expenses.length} />
          </TabsTrigger>
        </TabsList>

        {/* ---------------- Aperçu ---------------- */}
        <TabsContent value="overview" className="animate-panel-in space-y-5 pt-4">
          {/* Cinq lignes utiles sur téléphone… */}
          <div className="lg:hidden">
            <PropertySummary property={property} />
          </div>
          {/* …le tableau de bord complet du bien au-dessus de 1024 px. */}
          <div className="hidden lg:block">
            <PropertyOverview property={property} />
          </div>

          <section className="space-y-2 lg:hidden">
            <h2 className="text-sm font-medium text-foreground">Historique</h2>
            {history.length > 0 ? (
              <RecentActivity items={history} limit={8} />
            ) : (
              <EmptyState
                icon={History}
                title="Aucun événement"
                description="Paiements, documents, photos, travaux : chaque action sur ce logement apparaîtra ici."
              />
            )}
          </section>
        </TabsContent>

        {/* ---------------- Location (bail + loyers) ---------------- */}
        <TabsContent value="location" className="animate-panel-in space-y-6 pt-4">
          <TenantLeaseTab property={property} />
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-foreground">
              Loyers de ce logement
              {payments.length > 0 ? (
                <span className="ml-1 font-normal text-muted-foreground">
                  ({payments.length})
                </span>
              ) : null}
            </h2>
            <PropertyRentsTab property={property} />
          </section>
        </TabsContent>

        {/* ---------------- Documents (dossiers + photos) ---------------- */}
        <TabsContent value="documents" className="animate-panel-in space-y-6 pt-4">
          <DocumentLibrary propertyId={property.id} />

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Camera className="size-4 text-muted-foreground" aria-hidden />
                Photos
                <TabCount value={photos.length} />
              </h2>
              <AddPhotoDialog propertyId={property.id} />
            </div>
            {/* Le glisser-déposer n'a de sens qu'avec un pointeur : masqué au doigt. */}
            <div className="max-lg:hidden">
              <DropZone
                label="Glissez-déposez une photo du logement"
                hint="ou cliquez pour choisir — elle sera classée dans la médiathèque du bien"
                accept="image/*"
                onFile={setDroppedPhoto}
              />
            </div>
            <AddPhotoDialog
              propertyId={property.id}
              droppedFile={droppedPhoto}
              open={droppedPhoto !== null}
              onOpenChange={(open) => {
                if (!open) setDroppedPhoto(null);
              }}
              showTrigger={false}
            />
            <PhotoGallery photos={photos} property={property} />
          </section>
        </TabsContent>

        {/* ---------------- Finances (dépenses + travaux) ---------------- */}
        <TabsContent value="finances" className="animate-panel-in pt-4">
          <PropertyFinancesTab property={property} />
        </TabsContent>
      </Tabs>
    </>
  );
}
