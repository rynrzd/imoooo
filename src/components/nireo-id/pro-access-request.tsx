"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestAccessAction } from "@/features/nireo-id/actions/professional";

/**
 * Demande d'accès à un téléphone par identifiant.
 *
 * Saisir un identifiant n'ouvre RIEN : une demande est créée et le
 * propriétaire doit l'accorder depuis l'onglet « Accès » de son téléphone.
 */
export function ProAccessRequest() {
  const router = useRouter();
  const [publicId, setPublicId] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);

    const form = new FormData();
    form.set("public_id", publicId);
    form.set("message", message);
    const result = await requestAccessAction(form);
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Demande envoyée : le propriétaire doit l’accepter.");
    setPublicId("");
    setMessage("");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="nid-panel space-y-4 rounded-lg p-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Demander l’accès à un téléphone</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Le client vous communique son identifiant Nireo (ou son QR code).
          Vous n’obtenez l’accès qu’après son accord explicite.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pro-public-id">Identifiant Nireo</Label>
        <Input
          id="pro-public-id"
          value={publicId}
          onChange={(event) => setPublicId(event.target.value)}
          placeholder="NIR-PH-XXXX-XXXX"
          className="font-mono uppercase"
          autoComplete="off"
          spellCheck={false}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pro-message">Message au propriétaire (facultatif)</Label>
        <textarea
          id="pro-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Ex. Remplacement d'écran prévu le 12 août, atelier Rive Gauche."
          className="w-full rounded-xl border border-input bg-transparent text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <Button type="submit" data-touch disabled={pending || publicId.trim().length === 0}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
            Envoi…
          </>
        ) : (
          <>
            <KeyRound className="size-4" data-icon="inline-start" />
            Demander l’accès
          </>
        )}
      </Button>
    </form>
  );
}
