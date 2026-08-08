"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Copy, Loader2, MailCheck, MailX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTransferAction } from "@/features/nireo-id/actions/owner";
import {
  DOCUMENT_KIND_LABELS,
  TRANSFER_EXPIRY_DAYS,
  TRANSFER_POLICIES,
  TRANSFER_POLICY_LABELS,
  type TransferPolicy,
} from "@/features/nireo-id/constants";
import { formatDateTime, formatFileSize } from "@/features/nireo-id/format";
import type { DocumentRow } from "@/features/nireo-id/types";

/**
 * Ouverture d'un transfert de propriété.
 *
 * Le vendeur voit exactement ce qui sera transmis et décide document par
 * document. Rien ne change tant que l'acheteur n'a pas accepté : la
 * bascule est réalisée en une seule opération atomique côté base.
 */
export function TransferForm({
  assetId,
  deviceLabel,
  documents,
}: {
  assetId: string;
  deviceLabel: string;
  documents: DocumentRow[];
}) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [confirm, setConfirm] = React.useState(false);
  const [policies, setPolicies] = React.useState<Record<string, TransferPolicy>>(() =>
    Object.fromEntries(documents.map((document) => [document.id, document.transfer_policy]))
  );
  const [pending, setPending] = React.useState(false);
  const [created, setCreated] = React.useState<{
    url: string;
    email_sent: boolean;
    expires_at: string;
  } | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);

    const form = new FormData();
    form.set("asset_id", assetId);
    form.set("recipient_email", email);
    form.set("confirm", confirm ? "true" : "false");
    for (const [documentId, policy] of Object.entries(policies)) {
      form.append("document_policy", `${documentId}:${policy}`);
    }

    const result = await createTransferAction(form);
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setCreated(result.data);
    router.refresh();
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Lien copié.");
    } catch {
      toast.error("Copie impossible : sélectionnez le lien manuellement.");
    }
  };

  if (created) {
    return (
      <div className="nid-panel space-y-4 rounded-2xl p-5 sm:p-6">
        <h2 className="text-base font-semibold text-foreground">Transfert ouvert</h2>

        {created.email_sent ? (
          <p className="flex items-start gap-2.5 rounded-xl border border-[color-mix(in_srgb,var(--nid-success)_35%,transparent)] bg-[color-mix(in_srgb,var(--nid-success)_10%,transparent)] p-3 text-sm text-foreground">
            <MailCheck className="mt-0.5 size-4 shrink-0 text-[var(--nid-success)]" aria-hidden />
            Une invitation a été envoyée à <strong>{email}</strong>. Elle expire
            le {formatDateTime(created.expires_at)}.
          </p>
        ) : (
          <p className="flex items-start gap-2.5 rounded-xl border border-[color-mix(in_srgb,var(--nid-warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--nid-warning)_10%,transparent)] p-3 text-sm text-foreground">
            <MailX className="mt-0.5 size-4 shrink-0 text-[var(--nid-warning)]" aria-hidden />
            Aucun e-mail n’a été envoyé : le service d’envoi n’est pas
            configuré sur cette installation. Transmettez vous-même le lien
            ci-dessous à l’acheteur.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 text-xs text-foreground">
            {created.url}
          </code>
          <Button variant="outline" size="sm" onClick={() => copy(created.url)}>
            <Copy className="size-3.5" data-icon="inline-start" />
            Copier
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          L’acheteur doit être connecté avec l’adresse <strong>{email}</strong>{" "}
          pour accepter. Tant qu’il n’a pas répondu, vous pouvez annuler le
          transfert depuis la page Transferts.
        </p>

        <Button variant="outline" onClick={() => router.push("/id/app/transferts")}>
          Voir mes transferts
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="nid-panel space-y-5 rounded-2xl p-5 sm:p-6">
      <div className="space-y-1.5">
        <Label htmlFor="recipient">Adresse e-mail de l’acheteur</Label>
        <Input
          id="recipient"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="acheteur@exemple.fr"
          autoComplete="off"
          required
        />
        <p className="text-xs text-muted-foreground">
          Seule cette adresse pourra accepter le transfert. La demande expire
          après {TRANSFER_EXPIRY_DAYS} jours.
        </p>
      </div>

      <section>
        <h3 className="text-sm font-medium text-foreground">Ce qui sera transmis</h3>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          <li>· Les caractéristiques du {deviceLabel} et son identifiant Nireo.</li>
          <li>· L’historique complet : événements déclarés et interventions professionnelles.</li>
          <li>· L’état déclaré et les photos du passeport.</li>
          <li>· Un événement « Changement de propriétaire » ajouté à l’historique.</li>
        </ul>
        <p className="mt-2 text-sm text-muted-foreground">
          Vos liens de partage actifs seront révoqués, et vous perdrez tout
          droit de modification sur ce passeport.
        </p>
      </section>

      <section>
        <h3 className="text-sm font-medium text-foreground">Vos documents</h3>
        {documents.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Aucun document dans ce dossier : rien de personnel ne sera transmis.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {documents.map((document) => (
              <li
                key={document.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-foreground">
                    {document.original_name || DOCUMENT_KIND_LABELS[document.kind]}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {DOCUMENT_KIND_LABELS[document.kind]} · {formatFileSize(document.size_bytes)}
                  </span>
                </span>
                <select
                  aria-label={`Politique de transfert pour ${document.original_name || "ce document"}`}
                  value={policies[document.id] ?? "prive"}
                  onChange={(event) =>
                    setPolicies((current) => ({
                      ...current,
                      [document.id]: event.target.value as TransferPolicy,
                    }))
                  }
                  className="rounded-lg border border-input bg-transparent px-2 py-1 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {TRANSFER_POLICIES.map((value) => (
                    <option key={value} value={value}>
                      {TRANSFER_POLICY_LABELS[value]}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Par défaut, un document reste privé : il ne suit pas l’objet. Une
          facture contient votre nom et vos moyens de paiement.
        </p>
      </section>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm">
        <input
          type="checkbox"
          checked={confirm}
          onChange={(event) => setConfirm(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 rounded border-input"
        />
        <span className="text-muted-foreground">
          Je comprends qu’après acceptation je ne serai plus propriétaire de ce
          passeport et que je ne pourrai plus le modifier.
        </span>
      </label>

      <Button type="submit" data-touch disabled={pending || !confirm || !email.trim()}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
            Ouverture…
          </>
        ) : (
          <>
            <ArrowLeftRight className="size-4" data-icon="inline-start" />
            Ouvrir le transfert
          </>
        )}
      </Button>
    </form>
  );
}
