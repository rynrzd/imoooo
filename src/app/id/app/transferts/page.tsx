import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, Inbox, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/nireo-id/action-button";
import { cancelTransferAction } from "@/features/nireo-id/actions/owner";
import { TRANSFER_STATUS_LABELS } from "@/features/nireo-id/constants";
import { formatDateTime, formatRemaining } from "@/features/nireo-id/format";
import { requireNidSession } from "@/features/nireo-id/server/guards";
import { listTransfers } from "@/features/nireo-id/server/transfers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Transferts",
  robots: { index: false, follow: false },
};

export default async function TransfersPage() {
  const session = await requireNidSession("/id/app/transferts");
  const { sent, received } = await listTransfers(session.email);

  const pendingReceived = received.filter((transfer) => transfer.status === "en_attente");
  const historyReceived = received.filter((transfer) => transfer.status !== "en_attente");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Transferts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Les passeports que vous cédez et ceux que l’on vous transmet.
        </p>
      </header>

      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Inbox className="size-4 text-primary" aria-hidden />
          Reçus
        </h2>

        {pendingReceived.length === 0 && historyReceived.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Aucun transfert reçu. Lorsqu’un vendeur vous transmet un passeport,
            il apparaît ici — et vous recevez un e-mail si le service d’envoi
            est configuré.
          </p>
        ) : null}

        {pendingReceived.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {pendingReceived.map((transfer) => (
              <li key={transfer.id} className="nid-panel nid-topline rounded-2xl p-5">
                <p className="text-[15px] font-semibold text-foreground">
                  {transfer.asset_summary.brand} {transfer.asset_summary.model}
                </p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {transfer.asset_summary.public_id}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  En attente de votre réponse — expire dans{" "}
                  {formatRemaining(transfer.expires_at)}.
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  Ouvrez l’invitation que le vendeur vous a transmise (lien ou
                  e-mail) pour accepter ou refuser ce transfert.
                </p>
              </li>
            ))}
          </ul>
        ) : null}

        {historyReceived.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {historyReceived.map((transfer) => (
              <li
                key={transfer.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {transfer.asset_summary.brand} {transfer.asset_summary.model}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {TRANSFER_STATUS_LABELS[transfer.status]}
                    {transfer.responded_at ? ` le ${formatDateTime(transfer.responded_at)}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Send className="size-4 text-primary" aria-hidden />
          Envoyés
        </h2>

        {sent.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">
              Vous n’avez encore transmis aucun passeport. Le transfert
              s’ouvre depuis la fiche d’un smartphone.
            </p>
            <Button variant="outline" className="mt-4" render={<Link href="/id/app" />}>
              <ArrowLeftRight className="size-4" data-icon="inline-start" />
              Voir mes smartphones
            </Button>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {sent.map((transfer) => (
              <li key={transfer.id} className="nid-panel rounded-2xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {transfer.asset_summary.brand} {transfer.asset_summary.model}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Vers {transfer.recipient_email} ·{" "}
                      {TRANSFER_STATUS_LABELS[transfer.status]}
                      {transfer.status === "en_attente"
                        ? ` · expire dans ${formatRemaining(transfer.expires_at)}`
                        : transfer.responded_at
                          ? ` le ${formatDateTime(transfer.responded_at)}`
                          : ""}
                    </p>
                  </div>

                  {transfer.status === "en_attente" ? (
                    <ActionButton
                      action={cancelTransferAction}
                      fields={{ transfer_id: transfer.id }}
                      label="Annuler"
                      pendingLabel="Annulation…"
                      confirmMessage="Annuler ce transfert ? L'invitation cessera immédiatement de fonctionner."
                      successMessage="Transfert annulé."
                    />
                  ) : null}
                </div>

                {transfer.status === "accepte" ? (
                  <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                    Reçu de transfert — vous n’êtes plus propriétaire de ce
                    passeport et vous n’avez pas accès aux données ajoutées
                    depuis par son nouveau propriétaire.
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
