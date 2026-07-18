"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField } from "@/components/shared/form-field";
import { DOCUMENT_CATEGORY_LABELS, toOptions } from "@/lib/labels";
import { useAppStore } from "@/lib/store";
import type { PropertyDocument } from "@/lib/types";

const schema = z.object({
  name: z.string().min(2, "Nom requis."),
  category: z.enum([
    "bail",
    "etat_des_lieux",
    "assurance",
    "diagnostics",
    "factures",
    "garanties",
    "autres",
  ]),
  expiresAt: z
    .string()
    .optional()
    .transform((v) => (v ? v : null)),
});

type FormValues = z.input<typeof schema>;
type ParsedValues = z.output<typeof schema>;

/** Renommage, reclassement et date d'expiration d'un document. */
export function EditDocumentDialog({ document }: { document: PropertyDocument }) {
  const { updateDocument } = useAppStore();
  const [open, setOpen] = React.useState(false);

  const defaults: FormValues = {
    name: document.name,
    category: document.category,
    expiresAt: document.expiresAt ?? "",
  };

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues, unknown, ParsedValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateDocument(document.id, values);
      toast.success("Document mis à jour.");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Mise à jour impossible.");
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset(defaults);
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Modifier ${document.name}`}
          />
        }
      >
        <Pencil />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Modifier le document</DialogTitle>
          <DialogDescription>
            Renommez, reclassez ou définissez une date d&apos;expiration
            (assurance, diagnostics…).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label="Nom" htmlFor="doc-edit-name" error={errors.name?.message}>
            <Input id="doc-edit-name" {...register("name")} />
          </FormField>
          <FormField label="Catégorie" htmlFor="doc-edit-category" error={errors.category?.message}>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="doc-edit-category" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {toOptions(DOCUMENT_CATEGORY_LABELS).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label="Date d'expiration (optionnel)" htmlFor="doc-edit-expiry">
            <Input id="doc-edit-expiry" type="date" {...register("expiresAt")} />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
