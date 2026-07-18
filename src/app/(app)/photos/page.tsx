"use client";

import * as React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { AddPhotoDialog } from "@/components/photos/add-photo-dialog";
import { PhotoGallery } from "@/components/photos/photo-gallery";
import { DropZone } from "@/components/shared/drop-zone";
import { useAppStore } from "@/lib/store";

export default function PhotosPage() {
  const { data } = useAppStore();
  // Image déposée : ouvre le dialogue d'ajout pré-rempli.
  const [droppedFile, setDroppedFile] = React.useState<File | null>(null);

  return (
    <>
      <PageHeader
        title="Photos"
        description={`${data.photos.length} photo${data.photos.length > 1 ? "s" : ""} de vos logements`}
      >
        <AddPhotoDialog />
      </PageHeader>

      <DropZone
        label="Glissez-déposez une image ici"
        hint="ou cliquez pour choisir une image — elle sera classée par logement et catégorie"
        accept="image/*"
        onFile={setDroppedFile}
      />
      <AddPhotoDialog
        droppedFile={droppedFile}
        open={droppedFile !== null}
        onOpenChange={(open) => {
          if (!open) setDroppedFile(null);
        }}
        showTrigger={false}
      />

      <PhotoGallery photos={data.photos} showProperty />
    </>
  );
}
