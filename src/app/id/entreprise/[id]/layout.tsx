import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NidLogo } from "@/components/nireo-id/nid-logo";
import { WorkspaceNav } from "@/components/nireo-id/workspace-nav";
import { WorkspaceSwitcher } from "@/components/nireo-id/workspace-switcher";
import { WORKSPACE_ROLE_LABELS } from "@/features/nireo-id/constants";
import { nidPlan } from "@/features/nireo-id/plans";
import { requireNidSession } from "@/features/nireo-id/server/guards";
import {
  getWorkspaceContext,
  listWorkspaces,
} from "@/features/nireo-id/server/workspaces";

export const metadata: Metadata = {
  title: { default: "Entreprise", template: "%s · Nireo ID" },
  robots: { index: false, follow: false },
};

/**
 * Espace entreprise : parc, affectations, bilans, réparations.
 * L'appartenance et le rôle sont relus en base à chaque requête.
 */
export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireNidSession(`/id/entreprise/${id}`);

  const context = await getWorkspaceContext(session.user.id, id);
  // Espace inexistant ou dont l'utilisateur n'est pas membre : même réponse.
  if (!context || context.workspace.kind !== "entreprise") notFound();

  const spaces = await listWorkspaces(session.user.id);
  const plan = nidPlan(context.workspace.plan);

  return (
    <div className="min-h-svh bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-16 items-center px-5">
          <NidLogo href="/id/app" />
        </div>
        <div className="px-3 pb-3">
          <WorkspaceSwitcher
            items={spaces.map((item) => ({
              id: item.workspace.id,
              name:
                item.workspace.kind === "personnel" ? "Espace personnel" : item.workspace.name,
              kind: item.workspace.kind,
            }))}
            activeId={context.workspace.id}
          />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <WorkspaceNav workspaceId={context.workspace.id} role={context.role} />
        </div>
        <div className="border-t border-border px-5 py-4">
          <p className="text-xs text-muted-foreground">{WORKSPACE_ROLE_LABELS[context.role]}</p>
          <Link
            href={`/id/app/abonnement?espace=${context.workspace.id}`}
            className="mt-0.5 inline-block text-xs text-primary underline underline-offset-2"
          >
            Offre {plan.label}
          </Link>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-card px-4 lg:hidden">
        <NidLogo href="/id/app" size="sm" />
        <WorkspaceSwitcher
          items={spaces.map((item) => ({
            id: item.workspace.id,
            name: item.workspace.kind === "personnel" ? "Espace personnel" : item.workspace.name,
            kind: item.workspace.kind,
          }))}
          activeId={context.workspace.id}
          className="max-w-[60%] flex-1"
        />
      </header>

      <div className="border-b border-border bg-card lg:hidden">
        <div className="nid-scroll-x px-2 py-2">
          <WorkspaceNav
            workspaceId={context.workspace.id}
            role={context.role}
            orientation="horizontal"
          />
        </div>
      </div>

      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>

      <p className="pb-8 text-center text-xs text-muted-foreground lg:pl-64">
        <Link href="/id/app" className="underline underline-offset-2">
          Revenir à mon espace personnel
        </Link>
      </p>
    </div>
  );
}
