"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

/** Identifiants acceptés par POST /api/test-email (liste blanche serveur). */
const TEST_TEMPLATES = [
  { id: "bienvenue", label: "Bienvenue" },
  { id: "contact_confirmation", label: "Confirmation de contact" },
  { id: "loyer_bientot_du", label: "Loyer bientôt dû" },
  { id: "loyer_en_retard", label: "Loyer en retard (niveau 1)" },
  { id: "paiement_recu", label: "Paiement reçu" },
  { id: "bail_bientot_expire", label: "Bail bientôt expiré" },
  { id: "document_bientot_expire", label: "Document bientôt expiré" },
  { id: "travaux_en_retard", label: "Travaux en retard" },
  { id: "rapport_mensuel", label: "Rapport mensuel" },
] as const;

/**
 * Envoi d'un e-mail de test à SA PROPRE adresse (le serveur impose le
 * destinataire = utilisateur connecté). Succès affiché uniquement après
 * retour réel du fournisseur ; l'API répond 503 sans fournisseur configuré.
 */
export function TestEmailCard({ email }: { email: string | null }) {
  const [template, setTemplate] = React.useState<string>(TEST_TEMPLATES[0].id);
  const [confirming, setConfirming] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  const send = async () => {
    setSending(true);
    try {
      const response = await fetch("/api/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
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
      toast.success(`E-mail de test envoyé à ${body.recipient}.`);
      setConfirming(false);
    } catch {
      toast.error("Erreur réseau : l'e-mail de test n'a pas été envoyé.");
    } finally {
      setSending(false);
    }
  };

  const selectedLabel =
    TEST_TEMPLATES.find((t) => t.id === template)?.label ?? template;

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-sm font-medium">E-mail de test</CardTitle>
        <CardDescription>
          Vérifiez le rendu réel des modèles : l&apos;e-mail est envoyé à votre
          adresse ({email ?? "—"}), préfixé [TEST]. Limité à 5 envois par heure.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="test-email-template">Modèle</Label>
          <select
            id="test-email-template"
            value={template}
            onChange={(e) => {
              setTemplate(e.target.value);
              setConfirming(false);
            }}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {TEST_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        {confirming ? (
          <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">
              Envoyer le modèle « {selectedLabel} » à {email ?? "votre adresse"} ?
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={sending}
                onClick={() => setConfirming(false)}
              >
                Annuler
              </Button>
              <Button type="button" size="sm" disabled={sending} onClick={() => void send()}>
                {sending ? "Envoi…" : "Confirmer l'envoi"}
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
            <Send data-icon="inline-start" />
            Envoyer un e-mail de test
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
