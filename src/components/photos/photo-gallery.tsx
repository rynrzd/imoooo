"use client";

import * as React from "react";
import Image from "next/image";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Search,
  Star,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationBar, usePagination } from "@/components/shared/pagination-bar";
import { needsUnoptimized } from "@/lib/constants";
import { getProperty } from "@/lib/finance";
import { formatDate } from "@/lib/format";
import { PHOTO_CATEGORY_LABELS } from "@/lib/labels";
import { useAppStore } from "@/lib/store";
import type { PhotoCategory, Property, PropertyPhoto } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PhotoGalleryProps {
  photos: PropertyPhoto[];
  /** Affiche le nom du logement sur chaque photo (vue globale). */
  showProperty?: boolean;
  /** Contexte logement : active « Définir comme photo principale ». */
  property?: Property;
}

const FILTERS: (PhotoCategory | "toutes")[] = [
  "toutes",
  "avant_location",
  "apres_travaux",
  "entree",
  "sortie",
  "dommages",
];

/**
 * Gestion photographique : filtres, recherche, visionneuse plein écran
 * avec zoom et navigation, comparaison avant / après.
 */
export function PhotoGallery({
  photos,
  showProperty = false,
  property,
}: PhotoGalleryProps) {
  const { data, deletePhoto, updateProperty } = useAppStore();
  const [filter, setFilter] = React.useState<PhotoCategory | "toutes">("toutes");
  const [query, setQuery] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  // Visionneuse : index dans la liste visible (null = fermée).
  const [viewerIndex, setViewerIndex] = React.useState<number | null>(null);
  const [zoomed, setZoomed] = React.useState(false);
  // Mode comparaison : sélection de deux photos.
  const [compareMode, setCompareMode] = React.useState(false);
  const [compareIds, setCompareIds] = React.useState<string[]>([]);
  const [compareOpen, setCompareOpen] = React.useState(false);
  // Suppression en deux temps : confirmation explicite.
  const [deleteTarget, setDeleteTarget] = React.useState<PropertyPhoto | null>(null);

  const setAsMainPhoto = async (photo: PropertyPhoto) => {
    if (!property) return;
    setBusyId(photo.id);
    try {
      await updateProperty(property.id, {
        name: property.name,
        address: property.address,
        postalCode: property.postalCode,
        city: property.city,
        type: property.type,
        surface: property.surface,
        rooms: property.rooms,
        purchasePrice: property.purchasePrice,
        purchaseDate: property.purchaseDate,
        rent: property.rent,
        charges: property.charges,
        status: property.status,
        photo: photo.url,
      });
      toast.success("Photo principale mise à jour.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Mise à jour impossible.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (photo: PropertyPhoto) => {
    setBusyId(photo.id);
    try {
      await deletePhoto(photo.id);
      setViewerIndex(null);
      setDeleteTarget(null);
      toast.success("Photo supprimée.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suppression impossible.");
    } finally {
      setBusyId(null);
    }
  };

  const visible = photos
    .filter((photo) => filter === "toutes" || photo.category === filter)
    .filter((photo) =>
      photo.caption.toLowerCase().includes(query.trim().toLowerCase())
    )
    .sort((a, b) => b.takenAt.localeCompare(a.takenAt));

  // Pagination : limite le nombre d'images (et d'URL signées affichées)
  // chargées d'un coup. La visionneuse navigue dans la page courante.
  const { pageItems, page, pageCount, setPage, total } = usePagination(visible, 24);

  const current = viewerIndex !== null ? pageItems[viewerIndex] : null;
  const comparePhotos = compareIds
    .map((id) => photos.find((p) => p.id === id))
    .filter((p): p is PropertyPhoto => Boolean(p));

  const openViewer = (index: number) => {
    setZoomed(false);
    setViewerIndex(index);
  };

  const step = (delta: number) => {
    if (viewerIndex === null || pageItems.length === 0) return;
    setZoomed(false);
    setViewerIndex((viewerIndex + delta + pageItems.length) % pageItems.length);
  };

  const toggleCompareSelection = (photoId: string) => {
    setCompareIds((prev) => {
      if (prev.includes(photoId)) return prev.filter((id) => id !== photoId);
      // Au-delà de deux photos, la sélection la plus ancienne est remplacée.
      return prev.length >= 2 ? [prev[1], photoId] : [...prev, photoId];
    });
  };

  return (
    <div className="space-y-4">
      {/* Barre d'outils : filtres, recherche, comparaison */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "secondary" : "ghost"}
              onClick={() => setFilter(value)}
            >
              {value === "toutes" ? "Toutes" : PHOTO_CATEGORY_LABELS[value]}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une photo…"
              className="pl-8"
              aria-label="Rechercher une photo"
            />
          </div>
          <Button
            size="sm"
            variant={compareMode ? "secondary" : "outline"}
            onClick={() => {
              setCompareMode((prev) => !prev);
              setCompareIds([]);
            }}
          >
            <Columns2 data-icon="inline-start" />
            Comparer
          </Button>
        </div>
      </div>

      {compareMode ? (
        <div className="animate-panel-in flex flex-col gap-3 rounded-xl border border-border bg-muted/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Sélectionnez deux photos à comparer (avant / après travaux, entrée /
            sortie…) — {compareIds.length} / 2 sélectionnée
            {compareIds.length > 1 ? "s" : ""}.
          </p>
          <Button
            size="sm"
            disabled={compareIds.length !== 2}
            onClick={() => setCompareOpen(true)}
          >
            Lancer la comparaison
          </Button>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="Aucune photo dans cette catégorie"
          description="Ajoutez des photos pour documenter l'état de vos logements."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pageItems.map((photo, index) => {
            const property = getProperty(data, photo.propertyId);
            const selected = compareIds.includes(photo.id);
            return (
              <figure
                key={photo.id}
                className={cn(
                  "group card-lift relative overflow-hidden rounded-xl border bg-card",
                  selected ? "border-foreground" : "border-border"
                )}
              >
                <button
                  type="button"
                  className="block w-full cursor-pointer text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  onClick={() =>
                    compareMode ? toggleCompareSelection(photo.id) : openViewer(index)
                  }
                  aria-label={
                    compareMode
                      ? `Sélectionner ${photo.caption} pour la comparaison`
                      : `Agrandir ${photo.caption}`
                  }
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    <Image
                      src={photo.url}
                      alt={photo.caption}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                      unoptimized={needsUnoptimized(photo.url)}
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                    <Badge
                      variant="secondary"
                      className="absolute top-2.5 left-2.5 bg-background/90"
                    >
                      {PHOTO_CATEGORY_LABELS[photo.category]}
                    </Badge>
                    {compareMode ? (
                      <span
                        className={cn(
                          "absolute top-2.5 right-2.5 flex size-6 items-center justify-center rounded-full border transition-colors",
                          selected
                            ? "border-foreground bg-foreground text-background"
                            : "border-white/70 bg-black/30 text-transparent"
                        )}
                        aria-hidden
                      >
                        <Check className="size-3.5" />
                      </span>
                    ) : null}
                  </div>
                  <figcaption className="space-y-0.5 p-3">
                    <p className="truncate text-sm font-medium text-foreground">
                      {photo.caption}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[showProperty ? property?.name : null, formatDate(photo.takenAt)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </figcaption>
                </button>
                {!compareMode ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Supprimer ${photo.caption}`}
                    className="absolute top-2 right-2 bg-background/90 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                    disabled={busyId === photo.id}
                    onClick={() => setDeleteTarget(photo)}
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </figure>
            );
          })}
        </div>
      )}
      <PaginationBar
        page={page}
        pageCount={pageCount}
        total={total}
        onPageChange={(p) => {
          setViewerIndex(null);
          setPage(p);
        }}
        label="photos"
      />

      {/* Visionneuse plein écran */}
      <Dialog
        open={current !== null}
        onOpenChange={(open) => {
          if (!open) setViewerIndex(null);
        }}
      >
        <DialogContent
          className="max-w-[min(96vw,1100px)] gap-3 bg-background p-3 sm:max-w-[min(96vw,1100px)]"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") step(1);
            if (e.key === "ArrowLeft") step(-1);
          }}
        >
          {current ? (
            <>
              <DialogTitle className="sr-only">{current.caption}</DialogTitle>
              <div
                className={cn(
                  "relative h-[70svh] overflow-hidden rounded-lg bg-black/95",
                  zoomed ? "cursor-zoom-out" : "cursor-zoom-in"
                )}
                onClick={() => setZoomed((z) => !z)}
              >
                <Image
                  src={current.url}
                  alt={current.caption}
                  fill
                  sizes="96vw"
                  unoptimized={needsUnoptimized(current.url)}
                  className={cn(
                    "object-contain transition-transform duration-300",
                    zoomed && "scale-[1.8]"
                  )}
                />
                {pageItems.length > 1 ? (
                  <>
                    <Button
                      variant="secondary"
                      size="icon"
                      aria-label="Photo précédente"
                      className="absolute top-1/2 left-3 -translate-y-1/2 bg-background/85"
                      onClick={(e) => {
                        e.stopPropagation();
                        step(-1);
                      }}
                    >
                      <ChevronLeft />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      aria-label="Photo suivante"
                      className="absolute top-1/2 right-3 -translate-y-1/2 bg-background/85"
                      onClick={(e) => {
                        e.stopPropagation();
                        step(1);
                      }}
                    >
                      <ChevronRight />
                    </Button>
                  </>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {current.caption}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[
                      PHOTO_CATEGORY_LABELS[current.category],
                      getProperty(data, current.propertyId)?.name,
                      formatDate(current.takenAt),
                      viewerIndex !== null
                        ? `${viewerIndex + 1} / ${pageItems.length}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {property ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === current.id || property.photo === current.url}
                      onClick={() => void setAsMainPhoto(current)}
                    >
                      <Star data-icon="inline-start" />
                      {property.photo === current.url
                        ? "Photo principale"
                        : "Définir comme principale"}
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setZoomed((z) => !z)}
                  >
                    {zoomed ? (
                      <ZoomOut data-icon="inline-start" />
                    ) : (
                      <ZoomIn data-icon="inline-start" />
                    )}
                    {zoomed ? "Réduire" : "Zoomer"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busyId === current.id}
                    onClick={() => setDeleteTarget(current)}
                  >
                    <Trash2 data-icon="inline-start" />
                    Supprimer
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Comparaison avant / après */}
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-[min(96vw,1100px)] gap-3 p-4 sm:max-w-[min(96vw,1100px)]">
          <DialogTitle className="text-base font-medium">
            Comparaison avant / après
          </DialogTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {comparePhotos.map((photo) => (
              <figure key={photo.id} className="space-y-2">
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                  <Image
                    src={photo.url}
                    alt={photo.caption}
                    fill
                    sizes="(max-width: 640px) 96vw, 48vw"
                    unoptimized={needsUnoptimized(photo.url)}
                    className="object-cover"
                  />
                  <Badge
                    variant="secondary"
                    className="absolute top-2.5 left-2.5 bg-background/90"
                  >
                    {PHOTO_CATEGORY_LABELS[photo.category]}
                  </Badge>
                </div>
                <figcaption className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{photo.caption}</span>
                  {" · "}
                  {formatDate(photo.takenAt)}
                </figcaption>
              </figure>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation de suppression d'une photo */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer cette photo ?</DialogTitle>
            <DialogDescription>
              « {deleteTarget?.caption} » sera définitivement supprimée
              {deleteTarget?.storagePath ? ", ainsi que son fichier" : ""}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteTarget !== null && busyId === deleteTarget.id}
              onClick={() => {
                if (deleteTarget) void handleDelete(deleteTarget);
              }}
            >
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
