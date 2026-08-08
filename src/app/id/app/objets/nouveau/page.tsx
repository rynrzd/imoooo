import type { Metadata } from "next";
import { CreateWizard } from "@/components/nireo-id/create-wizard";
import { requireNidSession } from "@/features/nireo-id/server/guards";

export const metadata: Metadata = {
  title: "Nouveau passeport",
  robots: { index: false, follow: false },
};

export default async function NewAssetPage() {
  await requireNidSession("/id/app/objets/nouveau");
  return <CreateWizard />;
}
