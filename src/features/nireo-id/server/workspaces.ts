import { cookies } from "next/headers";
import { logger } from "@/lib/logger";
import { SITE_URL } from "@/lib/supabase/config";
import { INVITE_DAYS, type WorkspaceKind, type WorkspaceRole } from "../constants";
import { createToken, hashToken } from "../identifiers";
import { nidPlan, type NidEntitlement, planHasEntitlement } from "../plans";
import type {
  WorkspaceContext,
  WorkspaceInviteRow,
  WorkspaceMemberRow,
  WorkspaceRow,
} from "../types";
import { recordNidAudit } from "./audit";
import { dbErrorMessage, isNireoIdConfigured, isSchemaMissing, nidService, nidUserClient } from "./client";
import { notifyWorkspaceInvitation } from "./emails";

/**
 * Espaces Nireo ID (personnel, entreprise, atelier).
 *
 * Un compte Nireo unique peut appartenir à plusieurs espaces : il n'existe
 * aucun choix définitif « particulier ou professionnel ». Le rôle est
 * TOUJOURS relu en base ; le cookie d'espace actif n'est qu'un confort de
 * navigation, jamais une autorisation.
 */

export const NID_WORKSPACE_COOKIE = "nid_espace";

/* ------------------------------------------------------------------ */
/*  Espace personnel                                                   */
/* ------------------------------------------------------------------ */

/**
 * Crée (ou retrouve) l'espace personnel de l'utilisateur, de façon
 * atomique et idempotente : deux appels simultanés ne créent jamais deux
 * espaces.
 */
export async function ensurePersonalWorkspace(
  userId: string,
  email: string
): Promise<string | null> {
  if (!isNireoIdConfigured) return null;
  const name = email.split("@")[0]?.slice(0, 60) || "Mon espace";
  const { data, error } = await nidService().rpc("nid_ensure_personal_workspace", {
    p_user_id: userId,
    p_name: `Espace de ${name}`,
  });
  if (error) {
    if (isSchemaMissing(error)) return null;
    logger.error("nireo-id/workspaces ensure", error);
    return null;
  }
  return (data as string | null) ?? null;
}

/* ------------------------------------------------------------------ */
/*  Lecture                                                            */
/* ------------------------------------------------------------------ */

/** Tous les espaces de l'utilisateur, avec son rôle dans chacun. */
export async function listWorkspaces(userId: string): Promise<WorkspaceContext[]> {
  if (!isNireoIdConfigured) return [];
  const { data, error } = await nidService()
    .from("nid_workspace_members")
    .select("role, workspace:nid_workspaces (*)")
    .eq("user_id", userId)
    .eq("status", "actif");

  if (error) {
    if (!isSchemaMissing(error)) logger.error("nireo-id/workspaces list", error);
    return [];
  }

  const rows = (data ?? []) as unknown as {
    role: WorkspaceRole;
    workspace: WorkspaceRow | null;
  }[];

  return rows
    .filter((row): row is { role: WorkspaceRole; workspace: WorkspaceRow } => Boolean(row.workspace))
    .map((row) => ({ workspace: row.workspace, role: row.role }))
    .sort((a, b) => {
      if (a.workspace.kind === "personnel") return -1;
      if (b.workspace.kind === "personnel") return 1;
      return a.workspace.name.localeCompare(b.workspace.name, "fr");
    });
}

/** Espace + rôle, uniquement si l'utilisateur en est membre actif. */
export async function getWorkspaceContext(
  userId: string,
  workspaceId: string
): Promise<WorkspaceContext | null> {
  if (!isNireoIdConfigured) return null;
  const { data, error } = await nidService()
    .from("nid_workspace_members")
    .select("role, workspace:nid_workspaces (*)")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .eq("status", "actif")
    .maybeSingle();

  if (error || !data) return null;
  const row = data as unknown as { role: WorkspaceRole; workspace: WorkspaceRow | null };
  if (!row.workspace) return null;
  return { workspace: row.workspace, role: row.role };
}

/** Espace actif mémorisé (cookie), retombant sur l'espace personnel. */
export async function getActiveWorkspace(userId: string): Promise<WorkspaceContext | null> {
  const spaces = await listWorkspaces(userId);
  if (spaces.length === 0) return null;
  const store = await cookies();
  const preferred = store.get(NID_WORKSPACE_COOKIE)?.value;
  return (
    spaces.find((item) => item.workspace.id === preferred) ??
    spaces.find((item) => item.workspace.kind === "personnel") ??
    spaces[0]
  );
}

/* ------------------------------------------------------------------ */
/*  Contrôles d'autorisation (toujours côté serveur)                   */
/* ------------------------------------------------------------------ */

export function canManageFleet(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin" || role === "manager";
}

export function canReadFleet(role: WorkspaceRole): boolean {
  return canManageFleet(role) || role === "viewer";
}

export function canAdminister(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin";
}

/** Contexte exigé avec un rôle minimal — lève une erreur explicite sinon. */
export async function requireWorkspaceRole(
  userId: string,
  workspaceId: string,
  allowed: WorkspaceRole[]
): Promise<WorkspaceContext> {
  const context = await getWorkspaceContext(userId, workspaceId);
  if (!context) {
    throw new Error("Cet espace n'existe pas ou vous n'en êtes pas membre.");
  }
  if (!allowed.includes(context.role)) {
    throw new Error("Votre rôle dans cet espace ne permet pas cette action.");
  }
  return context;
}

/** Droit payant : vérifié en base (plan de l'espace), jamais côté client. */
export async function requireEntitlement(
  context: WorkspaceContext,
  entitlement: NidEntitlement,
  message: string
): Promise<void> {
  if (!planHasEntitlement(context.workspace.plan, entitlement)) {
    throw new Error(message);
  }
}

/* ------------------------------------------------------------------ */
/*  Création                                                           */
/* ------------------------------------------------------------------ */

export async function createWorkspace(
  userId: string,
  kind: Exclude<WorkspaceKind, "personnel">,
  name: string
): Promise<{ id: string }> {
  const { data, error } = await nidService().rpc("nid_create_workspace", {
    p_user_id: userId,
    p_kind: kind,
    p_name: name,
  });
  if (error) throw new Error(dbErrorMessage(error, "La création de l'espace a échoué."));
  const result = data as { id: string };
  return { id: result.id };
}

export async function renameWorkspace(
  userId: string,
  workspaceId: string,
  name: string,
  timezone: string
): Promise<void> {
  await requireWorkspaceRole(userId, workspaceId, ["owner", "admin"]);
  const supabase = await nidUserClient();
  const { error } = await supabase
    .from("nid_workspaces")
    .update({ name, timezone: timezone || "Europe/Paris" })
    .eq("id", workspaceId);
  if (error) throw new Error(dbErrorMessage(error, "La mise à jour a échoué."));
}

/* ------------------------------------------------------------------ */
/*  Membres et invitations                                             */
/* ------------------------------------------------------------------ */

export async function listMembers(workspaceId: string): Promise<WorkspaceMemberRow[]> {
  if (!isNireoIdConfigured) return [];
  const { data, error } = await nidService()
    .from("nid_workspace_members")
    .select("*")
    .eq("workspace_id", workspaceId)
    .neq("status", "retire")
    .order("created_at", { ascending: true });
  if (error) {
    if (!isSchemaMissing(error)) logger.error("nireo-id/workspaces members", error);
    return [];
  }
  return (data ?? []) as WorkspaceMemberRow[];
}

export async function listInvites(workspaceId: string): Promise<WorkspaceInviteRow[]> {
  if (!isNireoIdConfigured) return [];
  const { data, error } = await nidService()
    .from("nid_workspace_invites")
    .select("id, workspace_id, email, role, invited_by, expires_at, accepted_at, accepted_by, revoked_at, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return [];
  return (data ?? []) as WorkspaceInviteRow[];
}

export interface InviteResult {
  url: string;
  email_sent: boolean;
  expires_at: string;
}

/**
 * Invite un collaborateur. Le jeton n'est stocké que haché : le lien
 * complet n'existe que dans l'e-mail (ou, si aucun fournisseur n'est
 * configuré, dans l'écran de l'administrateur pour transmission manuelle).
 */
export async function inviteMember(
  userId: string,
  workspaceId: string,
  email: string,
  role: WorkspaceRole,
  displayName: string
): Promise<InviteResult> {
  const context = await requireWorkspaceRole(userId, workspaceId, ["owner", "admin"]);

  const plan = nidPlan(context.workspace.plan);
  const members = await listMembers(workspaceId);
  if (plan.maxMembers !== null && members.length >= plan.maxMembers) {
    throw new Error(
      `L'offre ${plan.label} est limitée à ${plan.maxMembers} membres. ` +
        "Changez d'offre pour inviter davantage de collaborateurs."
    );
  }

  const service = nidService();
  const token = createToken();
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86400 * 1000).toISOString();

  const { error } = await service.from("nid_workspace_invites").insert({
    workspace_id: workspaceId,
    email,
    role,
    token_hash: hashToken(token),
    invited_by: userId,
    expires_at: expiresAt,
  });
  if (error) throw new Error(dbErrorMessage(error, "L'invitation n'a pas pu être créée."));

  // Le salarié est pré-enregistré (nom + e-mail) : il peut recevoir un
  // bilan sans avoir encore créé de compte.
  const { data: existing } = await service
    .from("nid_workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .is("user_id", null)
    .ilike("email", email)
    .maybeSingle();
  if (!existing) {
    await service.from("nid_workspace_members").insert({
      workspace_id: workspaceId,
      user_id: null,
      email,
      display_name: displayName,
      role,
      status: "invite",
    });
  }

  const url = `${SITE_URL}/id/invitation/${token}`;
  const emailSent = await notifyWorkspaceInvitation({
    to: email,
    workspaceName: context.workspace.name,
    url,
  });

  await recordNidAudit({
    actorUserId: userId,
    action: "workspace.invited",
    targetType: "workspace",
    targetId: workspaceId,
    metadata: { role, email_sent: emailSent },
  });

  return { url, email_sent: emailSent, expires_at: expiresAt };
}

export async function revokeInvite(userId: string, inviteId: string): Promise<void> {
  const service = nidService();
  const { data: invite } = await service
    .from("nid_workspace_invites")
    .select("id, workspace_id")
    .eq("id", inviteId)
    .maybeSingle();
  if (!invite) throw new Error("Invitation introuvable.");
  const row = invite as { workspace_id: string };
  await requireWorkspaceRole(userId, row.workspace_id, ["owner", "admin"]);

  const { error } = await service
    .from("nid_workspace_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId)
    .is("accepted_at", null);
  if (error) throw new Error(dbErrorMessage(error, "La révocation a échoué."));
}

/** Acceptation atomique (double clic sans effet, jeton à usage unique). */
export async function acceptInvite(
  token: string,
  userId: string,
  email: string
): Promise<{ state: string; workspace_id?: string }> {
  const { data, error } = await nidService().rpc("nid_accept_invite", {
    p_token_hash: hashToken(token),
    p_user_id: userId,
    p_email: email,
  });
  if (error) throw new Error(dbErrorMessage(error, "L'invitation n'a pas pu être acceptée."));
  return data as { state: string; workspace_id?: string };
}

export function inviteErrorMessage(state: string): string {
  switch (state) {
    case "introuvable":
      return "Cette invitation n'existe pas.";
    case "revoque":
      return "Cette invitation a été annulée par l'entreprise.";
    case "expire":
      return "Cette invitation a expiré. Demandez-en une nouvelle.";
    case "deja_utilise":
      return "Cette invitation a déjà été utilisée.";
    case "destinataire_different":
      return "Cette invitation a été envoyée à une autre adresse e-mail. Connectez-vous avec cette adresse.";
    default:
      return "Cette invitation ne peut pas être acceptée.";
  }
}

/** Changement de rôle — le dernier propriétaire ne peut pas être rétrogradé. */
export async function updateMemberRole(
  userId: string,
  workspaceId: string,
  memberId: string,
  role: WorkspaceRole
): Promise<void> {
  await requireWorkspaceRole(userId, workspaceId, ["owner", "admin"]);
  const service = nidService();

  const { data: member } = await service
    .from("nid_workspace_members")
    .select("id, role, user_id, workspace_id")
    .eq("id", memberId)
    .maybeSingle();
  const row = member as WorkspaceMemberRow | null;
  if (!row || row.workspace_id !== workspaceId) throw new Error("Membre introuvable.");

  if (row.role === "owner" && role !== "owner") {
    const { count } = await service
      .from("nid_workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("role", "owner")
      .eq("status", "actif");
    if ((count ?? 0) <= 1) {
      throw new Error("Cet espace doit conserver au moins un propriétaire.");
    }
  }

  const { error } = await service
    .from("nid_workspace_members")
    .update({ role })
    .eq("id", memberId);
  if (error) throw new Error(dbErrorMessage(error, "Le rôle n'a pas pu être modifié."));

  await recordNidAudit({
    actorUserId: userId,
    action: "workspace.role_changed",
    targetType: "member",
    targetId: memberId,
    metadata: { role },
  });
}

export async function removeMember(
  userId: string,
  workspaceId: string,
  memberId: string
): Promise<void> {
  await requireWorkspaceRole(userId, workspaceId, ["owner", "admin"]);
  const service = nidService();

  const { data: member } = await service
    .from("nid_workspace_members")
    .select("id, role, user_id, workspace_id")
    .eq("id", memberId)
    .maybeSingle();
  const row = member as WorkspaceMemberRow | null;
  if (!row || row.workspace_id !== workspaceId) throw new Error("Membre introuvable.");
  if (row.role === "owner") {
    throw new Error("Le propriétaire de l'espace ne peut pas être retiré.");
  }

  const { error } = await service
    .from("nid_workspace_members")
    .update({ status: "retire" })
    .eq("id", memberId);
  if (error) throw new Error(dbErrorMessage(error, "Le retrait a échoué."));

  // Les affectations en cours de cette personne sont clôturées.
  if (row.user_id) {
    await service
      .from("nid_assignments")
      .update({ status: "ended", ended_on: new Date().toISOString().slice(0, 10) })
      .eq("workspace_id", workspaceId)
      .eq("holder_user_id", row.user_id)
      .eq("status", "active");
  }

  await recordNidAudit({
    actorUserId: userId,
    action: "workspace.member_removed",
    targetType: "member",
    targetId: memberId,
  });
}
