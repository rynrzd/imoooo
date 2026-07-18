"use client";

import * as React from "react";
import Link from "next/link";
import {
  Camera,
  FileText,
  FolderOpen,
  Hammer,
  History,
  MoreHorizontal,
  Pencil,
  Receipt,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddDocumentDialog } from "@/components/documents/add-document-dialog";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
import { AddPhotoDialog } from "@/components/photos/add-photo-dialog";
import { AddTenantDialog } from "@/components/tenants/add-tenant-dialog";
import { AddWorkDialog } from "@/components/works/add-work-dialog";
import { EditPropertySheet } from "./edit-property-sheet";
import type { Property } from "@/lib/types";
import { cn } from "@/lib/utils";

type DialogKind = "edit" | "document" | "photo" | "work" | "expense" | "tenant";

interface PropertyActionsProps {
  property: Property;
  /** Style du déclencheur (chip sur photo ou bouton discret). */
  variant?: "overlay" | "ghost";
}

/** Menu d'actions rapides d'un logement — toutes les actions sont réelles. */
export function PropertyActions({ property, variant = "ghost" }: PropertyActionsProps) {
  const [dialog, setDialog] = React.useState<DialogKind | null>(null);
  const close = (open: boolean) => {
    if (!open) setDialog(null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant={variant === "overlay" ? "secondary" : "ghost"}
              size="icon-sm"
              aria-label={`Actions — ${property.name}`}
              className={cn(variant === "overlay" && "bg-background/90 shadow-xs")}
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem render={<Link href={`/logements/${property.id}`} />}>
            <FolderOpen />
            Ouvrir le dossier
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("edit")}>
            <Pencil />
            Modifier
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDialog("document")}>
            <FileText />
            Ajouter un document
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("photo")}>
            <Camera />
            Ajouter des photos
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("work")}>
            <Hammer />
            Ajouter des travaux
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("expense")}>
            <Receipt />
            Ajouter une dépense
          </DropdownMenuItem>
          {property.currentTenantId ? (
            <DropdownMenuItem
              render={<Link href={`/locataires/${property.currentTenantId}`} />}
            >
              <UserPlus />
              Dossier du locataire
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setDialog("tenant")}>
              <UserPlus />
              Ajouter un locataire
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            render={<Link href={`/logements/${property.id}?tab=history`} />}
          >
            <History />
            Historique
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogues contrôlés, montés à la demande. */}
      {dialog === "edit" ? (
        <EditPropertySheet property={property} showTrigger={false} open onOpenChange={close} />
      ) : null}
      {dialog === "document" ? (
        <AddDocumentDialog propertyId={property.id} showTrigger={false} open onOpenChange={close} />
      ) : null}
      {dialog === "photo" ? (
        <AddPhotoDialog propertyId={property.id} showTrigger={false} open onOpenChange={close} />
      ) : null}
      {dialog === "work" ? (
        <AddWorkDialog propertyId={property.id} showTrigger={false} open onOpenChange={close} />
      ) : null}
      {dialog === "expense" ? (
        <AddExpenseDialog propertyId={property.id} showTrigger={false} open onOpenChange={close} />
      ) : null}
      {dialog === "tenant" ? (
        <AddTenantDialog propertyId={property.id} showTrigger={false} open onOpenChange={close} />
      ) : null}
    </>
  );
}
