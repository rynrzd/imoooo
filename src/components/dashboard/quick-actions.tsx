"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  Camera,
  FileText,
  Hammer,
  Receipt,
  UserPlus,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddDocumentDialog } from "@/components/documents/add-document-dialog";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
import { AddPhotoDialog } from "@/components/photos/add-photo-dialog";
import { PropertyWizard } from "@/components/properties/property-wizard";
import { AddTenantDialog } from "@/components/tenants/add-tenant-dialog";
import { AddWorkDialog } from "@/components/works/add-work-dialog";

type DialogKind = "property" | "tenant" | "expense" | "document" | "photo" | "work";

interface QuickAction {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Ouvre le vrai formulaire correspondant… */
  dialog?: DialogKind;
  /** …ou navigue vers la page dédiée (encaissement : échéance existante). */
  href?: string;
}

const ACTIONS: QuickAction[] = [
  {
    title: "Nouveau logement",
    description: "Étendre votre patrimoine",
    icon: Building2,
    dialog: "property",
  },
  {
    title: "Nouveau locataire",
    description: "Créer le bail sur un logement",
    icon: UserPlus,
    dialog: "tenant",
  },
  {
    title: "Encaisser un loyer",
    description: "Enregistrer un paiement reçu",
    icon: Wallet,
    href: "/loyers",
  },
  {
    title: "Nouveau document",
    description: "Bail, diagnostic, facture…",
    icon: FileText,
    dialog: "document",
  },
  {
    title: "Nouvelle dépense",
    description: "Charge, taxe, assurance…",
    icon: Receipt,
    dialog: "expense",
  },
  {
    title: "Nouveaux travaux",
    description: "Chantier ou réparation",
    icon: Hammer,
    dialog: "work",
  },
  {
    title: "Nouvelles photos",
    description: "État des lieux, chantier…",
    icon: Camera,
    dialog: "photo",
  },
];

const TILE_CLASS =
  "group flex w-full items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:border-border hover:bg-muted/60";

function TileContent({ action }: { action: QuickAction }) {
  return (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground/70 shadow-xs transition-colors group-hover:text-foreground">
        <action.icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">
          {action.title}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {action.description}
        </span>
      </span>
    </>
  );
}

/** Actions rapides : chaque tuile ouvre le VRAI formulaire (aucun faux bouton). */
export function QuickActions() {
  const [dialog, setDialog] = React.useState<DialogKind | null>(null);
  const close = (open: boolean) => {
    if (!open) setDialog(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Actions rapides</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-1">
        {ACTIONS.map((action) =>
          action.href ? (
            <Link key={action.title} href={action.href} className={TILE_CLASS}>
              <TileContent action={action} />
            </Link>
          ) : (
            <button
              key={action.title}
              type="button"
              onClick={() => setDialog(action.dialog ?? null)}
              className={TILE_CLASS}
            >
              <TileContent action={action} />
            </button>
          )
        )}
      </CardContent>

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
    </Card>
  );
}
