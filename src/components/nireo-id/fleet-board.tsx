"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FLEET_STATUSES,
  FLEET_STATUS_LABELS,
  FLEET_STATUS_NOTE,
  HEALTH_STATE_LABELS,
  HEALTH_STATES,
  type FleetStatus,
} from "@/features/nireo-id/constants";
import {
  assignAssetAction,
  endAssignmentAction,
  updateFleetStatusAction,
} from "@/features/nireo-id/actions/fleet";
import { sendCheckAction, startCampaignAction } from "@/features/nireo-id/actions/checkups";
import type { FleetItem } from "@/features/nireo-id/types";
import { FleetBadge, HealthBadge } from "./state-badge";

/**
 * Parc d'entreprise.
 *
 * Chaque action déclenche une écriture réelle en base ; aucun bouton n'est
 * décoratif. Les identifiants ne sont jamais affichés en entier : seuls
 * les quatre derniers caractères apparaissent.
 */
export function FleetBoard({
  workspaceId,
  items,
  canManage,
  canRunCampaign,
}: {
  workspaceId: string;
  items: FleetItem[];
  canManage: boolean;
  canRunCampaign: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"tous" | FleetStatus>("tous");
  const [healthFilter, setHealthFilter] = React.useState<"tous" | string>("tous");
  const [overdueOnly, setOverdueOnly] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [assignFor, setAssignFor] = React.useState<FleetItem | null>(null);
  const [manualLinks, setManualLinks] = React.useState<{ label: string; url: string }[]>([]);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== "tous" && item.fleet_status !== statusFilter) return false;
      if (healthFilter !== "tous" && item.health_state !== healthFilter) return false;
      if (overdueOnly && !item.check_overdue) return false;
      if (!needle) return true;
      return [item.brand, item.model, item.internal_reference, item.holder_label ?? "", item.public_id]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [items, query, statusFilter, healthFilter, overdueOnly]);

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );

  const sendCheck = async (item: FleetItem) => {
    if (busy) return;
    setBusy(item.id);
    const form = new FormData();
    form.set("asset_id", item.id);
    const result = await sendCheckAction(form);
    setBusy(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.data.already) {
      toast.info("Un bilan est déjà en cours pour ce téléphone.");
      return;
    }
    if (result.data.email_sent) {
      toast.success("Bilan envoyé au détenteur.");
    } else if (result.data.url) {
      setManualLinks((current) => [
        ...current,
        { label: `${item.brand} ${item.model}`, url: result.data.url as string },
      ]);
      toast.warning("Aucun e-mail envoyé : lien à transmettre.");
    }
    router.refresh();
  };

  const endAssignment = async (item: FleetItem) => {
    if (busy || !item.assignment_id) return;
    setBusy(item.id);
    const form = new FormData();
    form.set("assignment_id", item.assignment_id);
    form.set("workspace_id", workspaceId);
    form.set("fleet_status", "en_stock");
    const result = await endAssignmentAction(form);
    setBusy(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Retour enregistré. La propriété est inchangée.");
    router.refresh();
  };

  const changeStatus = async (item: FleetItem, status: FleetStatus) => {
    if (busy) return;
    setBusy(item.id);
    const form = new FormData();
    form.set("workspace_id", workspaceId);
    form.set("asset_id", item.id);
    form.set("fleet_status", status);
    form.set("internal_reference", item.internal_reference);
    form.set("warranty_end", item.warranty_end ?? "");
    const result = await updateFleetStatusAction(form);
    setBusy(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Statut : ${FLEET_STATUS_LABELS[status]}.`);
    router.refresh();
  };

  const runCampaign = async () => {
    if (busy || selected.length === 0) return;
    setBusy("campagne");
    const form = new FormData();
    form.set("workspace_id", workspaceId);
    form.set("scope", "mini");
    for (const id of selected) form.append("asset_ids", id);
    const result = await startCampaignAction(form);
    setBusy(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSelected([]);
    setManualLinks(result.data.manual_links.map((item) => ({ label: item.asset, url: item.url })));
    toast.success(
      `Campagne terminée : ${result.data.sent} e-mail(s) envoyé(s), ${result.data.manual} lien(s) à transmettre, ${result.data.skipped} ignoré(s).`
    );
    router.refresh();
  };

  const assign = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!assignFor || busy) return;
    const data = new FormData(event.currentTarget);
    data.set("asset_id", assignFor.id);
    data.set("workspace_id", workspaceId);
    setBusy(assignFor.id);
    const result = await assignAssetAction(data);
    setBusy(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Téléphone affecté. La propriété reste celle de l’entreprise.");
    setAssignFor(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="nid-panel flex flex-wrap items-end gap-3 rounded-2xl p-4">
        <div className="min-w-48 flex-1">
          <Label htmlFor="fleet-search">Rechercher</Label>
          <Input
            id="fleet-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Modèle, référence, détenteur"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="fleet-status">Statut</Label>
          <select
            id="fleet-status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "tous" | FleetStatus)}
            className="mt-1.5 rounded-xl border border-border bg-card px-3 text-sm text-foreground"
          >
            <option value="tous">Tous</option>
            {FLEET_STATUSES.map((status) => (
              <option key={status} value={status}>
                {FLEET_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="fleet-health">État</Label>
          <select
            id="fleet-health"
            value={healthFilter}
            onChange={(event) => setHealthFilter(event.target.value)}
            className="mt-1.5 rounded-xl border border-border bg-card px-3 text-sm text-foreground"
          >
            <option value="tous">Tous</option>
            {HEALTH_STATES.map((state) => (
              <option key={state} value={state}>
                {HEALTH_STATE_LABELS[state]}
              </option>
            ))}
          </select>
        </div>

        <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(event) => setOverdueOnly(event.target.checked)}
          />
          Bilan en retard
        </label>
      </div>

      {canRunCampaign && selected.length > 0 ? (
        <div className="nid-note flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
          <p className="text-sm text-foreground">
            {selected.length} téléphone{selected.length > 1 ? "s" : ""} sélectionné
            {selected.length > 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={runCampaign} disabled={busy !== null}>
              {busy === "campagne" ? (
                <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
              ) : null}
              Envoyer un bilan
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              Tout désélectionner
            </Button>
          </div>
        </div>
      ) : null}

      {/* Liste */}
      {filtered.length === 0 ? (
        <p className="nid-panel rounded-2xl p-5 text-sm text-muted-foreground">
          {items.length === 0
            ? "Aucun téléphone dans ce parc. Ajoutez-en un ou importez un fichier."
            : "Aucun téléphone ne correspond à ces filtres."}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((item) => (
            <li key={item.id} className="nid-panel rounded-2xl p-4">
              <div className="flex flex-wrap items-start gap-3">
                {canRunCampaign ? (
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={() => toggle(item.id)}
                    aria-label={`Sélectionner ${item.brand} ${item.model}`}
                    className="mt-1"
                  />
                ) : null}

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/id/app/objets/${item.id}`}
                    className="text-[15px] font-semibold text-foreground underline-offset-2 hover:underline"
                  >
                    {item.brand} {item.model}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.internal_reference ? `${item.internal_reference} · ` : ""}
                    {item.imei_last4 || item.serial_last4
                      ? `•••• ${item.imei_last4 || item.serial_last4}`
                      : "Identifiant non renseigné"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <HealthBadge state={item.health_state} />
                    <FleetBadge status={item.fleet_status} />
                    <span className="text-xs text-muted-foreground">
                      {item.holder_label ? `Détenteur : ${item.holder_label}` : "Sans détenteur"}
                    </span>
                    {item.check_overdue ? (
                      <span className="text-xs text-[var(--nid-warning)]">Bilan en retard</span>
                    ) : null}
                    {item.warranty_end ? (
                      <span className="text-xs text-muted-foreground">
                        Garantie jusqu’au{" "}
                        {new Date(`${item.warranty_end}T00:00:00`).toLocaleDateString("fr-FR")}
                      </span>
                    ) : null}
                  </div>
                  {FLEET_STATUS_NOTE[item.fleet_status] ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {FLEET_STATUS_NOTE[item.fleet_status]}
                    </p>
                  ) : null}
                </div>
              </div>

              {canManage ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => setAssignFor(item)}
                  >
                    {item.assignment_id ? "Changer de détenteur" : "Affecter"}
                  </Button>
                  {item.assignment_id ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => endAssignment(item)}
                    >
                      Enregistrer le retour
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => sendCheck(item)}
                  >
                    {busy === item.id ? (
                      <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
                    ) : null}
                    Envoyer un bilan
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    render={<Link href={`/id/app/objets/${item.id}#reparations`} />}
                  >
                    Déclarer une réparation
                  </Button>

                  <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                    Statut
                    <select
                      value={item.fleet_status}
                      onChange={(event) => changeStatus(item, event.target.value as FleetStatus)}
                      disabled={busy !== null}
                      aria-label={`Statut de ${item.brand} ${item.model}`}
                      className="rounded-lg border border-border bg-card px-2 py-1 text-xs text-foreground"
                    >
                      {FLEET_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {FLEET_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {/* Formulaire d'affectation */}
      {assignFor ? (
        <form onSubmit={assign} className="nid-panel space-y-3 rounded-2xl p-5">
          <h3 className="font-medium text-foreground">
            Affecter {assignFor.brand} {assignFor.model}
          </h3>
          <p className="text-xs text-muted-foreground">
            Une affectation désigne le détenteur du téléphone. Elle ne transfère jamais la
            propriété et n’efface pas l’historique.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="holder-name">Nom du détenteur</Label>
              <Input id="holder-name" name="holder_name" required minLength={2} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="holder-email">E-mail (pour recevoir les bilans)</Label>
              <Input id="holder-email" name="holder_email" type="email" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="assign-kind">Type</Label>
              <select
                id="assign-kind"
                name="kind"
                className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground"
              >
                <option value="affectation">Affectation</option>
                <option value="pret">Prêt</option>
              </select>
            </div>
            <div>
              <Label htmlFor="assign-date">Date de remise</Label>
              <Input id="assign-date" name="started_on" type="date" className="mt-1.5" />
            </div>
          </div>

          <div>
            <Label htmlFor="assign-note">Commentaire interne (facultatif)</Label>
            <Input id="assign-note" name="note" maxLength={500} className="mt-1.5" />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Ce commentaire reste interne : il n’apparaît jamais dans un rapport partagé.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" data-touch disabled={busy !== null}>
              {busy === assignFor.id ? (
                <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
              ) : null}
              Enregistrer l’affectation
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAssignFor(null)}>
              Annuler
            </Button>
          </div>
        </form>
      ) : null}

      {manualLinks.length > 0 ? (
        <div className="nid-note rounded-2xl p-4">
          <p className="text-sm text-foreground">
            Aucun e-mail n’a pu être envoyé pour ces téléphones. Transmettez les liens :
          </p>
          <ul className="mt-2 space-y-1">
            {manualLinks.map((link) => (
              <li key={link.url} className="text-xs">
                <span className="text-foreground">{link.label} — </span>
                <span className="break-all font-mono text-foreground">{link.url}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
