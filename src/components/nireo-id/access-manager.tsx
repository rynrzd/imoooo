"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, Link2Off, Loader2, QrCode, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  decideAccessAction,
  inviteProfessionalAction,
  revokeShareAction,
} from "@/features/nireo-id/actions/owner";
import { PRO_ACCESS_STATUS_LABELS, SHARE_SECTION_LABELS } from "@/features/nireo-id/constants";
import { formatDateTime, formatRemaining } from "@/features/nireo-id/format";
import type { ProfessionalAccessRow, ShareLinkRow } from "@/features/nireo-id/types";
import { ActionButton } from "./action-button";

/**
 * Onglet « Accès » : liens de partage actifs et révoqués, autorisations
 * professionnelles, invitation d'un réparateur approuvé.
 *
 * Le jeton d'un lien n'est affiché qu'une seule fois, à sa création : il
 * n'est pas stocké en clair et ne peut donc pas être réaffiché ici.
 */
export function AccessManager({
  assetId,
  activeShares,
  inactiveShares,
  access,
  canEdit,
}: {
  assetId: string;
  activeShares: ShareLinkRow[];
  inactiveShares: ShareLinkRow[];
  access: (ProfessionalAccessRow & { professional_name: string })[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const invite = async () => {
    if (pending || !email.trim()) return;
    setPending(true);
    const form = new FormData();
    form.set("asset_id", assetId);
    form.set("professional_email", email.trim());
    const result = await inviteProfessionalAction(form);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      result.data.email_sent
        ? "Accès accordé : le professionnel a reçu un e-mail."
        : "Accès accordé. Aucun e-mail n'a été envoyé (fournisseur non configuré) : prévenez le professionnel."
    );
    setEmail("");
    router.refresh();
  };

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-sm font-semibold text-foreground">Liens de partage</h3>

        {activeShares.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Aucun lien actif. Un lien de partage donne accès aux sections que
            vous choisissez, pour 24 h, 7 ou 30 jours, et reste révocable.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {activeShares.map((share) => (
              <li key={share.id} className="nid-panel rounded-2xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {share.label || "Lien de partage"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Expire dans {formatRemaining(share.expires_at)} ·{" "}
                      {share.access_count} consultation{share.access_count > 1 ? "s" : ""}
                    </p>
                    <p className="mt-1.5 flex flex-wrap gap-1.5">
                      {share.sections.map((section) => (
                        <span
                          key={section}
                          className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {SHARE_SECTION_LABELS[section]}
                        </span>
                      ))}
                      {share.allow_download ? (
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                          Téléchargement autorisé
                        </span>
                      ) : null}
                    </p>
                  </div>

                  {canEdit ? (
                    <ActionButton
                      action={revokeShareAction}
                      fields={{ share_id: share.id, asset_id: assetId }}
                      label="Révoquer"
                      pendingLabel="Révocation…"
                      successMessage="Lien révoqué : il ne donne plus aucun accès."
                      confirmMessage="Révoquer ce lien ? Il cessera immédiatement de fonctionner."
                      icon={<Link2Off className="size-3.5" data-icon="inline-start" />}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        {inactiveShares.length > 0 ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              {inactiveShares.length} lien{inactiveShares.length > 1 ? "s" : ""} expiré
              {inactiveShares.length > 1 ? "s" : ""} ou révoqué
              {inactiveShares.length > 1 ? "s" : ""}
            </summary>
            <ul className="mt-2 space-y-1.5">
              {inactiveShares.map((share) => (
                <li
                  key={share.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground"
                >
                  <span>{share.label || "Lien de partage"}</span>
                  <span>
                    {share.revoked_at
                      ? `Révoqué le ${formatDateTime(share.revoked_at)}`
                      : `Expiré le ${formatDateTime(share.expires_at)}`}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-foreground">Accès professionnels</h3>

        {access.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Aucun professionnel n’a accès à ce passeport. Un réparateur ne peut
            jamais y accéder sans votre autorisation explicite.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {access.map((item) => (
              <li key={item.id} className="nid-panel rounded-2xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
                      {item.professional_name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {PRO_ACCESS_STATUS_LABELS[item.status]}
                      {item.status === "accorde"
                        ? ` · expire dans ${formatRemaining(item.expires_at)}`
                        : ""}
                    </p>
                    {item.message ? (
                      <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                        « {item.message} »
                      </p>
                    ) : null}
                  </div>

                  {canEdit ? (
                    <div className="flex flex-wrap gap-2">
                      {item.status === "en_attente" ? (
                        <>
                          <ActionButton
                            action={decideAccessAction}
                            fields={{
                              access_id: item.id,
                              decision: "accorde",
                              asset_id: assetId,
                            }}
                            label="Autoriser"
                            variant="default"
                            successMessage="Accès accordé au professionnel."
                          />
                          <ActionButton
                            action={decideAccessAction}
                            fields={{
                              access_id: item.id,
                              decision: "refuse",
                              asset_id: assetId,
                            }}
                            label="Refuser"
                            successMessage="Demande refusée."
                          />
                        </>
                      ) : null}
                      {item.status === "accorde" ? (
                        <ActionButton
                          action={decideAccessAction}
                          fields={{
                            access_id: item.id,
                            decision: "revoque",
                            asset_id: assetId,
                          }}
                          label="Révoquer l’accès"
                          confirmMessage="Retirer l'accès de ce professionnel à ce passeport ?"
                          successMessage="Accès révoqué."
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        {canEdit ? (
          <div className="nid-panel mt-4 space-y-3 rounded-2xl p-4">
            <h4 className="text-sm font-semibold text-foreground">
              Inviter un réparateur approuvé
            </h4>
            <div className="space-y-1.5">
              <Label htmlFor="pro-email">Adresse e-mail professionnelle</Label>
              <Input
                id="pro-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="contact@atelier.fr"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Le professionnel doit déjà disposer d’un compte Nireo ID
                approuvé. L’accès est limité à 30 jours et révocable à tout
                moment.
              </p>
            </div>
            <Button data-touch onClick={invite} disabled={pending || !email.trim()}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                  Envoi…
                </>
              ) : (
                <>
                  <UserPlus className="size-4" data-icon="inline-start" />
                  Donner accès
                </>
              )}
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

/** Affiche un lien fraîchement créé, copiable une seule fois. */
export function ShareResultCard({ url, expiresAt }: { url: string; expiresAt: string }) {
  const [copied, setCopied] = React.useState(false);
  // Le jeton n'existe que dans ce lien : il permet de générer son QR code
  // maintenant, puisqu'il ne sera plus jamais réaffiché.
  const token = url.split("/id/s/")[1] ?? "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Lien copié.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Copie impossible : sélectionnez le lien manuellement.");
    }
  };

  return (
    <div className="nid-panel space-y-3 rounded-2xl p-4">
      <p className="text-sm font-medium text-foreground">Lien créé</p>
      <p className="text-xs text-muted-foreground">
        Ce lien n’est affiché qu’une seule fois : Nireo n’en conserve que
        l’empreinte. Il expire le {formatDateTime(expiresAt)}.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 text-xs text-foreground">
          {url}
        </code>
        <Button variant="outline" size="sm" onClick={copy}>
          <Copy className="size-3.5" data-icon="inline-start" />
          {copied ? "Copié" : "Copier"}
        </Button>
      </div>
      {token ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            render={
              <a
                href={`/api/nireo-id/qr?cible=partage&jeton=${encodeURIComponent(token)}&format=png`}
                download
              />
            }
          >
            <QrCode className="size-3.5" data-icon="inline-start" />
            QR code (PNG)
          </Button>
          <Button
            variant="ghost"
            size="sm"
            render={
              <a
                href={`/api/nireo-id/qr?cible=partage&jeton=${encodeURIComponent(token)}&format=svg`}
                download
              />
            }
          >
            SVG
          </Button>
        </div>
      ) : null}
    </div>
  );
}
