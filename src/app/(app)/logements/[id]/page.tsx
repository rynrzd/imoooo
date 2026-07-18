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
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentLibrary } from "@/components/documents/document-library";
import { AddPhotoDialog } from "@/components/photos/add-photo-dialog";
import { PhotoGallery } from "@/components/photos/photo-gallery";
import { PropertyFinancesTab } from "@/components/properties/property-finances-tab";
import { PropertyHeader } from "@/components/properties/property-header";
import { PropertyOverview } from "@/components/properties/property-overview";
import { PropertyRentsTab } from "@/components/properties/property-rents-tab";
import { TenantLeaseTab } from "@/components/properties/tenant-lease-tab";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { DropZone } from "@/components/shared/drop-zone";
import { EmptyState } from "@/components/shared/empty-state";
import { useAppStore } from "@/lib/store";

const TAB_VALUES = new Set([
  "overview",
  "tenant",
  "rents",
  "documents",
  "photos",
  "finances",
  "history",
]);

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
  const tabParam = rawTab === "works" ? "finances" : rawTab;
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
        <Button variant="ghost" size="sm" render={<Link href="/logements" />}>
          <ArrowLeft data-icon="inline-start" />
          Retour aux logements
        </Button>

        <PropertyHeader property={property} />
      </div>

      <Tabs defaultValue={initialTab}>
        <div className="overflow-x-auto">
          <TabsList
            variant="line"
            className="w-max min-w-full justify-start border-b border-border"
          >
            <TabsTrigger value="overview">
              <LayoutGrid data-icon="inline-start" />
              Vue d&apos;ensemble
            </TabsTrigger>
            <TabsTrigger value="tenant">
              <UserRound data-icon="inline-start" />
              Locataire et bail
            </TabsTrigger>
            <TabsTrigger value="rents">
              <Wallet data-icon="inline-start" />
              Loyers
              <TabCount value={payments.length} />
            </TabsTrigger>
            <TabsTrigger value="documents">
              <FileText data-icon="inline-start" />
              Documents
              <TabCount value={documents.length} />
            </TabsTrigger>
            <TabsTrigger value="photos">
              <Camera data-icon="inline-start" />
              Photos
              <TabCount value={photos.length} />
            </TabsTrigger>
            <TabsTrigger value="finances">
              <Receipt data-icon="inline-start" />
              Dépenses et travaux
              <TabCount value={works.length + expenses.length} />
            </TabsTrigger>
            <TabsTrigger value="history">
              <History data-icon="inline-start" />
              Historique
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="animate-panel-in pt-4">
          <PropertyOverview property={property} />
        </TabsContent>

        <TabsContent value="tenant" className="animate-panel-in pt-4">
          <TenantLeaseTab property={property} />
        </TabsContent>

        <TabsContent value="rents" className="animate-panel-in pt-4">
          <PropertyRentsTab property={property} />
        </TabsContent>

        <TabsContent value="documents" className="animate-panel-in pt-4">
          <DocumentLibrary propertyId={property.id} />
        </TabsContent>

        <TabsContent value="photos" className="animate-panel-in space-y-4 pt-4">
          <DropZone
            label="Glissez-déposez une photo du logement"
            hint="ou cliquez pour choisir — elle sera classée dans la médiathèque du bien"
            accept="image/*"
            onFile={setDroppedPhoto}
          />
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
        </TabsContent>

        <TabsContent value="finances" className="animate-panel-in pt-4">
          <PropertyFinancesTab property={property} />
        </TabsContent>

        <TabsContent value="history" className="animate-panel-in space-y-4 pt-4">
          {history.length > 0 ? (
            <RecentActivity items={history} limit={30} />
          ) : (
            <EmptyState
              icon={History}
              title="Aucun événement"
              description="Paiements, documents, photos, travaux : chaque action sur ce logement apparaîtra ici."
            />
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
