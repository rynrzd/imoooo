"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { WorkspaceRole } from "../constants";
import {
  createWorkspaceSchema,
  inviteMemberSchema,
  memberRoleSchema,
  renameWorkspaceSchema,
} from "../schemas";
import type { ActionResult } from "../types";
import { requireNidUser } from "../server/guards";
import {
  acceptInvite,
  createWorkspace,
  ensurePersonalWorkspace,
  getWorkspaceContext,
  inviteErrorMessage,
  inviteMember,
  removeMember,
  renameWorkspace,
  revokeInvite,
  updateMemberRole,
  NID_WORKSPACE_COOKIE,
} from "../server/workspaces";
import { fail, ok, parseInput, run, text } from "./helpers";

/**
 * Server Actions des espaces Nireo ID.
 *
 * Le cookie d'espace actif n'ouvre AUCUN droit : chaque lecture et chaque
 * écriture revérifie le rôle en base (et la RLS s'applique par-dessus).
 */

const APP = "/id/app";

/* ------------------------------------------------------------------ */
/*  Sélecteur d'espace                                                 */
/* ------------------------------------------------------------------ */

export async function switchWorkspaceAction(form: FormData): Promise<ActionResult<{ href: string }>> {
  return run("workspace/switch", async () => {
    const session = await requireNidUser();
    const workspaceId = text(form, "workspace_id");
    if (!workspaceId) return fail("Espace introuvable.");

    const context = await getWorkspaceContext(session.user.id, workspaceId);
    if (!context) return fail("Vous n'êtes pas membre de cet espace.");

    const store = await cookies();
    store.set(NID_WORKSPACE_COOKIE, workspaceId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    const href =
      context.workspace.kind === "entreprise"
        ? `/id/entreprise/${workspaceId}`
        : context.workspace.kind === "atelier"
          ? "/id/pro"
          : APP;

    revalidatePath(APP);
    return ok({ href });
  });
}

/* ------------------------------------------------------------------ */
/*  Création et réglages                                               */
/* ------------------------------------------------------------------ */

export async function createWorkspaceAction(
  form: FormData
): Promise<ActionResult<{ id: string; href: string }>> {
  return run("workspace/create", async () => {
    const session = await requireNidUser();
    const parsed = parseInput(createWorkspaceSchema, {
      kind: text(form, "kind"),
      name: text(form, "name"),
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    // L'espace personnel doit exister avant tout autre espace.
    await ensurePersonalWorkspace(session.user.id, session.email);

    const created = await createWorkspace(session.user.id, parsed.value.kind, parsed.value.name);

    const store = await cookies();
    store.set(NID_WORKSPACE_COOKIE, created.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    revalidatePath(APP);
    return ok({
      id: created.id,
      href:
        parsed.value.kind === "entreprise" ? `/id/entreprise/${created.id}` : "/id/pro",
    });
  });
}

export async function renameWorkspaceAction(form: FormData): Promise<ActionResult> {
  return run("workspace/rename", async () => {
    const session = await requireNidUser();
    const parsed = parseInput(renameWorkspaceSchema, {
      workspace_id: text(form, "workspace_id"),
      name: text(form, "name"),
      timezone: text(form, "timezone") || "Europe/Paris",
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    await renameWorkspace(
      session.user.id,
      parsed.value.workspace_id,
      parsed.value.name,
      parsed.value.timezone
    );
    revalidatePath(`/id/entreprise/${parsed.value.workspace_id}`);
    return ok();
  });
}

/* ------------------------------------------------------------------ */
/*  Collaborateurs                                                     */
/* ------------------------------------------------------------------ */

export async function inviteMemberAction(
  form: FormData
): Promise<ActionResult<{ url: string; email_sent: boolean }>> {
  return run("workspace/invite", async () => {
    const session = await requireNidUser();
    const parsed = parseInput(inviteMemberSchema, {
      workspace_id: text(form, "workspace_id"),
      email: text(form, "email"),
      role: text(form, "role") || "member",
      display_name: text(form, "display_name"),
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    const result = await inviteMember(
      session.user.id,
      parsed.value.workspace_id,
      parsed.value.email,
      parsed.value.role as WorkspaceRole,
      parsed.value.display_name
    );

    revalidatePath(`/id/entreprise/${parsed.value.workspace_id}/collaborateurs`);
    return ok({ url: result.url, email_sent: result.email_sent });
  });
}

export async function revokeInviteAction(form: FormData): Promise<ActionResult> {
  return run("workspace/revoke-invite", async () => {
    const session = await requireNidUser();
    const inviteId = text(form, "invite_id");
    if (!inviteId) return fail("Invitation introuvable.");
    await revokeInvite(session.user.id, inviteId);
    revalidatePath(`/id/entreprise/${text(form, "workspace_id")}/collaborateurs`);
    return ok();
  });
}

export async function updateMemberRoleAction(form: FormData): Promise<ActionResult> {
  return run("workspace/member-role", async () => {
    const session = await requireNidUser();
    const parsed = parseInput(memberRoleSchema, {
      member_id: text(form, "member_id"),
      workspace_id: text(form, "workspace_id"),
      role: text(form, "role"),
    });
    if (!parsed.ok) return fail(parsed.error, parsed.field);

    await updateMemberRole(
      session.user.id,
      parsed.value.workspace_id,
      parsed.value.member_id,
      parsed.value.role
    );
    revalidatePath(`/id/entreprise/${parsed.value.workspace_id}/collaborateurs`);
    return ok();
  });
}

export async function removeMemberAction(form: FormData): Promise<ActionResult> {
  return run("workspace/remove-member", async () => {
    const session = await requireNidUser();
    const memberId = text(form, "member_id");
    const workspaceId = text(form, "workspace_id");
    if (!memberId || !workspaceId) return fail("Membre introuvable.");
    await removeMember(session.user.id, workspaceId, memberId);
    revalidatePath(`/id/entreprise/${workspaceId}/collaborateurs`);
    return ok();
  });
}

/* ------------------------------------------------------------------ */
/*  Invitation reçue                                                   */
/* ------------------------------------------------------------------ */

export async function acceptInviteAction(
  form: FormData
): Promise<ActionResult<{ workspace_id: string }>> {
  return run("workspace/accept-invite", async () => {
    const session = await requireNidUser();
    const token = text(form, "token");
    if (!token) return fail("Invitation introuvable.");

    await ensurePersonalWorkspace(session.user.id, session.email);
    const result = await acceptInvite(token, session.user.id, session.email);
    if (result.state !== "accepte") return fail(inviteErrorMessage(result.state));

    revalidatePath(APP);
    return ok({ workspace_id: result.workspace_id as string });
  });
}
