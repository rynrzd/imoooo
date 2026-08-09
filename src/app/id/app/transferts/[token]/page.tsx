import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransferDecision } from "@/components/nireo-id/transfer-decision";
import { TRANSFER_STATUS_LABELS } from "@/features/nireo-id/constants";
import { formatDateTime, formatRemaining } from "@/features/nireo-id/format";
import { requireNidSession } from "@/features/nireo-id/server/guards";
import { getTransferByToken } from "@/features/nireo-id/server/transfers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invitation de transfert",
  robots: { index: false, follow: false },
};

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className="nid-panel rounded-2xl p-6 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <AlertTriangle className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-semibold text-foreground">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
      <div className="mt-6">
        <Button render={<Link href="/id/app/transferts" />}>Voir mes transferts</Button>
      </div>
    </div>
  );
}

export default async function TransferInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken);
  const session = await requireNidSession(`/id/app/transferts/${rawToken}`);

  const invitation = await getTransferByToken(token, session.email);

  if (invitation.state === "introuvable") {
    return (
      <Message
        title="Invitation introuvable"
        text="Ce lien n’existe pas ou a été annulé par le vendeur. Demandez-lui d’en générer un nouveau."
      />
    );
  }
  if (invitation.state === "destinataire_different") {
    return (
      <Message
        title="Cette invitation ne vous est pas destinée"
        text={`Elle a été envoyée à une autre adresse e-mail. Connectez-vous avec l’adresse destinataire pour l’accepter (vous êtes actuellement connecté avec ${session.email}).`}
      />
    );
  }
  if (invitation.state === "expire") {
    return (
      <Message
        title="Invitation expirée"
        text="Le délai de validité est dépassé. Demandez au vendeur d’ouvrir un nouveau transfert."
      />
    );
  }
  if (invitation.state === "deja_traite") {
    return (
      <Message
        title="Transfert déjà traité"
        text={`Cette demande est « ${
          invitation.transfer ? TRANSFER_STATUS_LABELS[invitation.transfer.status] : "close"
        } ». Aucune action supplémentaire n’est possible.`}
      />
    );
  }

  const transfer = invitation.transfer!;
  const documentPolicies = Object.values(transfer.options.documents ?? {});
  const transferred = documentPolicies.filter((policy) => policy === "transferable").length;
  const temporary = documentPolicies.filter((policy) => policy === "partage_temporaire").length;

  return (
    <div className="space-y-5">
      <p className="text-sm">
        <Link
          href="/id/app/transferts"
          className="text-muted-foreground underline-offset-2 hover:underline"
        >
          ← Transferts
        </Link>
      </p>

      <div className="nid-panel rounded-2xl p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground">
            <Smartphone className="size-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-foreground">
              {transfer.asset_summary.brand} {transfer.asset_summary.model}
            </h1>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
              {transfer.asset_summary.public_id}
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          Le propriétaire actuel vous transmet ce téléphone. L’invitation
          expire dans {formatRemaining(transfer.expires_at)} (
          {formatDateTime(transfer.expires_at)}).
        </p>

        <section className="mt-5">
          <h2 className="text-sm font-medium text-foreground">Ce que vous recevrez</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            <li>· Les caractéristiques de l’appareil et son identifiant Nireo.</li>
            <li>· L’historique complet, avec le niveau de confiance de chaque information.</li>
            <li>· L’état déclaré et les photos du téléphone.</li>
            <li>
              ·{" "}
              {transferred > 0
                ? `${transferred} document${transferred > 1 ? "s" : ""} transmis définitivement`
                : "Aucun document transmis définitivement"}
              {temporary > 0
                ? `, ${temporary} document${temporary > 1 ? "s" : ""} consultable${
                    temporary > 1 ? "s" : ""
                  } pendant 30 jours`
                : ""}
              .
            </li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Les documents personnels du vendeur (facture à son nom, par
            exemple) restent privés s’il ne les a pas explicitement transmis.
            Nireo ne vérifie ni l’identité du vendeur, ni l’origine de
            l’appareil.
          </p>
        </section>

        <div className="mt-6">
          <TransferDecision token={token} />
        </div>
      </div>
    </div>
  );
}
