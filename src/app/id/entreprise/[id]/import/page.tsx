import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CsvImport } from "@/components/nireo-id/csv-import";
import { planHasEntitlement } from "@/features/nireo-id/plans";
import { requireNidSession } from "@/features/nireo-id/server/guards";
import { canManageFleet, getWorkspaceContext } from "@/features/nireo-id/server/workspaces";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Importer un parc" };

export default async function CompanyImportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireNidSession(`/id/entreprise/${id}/import`);
  const context = await getWorkspaceContext(session.user.id, id);
  if (!context || !canManageFleet(context.role)) notFound();

  const allowed = planHasEntitlement(context.workspace.plan, "import_csv");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Importer un parc</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Vérifiez l’aperçu avant de valider. Aucune ligne n’est écrite tant que vous n’avez pas
          confirmé.
        </p>
      </header>

      {allowed ? (
        <CsvImport workspaceId={id} />
      ) : (
        <div className="nid-panel rounded-2xl p-5">
          <p className="text-sm text-foreground">
            L’import CSV est inclus à partir de l’offre Entreprise Équipe.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Avec votre offre actuelle, vous pouvez ajouter les téléphones un par un depuis le parc.
          </p>
          <p className="mt-3 text-sm">
            <Link
              href={`/id/entreprise/${id}/parc`}
              className="text-primary underline underline-offset-2"
            >
              Revenir au parc
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
