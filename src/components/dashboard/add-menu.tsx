"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  Camera,
  ChevronDown,
  FileText,
  Hammer,
  Plus,
  Receipt,
  UserPlus,
  Wallet,
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
import { PropertyWizard } from "@/components/properties/property-wizard";
import { AddTenantDialog } from "@/components/tenants/add-tenant-dialog";
import { AddWorkDialog } from "@/components/works/add-work-dialog";

type DialogKind = "property" | "tenant" | "work" | "expense" | "document" | "photo";

/** Action principale du cockpit : menu « Ajouter » ouvrant les vrais dialogues. */
export function AddMenu() {
  const [dialog, setDialog] = React.useState<DialogKind | null>(null);
  const close = (open: boolean) => {
    if (!open) setDialog(null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button />}>
          <Plus data-icon="inline-start" />
          Ajouter
          <ChevronDown data-icon="inline-end" className="opacity-70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onClick={() => setDialog("property")}>
            <Building2 />
            Logement
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("tenant")}>
            <UserPlus />
            Locataire
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("work")}>
            <Hammer />
            Travaux
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("expense")}>
            <Receipt />
            Dépense
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("document")}>
            <FileText />
            Document
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("photo")}>
            <Camera />
            Photo
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/loyers" />}>
            <Wallet />
            Encaisser un loyer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogues contrôlés, montés uniquement à l'ouverture (aucun
          formulaire initialisé à vide en arrière-plan). */}
      {dialog === "property" ? (
        <PropertyWizard showTrigger={false} open onOpenChange={close} />
      ) : null}
      {dialog === "tenant" ? (
        <AddTenantDialog showTrigger={false} open onOpenChange={close} />
      ) : null}
      {dialog === "work" ? (
        <AddWorkDialog showTrigger={false} open onOpenChange={close} />
      ) : null}
      {dialog === "expense" ? (
        <AddExpenseDialog showTrigger={false} open onOpenChange={close} />
      ) : null}
      {dialog === "document" ? (
        <AddDocumentDialog showTrigger={false} open onOpenChange={close} />
      ) : null}
      {dialog === "photo" ? (
        <AddPhotoDialog showTrigger={false} open onOpenChange={close} />
      ) : null}
    </>
  );
}
