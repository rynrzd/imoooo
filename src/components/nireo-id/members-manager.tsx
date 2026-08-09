"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  INVITABLE_ROLES,
  WORKSPACE_ROLE_HINTS,
  WORKSPACE_ROLE_LABELS,
  WORKSPACE_ROLES,
  type WorkspaceRole,
} from "@/features/nireo-id/constants";
import {
  inviteMemberAction,
  removeMemberAction,
  revokeInviteAction,
  updateMemberRoleAction,
} from "@/features/nireo-id/actions/workspace";
import type { WorkspaceInviteRow, WorkspaceMemberRow } from "@/features/nireo-id/types";

/**
 * Collaborateurs d'un espace.
 *
 * Un salarié peut être enregistré par nom et e-mail : il recevra les
 * bilans de son téléphone sans jamais voir le parc. Le lien d'invitation
 * n'est affiché que si aucun e-mail n'a pu être envoyé.
 */
export function MembersManager({
  workspaceId,
  members,
  invites,
}: {
  workspaceId: string;
  members: WorkspaceMemberRow[];
  invites: WorkspaceInviteRow[];
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [manualLink, setManualLink] = React.useState<string | null>(null);
  const [role, setRole] = React.useState<WorkspaceRole>("member");

  const invite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    form.set("workspace_id", workspaceId);
    setPending(true);
    const result = await inviteMemberAction(form);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.data.email_sent) {
      setManualLink(null);
      toast.success("Invitation envoyée.");
    } else {
      setManualLink(result.data.url);
      toast.warning("Aucun e-mail envoyé : transmettez le lien affiché.");
    }
    event.currentTarget.reset();
    router.refresh();
  };

  const changeRole = async (memberId: string, nextRole: string) => {
    setBusyId(memberId);
    const form = new FormData();
    form.set("member_id", memberId);
    form.set("workspace_id", workspaceId);
    form.set("role", nextRole);
    const result = await updateMemberRoleAction(form);
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Rôle mis à jour.");
    router.refresh();
  };

  const remove = async (memberId: string) => {
    if (!window.confirm("Retirer cette personne de l’espace ?")) return;
    setBusyId(memberId);
    const form = new FormData();
    form.set("member_id", memberId);
    form.set("workspace_id", workspaceId);
    const result = await removeMemberAction(form);
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Personne retirée de l’espace.");
    router.refresh();
  };

  const revoke = async (inviteId: string) => {
    setBusyId(inviteId);
    const form = new FormData();
    form.set("invite_id", inviteId);
    form.set("workspace_id", workspaceId);
    const result = await revokeInviteAction(form);
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Invitation annulée.");
    router.refresh();
  };

  const pendingInvites = invites.filter(
    (item) => !item.accepted_at && !item.revoked_at && new Date(item.expires_at) > new Date()
  );

  return (
    <div className="space-y-6">
      <section className="nid-panel rounded-2xl p-5">
        <h2 className="font-medium text-foreground">Inviter une personne</h2>
        <form onSubmit={invite} className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="invite-name">Nom</Label>
              <Input id="invite-name" name="display_name" maxLength={120} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="invite-email">Adresse e-mail</Label>
              <Input id="invite-email" name="email" type="email" required className="mt-1.5" />
            </div>
          </div>

          <div>
            <Label htmlFor="invite-role">Rôle</Label>
            <select
              id="invite-role"
              name="role"
              value={role}
              onChange={(event) => setRole(event.target.value as WorkspaceRole)}
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground sm:w-72"
            >
              {INVITABLE_ROLES.map((item) => (
                <option key={item} value={item}>
                  {WORKSPACE_ROLE_LABELS[item]}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-muted-foreground">{WORKSPACE_ROLE_HINTS[role]}</p>
          </div>

          <Button type="submit" data-touch disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                Envoi…
              </>
            ) : (
              "Envoyer l’invitation"
            )}
          </Button>
        </form>

        {manualLink ? (
          <div className="nid-note mt-4 rounded-xl p-3">
            <p className="text-sm text-foreground">
              Aucun e-mail n’a été envoyé (aucun fournisseur configuré). Transmettez ce lien :
            </p>
            <p className="mt-2 break-all font-mono text-xs text-foreground">{manualLink}</p>
          </div>
        ) : null}
      </section>

      <section className="nid-panel rounded-2xl p-5">
        <h2 className="font-medium text-foreground">Membres</h2>
        <ul className="mt-3 divide-y divide-border">
          {members.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">
                  {member.display_name || member.email || "Membre"}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {member.email}
                  {member.status === "invite" ? " · invitation en attente" : ""}
                  {member.user_id ? "" : " · sans compte"}
                </span>
              </span>

              <select
                value={member.role}
                onChange={(event) => changeRole(member.id, event.target.value)}
                disabled={busyId !== null || member.role === "owner"}
                aria-label={`Rôle de ${member.display_name || member.email}`}
                className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-foreground"
              >
                {WORKSPACE_ROLES.map((item) => (
                  <option key={item} value={item}>
                    {WORKSPACE_ROLE_LABELS[item]}
                  </option>
                ))}
              </select>

              {member.role === "owner" ? null : (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId !== null}
                  onClick={() => remove(member.id)}
                >
                  Retirer
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {pendingInvites.length > 0 ? (
        <section className="nid-panel rounded-2xl p-5">
          <h2 className="font-medium text-foreground">Invitations en attente</h2>
          <ul className="mt-3 divide-y divide-border">
            {pendingInvites.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <span className="min-w-0 flex-1 truncate text-foreground">{item.email}</span>
                <span className="text-xs text-muted-foreground">
                  {WORKSPACE_ROLE_LABELS[item.role]} · expire le{" "}
                  {new Date(item.expires_at).toLocaleDateString("fr-FR")}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId !== null}
                  onClick={() => revoke(item.id)}
                >
                  Annuler
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
