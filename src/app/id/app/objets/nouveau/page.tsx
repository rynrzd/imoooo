import type { Metadata } from "next";
import { CreateWizard } from "@/components/nireo-id/create-wizard";
import { requireNidSession } from "@/features/nireo-id/server/guards";
import { canManageFleet, getWorkspaceContext } from "@/features/nireo-id/server/workspaces";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ajouter mon téléphone",
  robots: { index: false, follow: false },
};

/**
 * Ajout d'un téléphone. Le paramètre `espace` cible un parc d'entreprise :
 * l'appartenance et le rôle sont revérifiés ici ET dans la Server Action.
 */
export default async function NewAssetPage({
  searchParams,
}: {
  searchParams: Promise<{ espace?: string }>;
}) {
  const session = await requireNidSession("/id/app/objets/nouveau");
  const { espace } = await searchParams;

  let workspaceId: string | null = null;
  let workspaceName: string | null = null;

  if (espace) {
    const context = await getWorkspaceContext(session.user.id, espace);
    if (context && canManageFleet(context.role) && context.workspace.kind !== "personnel") {
      workspaceId = context.workspace.id;
      workspaceName = context.workspace.name;
    }
  }

  return <CreateWizard workspaceId={workspaceId} workspaceName={workspaceName} />;
}
