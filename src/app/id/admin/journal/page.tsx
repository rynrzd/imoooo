import type { Metadata } from "next";
import { formatDateTime } from "@/features/nireo-id/format";
import { listAuditLogs } from "@/features/nireo-id/server/admin";
import { requireNidAdminPage } from "@/features/nireo-id/server/guards";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Journal d’audit" };

/** Libellés français des actions journalisées. */
const ACTION_LABELS: Record<string, string> = {
  "asset.created": "Création d’un passeport",
  "event.declared": "Événement déclaré",
  "event.professional_added": "Intervention professionnelle",
  "event.revoked": "Révocation d’un événement",
  "document.added": "Ajout d’un document",
  "document.deleted": "Suppression d’un document",
  "share.created": "Création d’un lien de partage",
  "share.revoked": "Révocation d’un lien",
  "share.viewed": "Consultation d’un lien",
  "transfer.created": "Ouverture d’un transfert",
  "transfer.accepted": "Transfert accepté",
  "transfer.declined": "Transfert refusé",
  "transfer.cancelled": "Transfert annulé",
  "dispute.reported": "Signalement déposé",
  "professional.application_submitted": "Candidature professionnelle",
  "professional.application_updated": "Candidature mise à jour",
  "professional.access_requested": "Demande d’accès professionnel",
  "professional.access_accorde": "Accès professionnel accordé",
  "professional.access_refuse": "Accès professionnel refusé",
  "professional.access_revoque": "Accès professionnel révoqué",
  "professional.invited": "Professionnel invité",
  "admin.professional_approuve": "Compte professionnel approuvé",
  "admin.professional_refuse": "Compte professionnel refusé",
  "admin.professional_suspendu": "Compte professionnel suspendu",
  "admin.dispute_en_examen": "Signalement mis en examen",
  "admin.dispute_resolu": "Signalement résolu",
  "admin.dispute_rejete": "Signalement rejeté",
};

const ROLE_LABELS: Record<string, string> = {
  utilisateur: "Utilisateur",
  professionnel: "Professionnel",
  administrateur: "Administrateur",
  systeme: "Système",
};

export default async function AdminAuditPage() {
  await requireNidAdminPage();
  const logs = await listAuditLogs(150);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Journal d’audit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Journal append-only : aucune ligne ne peut être modifiée ni
          supprimée, y compris par le serveur. Il ne contient ni contenu de
          document, ni jeton, ni secret.
        </p>
      </header>

      {logs.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Aucune action journalisée pour le moment.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[38rem] text-sm">
            <thead className="bg-muted/60 text-left">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium text-muted-foreground">
                  Date
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium text-muted-foreground">
                  Action
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium text-muted-foreground">
                  Acteur
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium text-muted-foreground">
                  Cible
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground tabular-nums">
                    {formatDateTime(log.created_at)}
                  </td>
                  <td className="px-4 py-2.5 text-foreground">
                    {ACTION_LABELS[log.action] ?? log.action}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {ROLE_LABELS[log.actor_role] ?? log.actor_role}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {log.target_type || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
