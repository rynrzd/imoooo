import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MembersManager } from "@/components/nireo-id/members-manager";
import { requireNidSession } from "@/features/nireo-id/server/guards";
import {
  canAdminister,
  getWorkspaceContext,
  listInvites,
  listMembers,
} from "@/features/nireo-id/server/workspaces";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Collaborateurs" };

export default async function CompanyMembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireNidSession(`/id/entreprise/${id}/collaborateurs`);
  const context = await getWorkspaceContext(session.user.id, id);
  if (!context) notFound();

  // L'accès à cette page est réservé aux rôles d'administration : la RLS
  // et les Server Actions appliquent la même règle.
  if (!canAdminister(context.role)) {
    return (
      <div className="nid-panel rounded-lg p-5">
        <h1 className="font-medium text-foreground">Accès réservé</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Seuls le propriétaire et les administrateurs de cet espace peuvent gérer les
          collaborateurs.
        </p>
      </div>
    );
  }

  const [members, invites] = await Promise.all([listMembers(id), listInvites(id)]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Collaborateurs</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Les salariés qui doivent seulement répondre au bilan de leur téléphone n’ont pas besoin
          de créer un compte : leur nom et leur adresse suffisent.
        </p>
      </header>

      <MembersManager workspaceId={id} members={members} invites={invites} />
    </div>
  );
}
