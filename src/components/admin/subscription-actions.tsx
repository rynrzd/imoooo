"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";

/**
 * Actions de gestion d'un abonnement (une ligne du tableau admin).
 *
 * Toutes les actions passent par la route serveur sécurisée
 * POST /api/admin/subscriptions (rôle vérifié en base, Stripe côté serveur,
 * audit). Le composant ne fait qu'appeler la route : aucune logique métier
 * ni aucune clé Stripe côté navigateur.
 *
 * Garanties d'UX : bouton désactivé pendant l'appel (anti double-clic),
 * loader, toast succès/erreur, confirmation obligatoire pour les actions
 * sensibles, rafraîchissement RSC ciblé (router.refresh) sans recharger la
 * page entière.
 */

type ActionKind = "sync" | "cancel_period_end" | "cancel_now" | "suspend" | "reactivate";

interface Props {
  userId: string;
  email: string;
  canStripe: boolean;
  billable: boolean;
  cancelScheduled: boolean;
  suspended: boolean;
}

async function callAction(action: ActionKind, userId: string, reason?: string) {
  const res = await fetch("/api/admin/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, userId, reason }),
  });
  const data = (await res.json().catch(() => null)) as
    | { ok: true; message?: string }
    | { ok: false; error: string }
    | null;
  if (!data) throw new Error("Réponse serveur illisible.");
  return data;
}

export function SubscriptionActions({
  userId,
  email,
  canStripe,
  billable,
  cancelScheduled,
  suspended,
}: Props) {
  const router = useRouter();
  // Un seul verrou par ligne : empêche toute double exécution simultanée.
  const [running, setRunning] = React.useState<ActionKind | null>(null);
  const [dialog, setDialog] = React.useState<null | "cancel" | "cancel_now" | "suspend">(null);
  const [phrase, setPhrase] = React.useState("");
  const [reason, setReason] = React.useState("");

  const run = React.useCallback(
    async (action: ActionKind, reasonText?: string) => {
      if (running) return;
      setRunning(action);
      try {
        const data = await callAction(action, userId, reasonText);
        if (data.ok) {
          toast.success(data.message ?? "Action effectuée.");
          setDialog(null);
          setPhrase("");
          setReason("");
          router.refresh();
        } else {
          toast.error(data.error);
        }
      } catch {
        toast.error("Action impossible. Vérifiez votre connexion et réessayez.");
      } finally {
        setRunning(null);
      }
    },
    [running, userId, router]
  );

  const busy = running !== null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {canStripe ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => run("sync")}
          disabled={busy}
          title="Resynchroniser depuis Stripe (source de vérité)"
        >
          {running === "sync" ? <Spinner label="Sync…" /> : "Sync"}
        </Button>
      ) : null}

      {canStripe && billable && !cancelScheduled ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDialog("cancel")}
          disabled={busy}
          className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
        >
          Annuler
        </Button>
      ) : null}

      {suspended ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => run("reactivate")}
          disabled={busy}
          className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
        >
          {running === "reactivate" ? <Spinner label="…" /> : "Réactiver l’accès"}
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDialog("suspend")}
          disabled={busy}
          title="Suspendre l’accès à Nireo sans supprimer l’abonnement Stripe"
        >
          Suspendre l’accès
        </Button>
      )}

      {/* ---- Confirmation : annulation (deux options) ---- */}
      <Dialog open={dialog === "cancel"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler l’abonnement de {email}</DialogTitle>
            <DialogDescription>
              L’action est exécutée dans Stripe (source de vérité) puis synchronisée. Choisissez le
              mode d’annulation.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Fin de période</p>
            Le client garde l’accès déjà payé jusqu’à la prochaine échéance, puis l’abonnement
            s’arrête. Aucun remboursement.
          </div>
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-muted-foreground">
            <p className="mb-1 font-medium text-destructive">Immédiat</p>
            L’abonnement est résilié tout de suite : l’accès payant est coupé sans délai.
          </div>
          <DialogFooter showCloseButton>
            <Button
              variant="outline"
              onClick={() => run("cancel_period_end")}
              disabled={busy}
            >
              {running === "cancel_period_end" ? <Spinner label="…" /> : "Annuler à échéance"}
            </Button>
            <Button variant="destructive" onClick={() => setDialog("cancel_now")} disabled={busy}>
              Annuler immédiatement…
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Confirmation renforcée : annulation immédiate ---- */}
      <Dialog open={dialog === "cancel_now"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annulation immédiate</DialogTitle>
            <DialogDescription>
              L’abonnement Stripe de {email} sera résilié maintenant. Saisissez «&nbsp;ANNULER&nbsp;»
              pour confirmer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="cancel-phrase">Confirmation</Label>
            <Input
              id="cancel-phrase"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              autoComplete="off"
              placeholder="ANNULER"
            />
          </div>
          <DialogFooter showCloseButton>
            <Button
              variant="destructive"
              onClick={() => run("cancel_now")}
              disabled={busy || phrase !== "ANNULER"}
            >
              {running === "cancel_now" ? <Spinner label="Annulation…" /> : "Annuler immédiatement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Confirmation : suspension d'accès (Stripe conservé) ---- */}
      <Dialog open={dialog === "suspend"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspendre l’accès de {email}</DialogTitle>
            <DialogDescription>
              Le compte ne pourra plus se connecter à Nireo. L’abonnement Stripe et l’historique
              sont conservés : l’accès pourra être rétabli à tout moment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="suspend-reason">Motif (journalisé)</Label>
            <Input
              id="suspend-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optionnel"
            />
          </div>
          <DialogFooter showCloseButton>
            <Button
              variant="default"
              onClick={() => run("suspend", reason.trim())}
              disabled={busy}
            >
              {running === "suspend" ? <Spinner label="Suspension…" /> : "Suspendre l’accès"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
      {label}
    </span>
  );
}
