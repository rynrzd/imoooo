import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CHECK_ANSWER_SHORT,
  CHECK_EMAIL_STATUS_LABELS,
  type CheckEmailStatus,
} from "@/features/nireo-id/constants";
import { getWorkspaceCheckBoard, listCampaigns } from "@/features/nireo-id/server/checkups";
import { requireNidSession } from "@/features/nireo-id/server/guards";
import { getWorkspaceContext } from "@/features/nireo-id/server/workspaces";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Bilans" };

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString("fr-FR");
}

export default async function CompanyChecksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireNidSession(`/id/entreprise/${id}/bilans`);
  const context = await getWorkspaceContext(session.user.id, id);
  if (!context) notFound();

  const [board, campaigns] = await Promise.all([getWorkspaceCheckBoard(id), listCampaigns(id)]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Bilans</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Un salarié reçoit uniquement le bilan du téléphone qui lui est affecté. Il ne voit ni le
          parc, ni les factures, ni les coûts, ni les autres salariés.
        </p>
        <p className="mt-3 text-sm">
          <Link href={`/id/entreprise/${id}/parc`} className="text-primary underline underline-offset-2">
            Sélectionner des téléphones dans le parc pour lancer une campagne
          </Link>
        </p>
      </header>

      <section className="nid-panel rounded-lg p-5">
        <h2 className="font-medium text-foreground">
          En retard <span className="text-muted-foreground">({board.overdue.length})</span>
        </h2>
        {board.overdue.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Aucun bilan en retard.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border text-sm">
            {board.overdue.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className="min-w-0 flex-1 truncate text-foreground">{request.device}</span>
                <span className="text-xs text-muted-foreground">{request.recipient_email}</span>
                <span className="text-xs text-[var(--nid-warning)]">
                  Échéance {formatDate(request.due_on)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {CHECK_EMAIL_STATUS_LABELS[request.email_status as CheckEmailStatus]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="nid-panel rounded-lg p-5">
        <h2 className="font-medium text-foreground">
          Envoyés, en attente de réponse{" "}
          <span className="text-muted-foreground">({board.upcoming.length})</span>
        </h2>
        {board.upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Aucun bilan en attente.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border text-sm">
            {board.upcoming.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className="min-w-0 flex-1 truncate text-foreground">{request.device}</span>
                <span className="text-xs text-muted-foreground">{request.recipient_email}</span>
                <span className="text-xs text-muted-foreground">
                  Échéance {formatDate(request.due_on)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {CHECK_EMAIL_STATUS_LABELS[request.email_status as CheckEmailStatus]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="nid-panel rounded-lg p-5">
        <h2 className="font-medium text-foreground">
          Problèmes déclarés <span className="text-muted-foreground">({board.problems.length})</span>
        </h2>
        {board.problems.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Aucun problème signalé.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border text-sm">
            {board.problems.map((checkup) => (
              <li key={checkup.id} className="py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/id/app/objets/${checkup.asset_id}`}
                    className="min-w-0 flex-1 truncate text-foreground underline-offset-2 hover:underline"
                  >
                    {checkup.device}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(checkup.answered_at)}
                  </span>
                </div>
                {checkup.comment ? (
                  <p className="mt-1 text-xs text-muted-foreground">{checkup.comment}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="nid-panel rounded-lg p-5">
        <h2 className="font-medium text-foreground">
          Réponses reçues <span className="text-muted-foreground">({board.answered.length})</span>
        </h2>
        {board.answered.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Aucune réponse pour le moment.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border text-sm">
            {board.answered.slice(0, 30).map((checkup) => (
              <li key={checkup.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className="min-w-0 flex-1 truncate text-foreground">{checkup.device}</span>
                <span className="text-xs text-foreground">
                  {CHECK_ANSWER_SHORT[checkup.answer]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(checkup.answered_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {campaigns.length > 0 ? (
        <section className="nid-panel rounded-lg p-5">
          <h2 className="font-medium text-foreground">Campagnes</h2>
          <ul className="mt-3 divide-y divide-border text-sm">
            {campaigns.map((campaign) => (
              <li key={campaign.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className="min-w-0 flex-1 truncate text-foreground">{campaign.label}</span>
                <span className="text-xs text-muted-foreground">
                  {campaign.sent} envoyé{campaign.sent > 1 ? "s" : ""} · {campaign.manual} lien
                  {campaign.manual > 1 ? "s" : ""} manuel{campaign.manual > 1 ? "s" : ""} ·{" "}
                  {campaign.failed} ignoré{campaign.failed > 1 ? "s" : ""}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(campaign.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
