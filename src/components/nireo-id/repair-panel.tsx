"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PARTS_TYPE_LABELS,
  REPAIR_STATUS_LABELS,
  type PartsType,
} from "@/features/nireo-id/constants";
import {
  cancelRepairAction,
  createRepairAction,
  validateRepairAction,
} from "@/features/nireo-id/actions/repairs";
import { formatMoneyFromCents } from "@/features/nireo-id/format";
import type { RepairOrderRow } from "@/features/nireo-id/types";

/**
 * Réparations d'un téléphone, côté client (propriétaire ou responsable).
 *
 * Le lien remis à l'atelier est affiché une seule fois : il n'est pas
 * relisible ensuite (seule son empreinte est conservée en base).
 */
export function RepairPanel({
  assetId,
  orders,
  canEdit,
}: {
  assetId: string;
  orders: RepairOrderRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [problem, setProblem] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [created, setCreated] = React.useState<{ url: string; email_sent: boolean } | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    const form = new FormData();
    form.set("asset_id", assetId);
    form.set("reported_problem", problem);
    if (email) form.set("repairer_email", email);

    const result = await createRepairAction(form);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setCreated({ url: result.data.url, email_sent: result.data.email_sent });
    setProblem("");
    toast.success(
      result.data.email_sent
        ? "Demande créée et lien envoyé à l’atelier."
        : "Demande créée. Transmettez le lien à l’atelier."
    );
    router.refresh();
  };

  const decide = async (orderId: string, decision: "valide" | "refuse") => {
    if (busyId) return;
    const reason =
      decision === "refuse"
        ? (window.prompt("Pourquoi refusez-vous cette intervention ?") ?? "")
        : "";
    if (decision === "refuse" && reason.trim().length === 0) return;

    setBusyId(orderId);
    const form = new FormData();
    form.set("order_id", orderId);
    form.set("decision", decision);
    form.set("reason", reason);
    form.set("asset_id", assetId);
    const result = await validateRepairAction(form);
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      decision === "valide"
        ? result.data.attested
          ? "Intervention ajoutée à l’historique, attestée par un réparateur."
          : "Intervention ajoutée à l’historique, déclarée par l’atelier."
        : "Intervention renvoyée à l’atelier."
    );
    router.refresh();
  };

  const cancel = async (orderId: string) => {
    if (busyId) return;
    if (!window.confirm("Annuler cette demande de réparation ?")) return;
    setBusyId(orderId);
    const form = new FormData();
    form.set("order_id", orderId);
    form.set("asset_id", assetId);
    const result = await cancelRepairAction(form);
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Demande annulée.");
    router.refresh();
  };

  return (
    <section className="nid-panel rounded-2xl p-5">
      <h2 className="font-medium text-foreground">Réparations</h2>

      {orders.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">Aucune réparation enregistrée.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {orders.map((order) => (
            <li key={order.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Wrench className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="text-sm font-medium text-foreground">
                  {REPAIR_STATUS_LABELS[order.status]}
                </span>
                {order.repairer_label ? (
                  <span className="text-xs text-muted-foreground">· {order.repairer_label}</span>
                ) : null}
              </div>

              {order.reported_problem ? (
                <p className="mt-2 text-sm text-muted-foreground">{order.reported_problem}</p>
              ) : null}

              {order.status === "en_attente_validation" ? (
                <dl className="mt-3 space-y-1 text-sm">
                  {order.diagnosis ? (
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">Diagnostic :</dt>
                      <dd className="text-foreground">{order.diagnosis}</dd>
                    </div>
                  ) : null}
                  {order.operation ? (
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">Opération :</dt>
                      <dd className="text-foreground">{order.operation}</dd>
                    </div>
                  ) : null}
                  {order.parts ? (
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">Pièces :</dt>
                      <dd className="text-foreground">
                        {order.parts} ({PARTS_TYPE_LABELS[order.parts_type as PartsType]})
                      </dd>
                    </div>
                  ) : null}
                  {order.amount_cents !== null ? (
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">Montant :</dt>
                      <dd className="text-foreground">
                        {formatMoneyFromCents(order.amount_cents)}
                      </dd>
                    </div>
                  ) : null}
                  {order.warranty_months ? (
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">Garantie :</dt>
                      <dd className="text-foreground">{order.warranty_months} mois</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}

              {canEdit ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {order.status === "en_attente_validation" ? (
                    <>
                      <Button
                        size="sm"
                        disabled={busyId === order.id}
                        onClick={() => decide(order.id, "valide")}
                      >
                        {busyId === order.id ? (
                          <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
                        ) : null}
                        Valider
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === order.id}
                        onClick={() => decide(order.id, "refuse")}
                      >
                        Demander une correction
                      </Button>
                    </>
                  ) : null}
                  {order.status !== "termine" && order.status !== "annule" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === order.id}
                      onClick={() => cancel(order.id)}
                    >
                      Annuler
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <form onSubmit={create} className="mt-5 space-y-3 border-t border-border pt-4">
          <div>
            <Label htmlFor="repair-problem">Problème constaté</Label>
            <textarea
              id="repair-problem"
              value={problem}
              onChange={(event) => setProblem(event.target.value)}
              required
              minLength={5}
              maxLength={2000}
              rows={3}
              className="mt-1.5 w-full rounded-xl border border-border bg-card p-3 text-sm text-foreground"
            />
          </div>
          <div>
            <Label htmlFor="repair-email">E-mail de l’atelier (facultatif)</Label>
            <Input
              id="repair-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="off"
              className="mt-1.5"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Sans adresse, vous obtiendrez un lien à transmettre vous-même. L’accès est limité à
              cette intervention et expire.
            </p>
          </div>
          <Button type="submit" data-touch disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                Création…
              </>
            ) : (
              "Ajouter une réparation"
            )}
          </Button>
        </form>
      ) : null}

      {created ? (
        <div className="nid-note mt-4 rounded-xl p-3">
          <p className="text-sm text-foreground">
            {created.email_sent
              ? "Le lien a été envoyé à l’atelier. Conservez-le si besoin :"
              : "Aucun e-mail n’a été envoyé. Transmettez ce lien à l’atelier :"}
          </p>
          <p className="mt-2 break-all font-mono text-xs text-foreground">{created.url}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Ce lien n’est affiché qu’une seule fois.
          </p>
        </div>
      ) : null}
    </section>
  );
}
