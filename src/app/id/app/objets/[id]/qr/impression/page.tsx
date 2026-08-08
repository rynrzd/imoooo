import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { PrintButton } from "@/components/nireo-id/print-button";
import { getAssetDetail } from "@/features/nireo-id/server/assets";
import { requireNidSession } from "@/features/nireo-id/server/guards";
import { publicUrl } from "@/features/nireo-id/server/sharing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Étiquette QR à imprimer",
  robots: { index: false, follow: false },
};

export default async function QrPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireNidSession(`/id/app/objets/${id}/qr/impression`);

  const detail = await getAssetDetail(id);
  if (!detail) notFound();

  const target = publicUrl(detail.asset.public_id);
  const svg = await QRCode.toString(target, {
    type: "svg",
    margin: 1,
    width: 360,
    errorCorrectionLevel: "M",
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/id/app/objets/${id}/qr`}
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          ← Retour au QR code
        </Link>
        <PrintButton label="Imprimer l’étiquette" />
      </div>

      <article className="mx-auto w-full max-w-md rounded-2xl border border-border bg-white p-8 text-center text-[#0B1220] print:border-0 print:p-0 print:shadow-none">
        <p className="text-sm font-semibold tracking-tight">
          Nireo <span className="rounded bg-[#E6F7F4] px-1.5 py-0.5 text-[11px] text-[#087F73]">ID</span>
        </p>
        <p className="mt-4 text-lg font-semibold">
          {detail.asset.brand} {detail.asset.model}
        </p>
        <div
          className="mx-auto mt-4 w-fit [&_svg]:size-64"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <p className="mt-4 font-mono text-sm tracking-wider">{detail.asset.public_id}</p>
        <p className="mt-2 text-xs text-[#667085]">
          Scannez pour consulter l’aperçu public de ce passeport. Aucune donnée
          personnelle n’y figure.
        </p>
        <p className="mt-1 text-[10px] break-all text-[#667085]">{target}</p>
      </article>
    </div>
  );
}
