"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  archiveAssetAction,
  deleteAssetAction,
  updateAssetAction,
  updateVisibilityAction,
} from "@/features/nireo-id/actions/owner";
import {
  PURCHASE_CONDITIONS,
  PURCHASE_CONDITION_LABELS,
  type PurchaseCondition,
} from "@/features/nireo-id/constants";
import type { AssetRow } from "@/features/nireo-id/types";

/**
 * Réglages d'un passeport : caractéristiques, visibilité publique,
 * archivage et suppression. Chaque bouton déclenche une opération réelle
 * vérifiée côté serveur.
 */
export function AssetSettings({ asset }: { asset: AssetRow }) {
  const router = useRouter();
  const [values, setValues] = React.useState({
    brand: asset.brand,
    model: asset.model,
    color: asset.color,
    storage_capacity: asset.storage_capacity,
    purchase_date: asset.purchase_date ?? "",
    purchase_source: asset.purchase_source,
    purchase_condition: asset.purchase_condition,
  });
  const [visibility, setVisibility] = React.useState({
    public_show_photo: asset.public_show_photo,
    public_show_purchase_year: asset.public_show_purchase_year,
    public_show_serial_last4: asset.public_show_serial_last4,
  });
  const [savingInfo, setSavingInfo] = React.useState(false);
  const [savingVisibility, setSavingVisibility] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const saveInfo = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingInfo) return;
    setSavingInfo(true);
    const form = new FormData();
    form.set("asset_id", asset.id);
    for (const [key, value] of Object.entries(values)) form.set(key, value);
    const result = await updateAssetAction(form);
    setSavingInfo(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Caractéristiques enregistrées.");
    router.refresh();
  };

  const saveVisibility = async () => {
    if (savingVisibility) return;
    setSavingVisibility(true);
    const form = new FormData();
    form.set("asset_id", asset.id);
    form.set("public_show_photo", visibility.public_show_photo ? "true" : "false");
    form.set("public_show_purchase_year", visibility.public_show_purchase_year ? "true" : "false");
    form.set("public_show_serial_last4", visibility.public_show_serial_last4 ? "true" : "false");
    const result = await updateVisibilityAction(form);
    setSavingVisibility(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Visibilité publique mise à jour.");
    router.refresh();
  };

  const toggleArchive = async () => {
    if (busy) return;
    const archived = asset.status !== "archived";
    if (
      archived &&
      !window.confirm(
        "Archiver ce passeport ? Il sortira de votre liste active, ses liens de partage seront révoqués et son aperçu public ne sera plus consultable."
      )
    ) {
      return;
    }
    setBusy(true);
    const form = new FormData();
    form.set("asset_id", asset.id);
    form.set("archived", archived ? "true" : "false");
    const result = await archiveAssetAction(form);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(archived ? "Passeport archivé." : "Passeport réactivé.");
    router.refresh();
  };

  const remove = async () => {
    if (busy) return;
    if (
      !window.confirm(
        "Supprimer définitivement ce passeport, son historique, ses photos et ses documents ? Cette action est irréversible."
      )
    ) {
      return;
    }
    setBusy(true);
    const form = new FormData();
    form.set("asset_id", asset.id);
    const result = await deleteAssetAction(form);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Passeport supprimé.");
    router.push("/id/app");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={saveInfo} className="nid-panel space-y-4 rounded-2xl p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-foreground">Caractéristiques</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-brand">Marque</Label>
            <Input
              id="edit-brand"
              value={values.brand}
              onChange={(event) => setValues((c) => ({ ...c, brand: event.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-model">Modèle</Label>
            <Input
              id="edit-model"
              value={values.model}
              onChange={(event) => setValues((c) => ({ ...c, model: event.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-color">Couleur</Label>
            <Input
              id="edit-color"
              value={values.color}
              onChange={(event) => setValues((c) => ({ ...c, color: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-storage">Stockage</Label>
            <Input
              id="edit-storage"
              value={values.storage_capacity}
              onChange={(event) =>
                setValues((c) => ({ ...c, storage_capacity: event.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-date">Date d’achat</Label>
            <Input
              id="edit-date"
              type="date"
              value={values.purchase_date}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setValues((c) => ({ ...c, purchase_date: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-source">Vendeur ou enseigne</Label>
            <Input
              id="edit-source"
              value={values.purchase_source}
              onChange={(event) =>
                setValues((c) => ({ ...c, purchase_source: event.target.value }))
              }
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-condition">État à l’acquisition</Label>
          <select
            id="edit-condition"
            value={values.purchase_condition}
            onChange={(event) =>
              setValues((c) => ({
                ...c,
                purchase_condition: event.target.value as PurchaseCondition,
              }))
            }
            className="w-full rounded-xl border border-input bg-transparent text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {PURCHASE_CONDITIONS.map((value) => (
              <option key={value} value={value}>
                {PURCHASE_CONDITION_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <p className="text-xs text-muted-foreground">
          Le numéro de série et l’IMEI ne sont pas modifiables : ils
          identifient l’appareil et servent à détecter les doublons.
        </p>

        <Button type="submit" data-touch disabled={savingInfo}>
          {savingInfo ? (
            <>
              <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
              Enregistrement…
            </>
          ) : (
            <>
              <Save className="size-4" data-icon="inline-start" />
              Enregistrer
            </>
          )}
        </Button>
      </form>

      <section className="nid-panel space-y-4 rounded-2xl p-5 sm:p-6">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Aperçu public</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ce que voit une personne qui scanne le QR code public. Tout est
            masqué par défaut.
          </p>
        </div>

        <div className="space-y-2">
          {[
            {
              key: "public_show_photo" as const,
              label: "Afficher la photo principale",
            },
            {
              key: "public_show_purchase_year" as const,
              label: "Afficher l’année d’achat",
            },
            {
              key: "public_show_serial_last4" as const,
              label: "Afficher les 4 derniers caractères du numéro de série",
              disabled: !asset.serial_last4,
            },
          ].map((option) => (
            <label
              key={option.key}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={visibility[option.key]}
                disabled={option.disabled}
                onChange={(event) =>
                  setVisibility((current) => ({ ...current, [option.key]: event.target.checked }))
                }
                className="size-4 rounded border-input"
              />
              <span className={option.disabled ? "text-muted-foreground" : "text-foreground"}>
                {option.label}
                {option.disabled ? " (aucun numéro de série enregistré)" : ""}
              </span>
            </label>
          ))}
        </div>

        <Button variant="outline" data-touch onClick={saveVisibility} disabled={savingVisibility}>
          {savingVisibility ? (
            <>
              <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
              Enregistrement…
            </>
          ) : (
            "Enregistrer la visibilité"
          )}
        </Button>
      </section>

      <section className="nid-panel space-y-4 rounded-2xl p-5 sm:p-6">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Archivage et suppression</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Un passeport déjà transmis à un autre propriétaire ne peut plus
            être supprimé : son historique appartient désormais à l’objet.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" data-touch onClick={toggleArchive} disabled={busy}>
            {asset.status === "archived" ? (
              <>
                <ArchiveRestore className="size-4" data-icon="inline-start" />
                Réactiver
              </>
            ) : (
              <>
                <Archive className="size-4" data-icon="inline-start" />
                Archiver
              </>
            )}
          </Button>
          <Button variant="destructive" data-touch onClick={remove} disabled={busy}>
            <Trash2 className="size-4" data-icon="inline-start" />
            Supprimer définitivement
          </Button>
        </div>
      </section>
    </div>
  );
}
