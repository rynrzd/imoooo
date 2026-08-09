import { redirect } from "next/navigation";
import { requireNidSession } from "@/features/nireo-id/server/guards";
import { listWorkspaces } from "@/features/nireo-id/server/workspaces";

export const dynamic = "force-dynamic";

/** Raccourci : ouvre la première entreprise, ou propose d'en créer une. */
export default async function CompanyIndexPage() {
  const session = await requireNidSession("/id/entreprise");
  const spaces = await listWorkspaces(session.user.id);
  const company = spaces.find((item) => item.workspace.kind === "entreprise");

  if (company) redirect(`/id/entreprise/${company.workspace.id}`);
  redirect("/id/app/espaces/nouveau?type=entreprise");
}
