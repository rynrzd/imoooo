"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { hasFeature } from "@/lib/stripe/entitlements";
import { useAppStore } from "@/lib/store";
import type { RentPayment } from "@/lib/types";

/**
 * Relance manuelle d'un loyer en retard (e-mail réel au locataire, copie
 * au propriétaire). L'API répond 503 « provider_not_configured » tant
 * qu'aucun fournisseur e-mail n'est branché : l'erreur est affichée telle
 * quelle — jamais de succès simulé.
 */
export function RentReminderButton({ payment }: { payment: RentPayment }) {
  const { profile, isLive } = useAppStore();
  const [confirming, setConfirming] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);

  // Pré-contrôle d'affichage (le serveur reste l'autorité : 403 sinon).
  const reminderCheck = isLive
    ? hasFeature(profile?.plan, "manual_reminders")
    : { allowed: true, reason: null };
  // Message personnalisé : plan Pro (sinon le serveur l'ignore).
  const canCustomize = !isLive || hasFeature(profile?.plan, "custom_email_templates").allowed;

  const send = async () => {
    setSending(true);
    try {
      const response = await fetch("/api/rent-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: payment.id, customMessage: message || undefined }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        sent?: boolean;
        recipient?: string;
        error?: string;
      };
      if (!response.ok || !body.sent) {
        toast.error(body.error ?? "Envoi impossible.");
        return;
      }
      toast.success(`Relance envoyée à ${body.recipient}.`);
      setConfirming(false);
      setMessage("");
    } catch {
      toast.error("Erreur réseau : la relance n'a pas été envoyée.");
    } finally {
      setSending(false);
    }
  };

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          if (!reminderCheck.allowed) {
            toast.error(reminderCheck.reason ?? "Fonction non incluse dans votre plan.");
            return;
          }
          setConfirming(true);
        }}
      >
        <Send data-icon="inline-start" />
        Relancer le locataire par e-mail
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">
        Un rappel de paiement sera envoyé au locataire (copie pour vous).
        {canCustomize ? " Message complémentaire facultatif :" : ""}
      </p>
      {canCustomize ? (
        <textarea
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          aria-label="Message complémentaire"
          className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          Modèle standard envoyé — le message personnalisé est inclus à partir du plan Pro.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={sending} onClick={() => setConfirming(false)}>
          Annuler
        </Button>
        <Button type="button" size="sm" disabled={sending} onClick={() => void send()}>
          {sending ? "Envoi…" : "Confirmer l'envoi"}
        </Button>
      </div>
    </div>
  );
}
