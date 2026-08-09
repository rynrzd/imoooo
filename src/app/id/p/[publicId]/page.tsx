import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, BadgeCheck, Info, SearchX, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NidPublicFooter } from "@/components/nireo-id/public-footer";
import { NidPublicHeader } from "@/components/nireo-id/public-header";
import { isPublicId } from "@/features/nireo-id/constants";
import { formatShortDate } from "@/features/nireo-id/format";
import { getPublicPreview } from "@/features/nireo-id/server/sharing";
import { nidSignedUrl } from "@/features/nireo-id/server/storage";

/**
 * APERÇU PUBLIC d'un téléphone (permanent, minimal).
 *
 * Tout ce qui est affiché ici provient de `nid_public_preview`, une
 * fonction SQL qui ne renvoie que des champs explicitement listés. Aucun
 * nom, aucune adresse, aucun IMEI complet, aucun document et aucun
 * historique d'accès ne peut atteindre cette page — même par erreur.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aperçu public d’un téléphone",
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <NidPublicHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:py-14">{children}</div>
      </main>
      <NidPublicFooter />
    </div>
  );
}

function NotFoundState({ publicId }: { publicId: string }) {
  return (
    <Shell>
      <div className="nid-panel rounded-lg p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-lg bg-muted text-muted-foreground">
          <SearchX className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-foreground">Aucun téléphone trouvé</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          L’identifiant <span className="font-mono">{publicId}</span> ne
          correspond à aucun téléphone actif. Vérifiez la saisie : un
          identifiant Nireo a la forme <span className="font-mono">NIR-PH-XXXX-XXXX</span>.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button data-touch render={<Link href="/id" />}>
            Revenir à Nireo ID
          </Button>
          <Button variant="outline" data-touch render={<Link href="/id/exemple" />}>
            Voir un exemple
          </Button>
        </div>
      </div>
    </Shell>
  );
}

export default async function PublicPassportPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId: raw } = await params;
  const publicId = decodeURIComponent(raw).trim().toUpperCase().slice(0, 24);

  if (!isPublicId(publicId)) return <NotFoundState publicId={publicId} />;

  const preview = await getPublicPreview(publicId);
  if (!preview) return <NotFoundState publicId={publicId} />;

  const photoUrl = preview.photo_path ? await nidSignedUrl(preview.photo_path) : null;

  return (
    <Shell>
      <div className="nid-panel overflow-hidden rounded-lg">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
          <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted">
            {photoUrl ? (
              <Image
                src={photoUrl}
                alt={`${preview.brand} ${preview.model}`}
                width={96}
                height={96}
                unoptimized
                className="size-full object-cover"
              />
            ) : (
              <Smartphone className="size-8 text-muted-foreground" aria-hidden />
            )}
          </div>

          <div className="min-w-0">
            <p className="font-mono text-xs tracking-wider text-muted-foreground">
              {preview.public_id}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">
              {preview.brand} {preview.model}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {[
                preview.color || null,
                preview.purchase_year ? `Acheté en ${preview.purchase_year}` : null,
                preview.serial_last4 ? `N° de série ••••${preview.serial_last4}` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "Aucune caractéristique rendue publique"}
            </p>
          </div>
        </div>

        {preview.status === "disputed" || preview.events_disputed > 0 ? (
          <div className="flex items-start gap-3 border-t border-border bg-[color-mix(in_srgb,var(--nid-warning)_10%,transparent)] px-6 py-4">
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0 text-[var(--nid-warning)]"
              aria-hidden
            />
            <p className="text-sm text-foreground">
              Une information de ce téléphone est actuellement contestée. Elle
              ne doit pas être considérée comme fiable.
            </p>
          </div>
        ) : null}

        <dl className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-4">
          {[
            { label: "Événements", value: preview.events_total },
            { label: "Validés par un pro", value: preview.events_professional },
            { label: "Propriétaires", value: preview.transfers_count },
            { label: "Contestations", value: preview.events_disputed },
          ].map((item) => (
            <div key={item.label} className="bg-card px-5 py-4">
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="mt-1 text-xl font-semibold text-foreground tabular-nums">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>

        <p className="border-t border-border px-6 py-3 text-xs text-muted-foreground">
          téléphone créé le {formatShortDate(preview.created_at)}.
        </p>
      </div>

      {preview.events_professional > 0 ? (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--nid-success)_35%,transparent)] bg-[color-mix(in_srgb,var(--nid-success)_10%,transparent)] px-4 py-3 text-sm text-foreground">
          <BadgeCheck className="size-4 shrink-0 text-[var(--nid-success)]" aria-hidden />
          {preview.events_professional === 1
            ? "1 intervention a été enregistrée par un professionnel approuvé par Nireo."
            : `${preview.events_professional} interventions ont été enregistrées par des professionnels approuvés par Nireo.`}
        </p>
      ) : null}

      <div className="mt-6 flex items-start gap-3 rounded-lg border border-border bg-card p-5">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="text-sm leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-foreground">Portée de cet aperçu.</strong>{" "}
            Il indique seulement qu’un téléphone existe et combien
            d’événements y figurent. Il ne prouve ni l’identité du vendeur, ni
            l’origine de l’appareil, et Nireo ne vérifie pas si un appareil est
            déclaré volé.
          </p>
          <p className="mt-2">
            Pour consulter le détail (état, historique, documents), demandez au
            propriétaire un <strong className="text-foreground">lien de partage</strong> :
            il est limité dans le temps et révocable.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" data-touch render={<Link href="/id" />}>
          Qu’est-ce que Nireo ID ?
        </Button>
        <Button variant="ghost" data-touch render={<Link href="/id/app" />}>
          J’ai un compte Nireo
        </Button>
      </div>
    </Shell>
  );
}
