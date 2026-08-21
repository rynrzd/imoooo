import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NidPublicFooter } from "@/components/nireo-id/public-footer";
import { NidPublicHeader } from "@/components/nireo-id/public-header";
import { TrustBadge } from "@/components/nireo-id/trust-badge";
import { EVENT_TYPE_LABELS } from "@/features/nireo-id/constants";
import { EXAMPLE_EVENTS, EXAMPLE_PASSPORT } from "@/features/nireo-id/example";
import { formatEventDate } from "@/features/nireo-id/format";

export const metadata: Metadata = {
  title: "Exemple de téléphone",
  description:
    "Démonstration publique d’un téléphone Nireo ID : identifiant, historique et niveaux de confiance. Contenu d’illustration.",
  alternates: { canonical: "/id/exemple" },
};

const SIGNUP_HREF = "/inscription?next=%2Fid%2Fapp%2Fobjets%2Fnouveau";

export default function NireoIdExamplePage() {
  return (
    <div className="flex min-h-svh flex-col">
      <NidPublicHeader />

      <main id="contenu" tabIndex={-1} className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
          {/* Mention non ambiguë, présente en haut de page. */}
          <div
            role="note"
            className="flex items-start gap-3 rounded-lg border border-[color-mix(in_srgb,var(--nid-warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--nid-warning)_10%,transparent)] p-4"
          >
            <Info className="mt-0.5 size-4 shrink-0 text-[var(--nid-warning)]" aria-hidden />
            <p className="text-sm leading-relaxed text-foreground">
              <strong>Ceci est un exemple.</strong> Aucune de ces informations
              ne provient d’un appareil réel : ni l’identifiant, ni les
              réparations, ni le professionnel cité. Cette page montre ce que
              verrait une personne à qui vous partagez un téléphone.
            </p>
          </div>

          <header className="mt-8">
            <p className="font-mono text-xs tracking-wider text-muted-foreground">
              {EXAMPLE_PASSPORT.public_id}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-foreground">
              {EXAMPLE_PASSPORT.brand} {EXAMPLE_PASSPORT.model}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {EXAMPLE_PASSPORT.color} · {EXAMPLE_PASSPORT.storage_capacity} · Acheté neuf en{" "}
              {EXAMPLE_PASSPORT.purchase_year}
            </p>
          </header>

          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Événements", value: EXAMPLE_PASSPORT.events_total },
              { label: "Validés par un pro", value: EXAMPLE_PASSPORT.events_professional },
              { label: "Propriétaires", value: EXAMPLE_PASSPORT.owners },
              { label: "Contestations", value: 0 },
            ].map((item) => (
              <div key={item.label} className="nid-panel rounded-lg p-4">
                <dt className="text-xs text-muted-foreground">{item.label}</dt>
                <dd className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>

          <section className="mt-10">
            <h2 className="text-lg font-semibold text-foreground">Historique</h2>
            <ol className="mt-5 space-y-4">
              {EXAMPLE_EVENTS.map((event) => (
                <li key={event.title} className="nid-panel relative rounded-lg p-5 pl-6">
                  <span
                    aria-hidden
                    className="absolute top-6 left-0 h-8 w-1 rounded-r-full bg-primary/70"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-semibold text-foreground">{event.title}</h3>
                    <TrustBadge level={event.trust_level} variant="full" />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {EVENT_TYPE_LABELS[event.type]} · {formatEventDate(event.date)} · {event.author}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {event.description}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-10 rounded-lg border border-border bg-card p-6">
            <h2 className="text-base font-semibold text-foreground">
              Ce qu’un visiteur ne voit jamais
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Le nom, l’adresse ou l’e-mail du propriétaire.</li>
              <li>L’IMEI ou le numéro de série complet.</li>
              <li>Les factures et documents privés, sauf partage explicite et limité dans le temps.</li>
              <li>L’historique des accès et des liens de partage.</li>
            </ul>
          </section>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" data-touch render={<Link href={SIGNUP_HREF} />}>
              Créer mon téléphone
              <ArrowRight className="size-4" data-icon="inline-end" />
            </Button>
            <Button variant="outline" size="lg" data-touch render={<Link href="/id#confiance" />}>
              Comprendre les niveaux de confiance
            </Button>
          </div>
        </div>
      </main>

      <NidPublicFooter />
    </div>
  );
}
