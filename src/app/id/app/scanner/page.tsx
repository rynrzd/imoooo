import type { Metadata } from "next";
import { IdentifierScanner } from "@/components/nireo-id/identifier-scanner";
import { requireNidSession } from "@/features/nireo-id/server/guards";

export const metadata: Metadata = {
  title: "Rechercher un téléphone",
  robots: { index: false, follow: false },
};

export default async function ScannerPage() {
  await requireNidSession("/id/app/scanner");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Rechercher un téléphone</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Saisissez un identifiant Nireo ou scannez un QR code. S’il s’agit
          d’un de vos téléphones, vous arrivez sur son dossier privé ; sinon,
          sur son aperçu public minimal.
        </p>
      </header>

      <IdentifierScanner />
    </div>
  );
}
