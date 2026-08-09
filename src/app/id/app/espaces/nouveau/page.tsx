import type { Metadata } from "next";
import Link from "next/link";
import { WorkspaceCreateForm } from "@/components/nireo-id/workspace-create-form";
import { requireNidSession } from "@/features/nireo-id/server/guards";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Créer un espace" };

export default async function NewWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  await requireNidSession("/id/app/espaces/nouveau");
  const params = await searchParams;
  const initialKind = params.type === "atelier" ? "atelier" : "entreprise";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Créer un espace</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Un espace regroupe des téléphones et des personnes. Vous pouvez appartenir à plusieurs
          espaces avec le même compte.
        </p>
      </header>

      <WorkspaceCreateForm initialKind={initialKind} />

      <p>
        <Link href="/id/app" className="text-sm text-primary underline underline-offset-2">
          Revenir à mon espace personnel
        </Link>
      </p>
    </div>
  );
}
