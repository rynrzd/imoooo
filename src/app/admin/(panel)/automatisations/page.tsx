import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AutomationEditor } from "@/components/admin/emails/automation-editor";
import { saveAutomation, sendAutomationTest } from "@/lib/admin/actions/automations";
import { formatAdminDateTime } from "@/lib/admin/format";
import {
  AUTOMATION_DEFAULTS,
  AUTOMATION_KINDS,
  getAutomations,
  getAutomationStats,
} from "@/lib/email/automations";
import { isEmailConfigured } from "@/lib/email/provider";

export const metadata: Metadata = { title: "Automatisations" };
export const dynamic = "force-dynamic";

/**
 * /admin/automatisations — les quatre e-mails que Nireo envoie tout seul.
 *
 * Volontairement une LISTE et non un constructeur de scénarios : chaque
 * ligne dit ce qui la déclenche, si elle est active, combien de fois elle
 * s'est exécutée et si elle a échoué. Les compteurs viennent de
 * `email_logs` — une automatisation qui n'a jamais tourné affiche zéro.
 */
export default async function AdminAutomationsPage() {
  const [config, stats] = await Promise.all([getAutomations(), getAutomationStats()]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Automatisations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Les e-mails envoyés sans intervention. Le texte se modifie ici ; le moment de
          l’envoi, lui, reste défini par l’événement qui le déclenche.
        </p>
      </div>

      {!isEmailConfigured ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-destructive/10 p-3 text-sm text-destructive ring-1 ring-destructive/20">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            Aucun fournisseur e-mail n’est configuré : ces automatisations sont enregistrées
            mais aucune ne peut envoyer quoi que ce soit.
          </p>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <ul className="divide-y divide-border">
          {AUTOMATION_KINDS.map((kind) => {
            const definition = AUTOMATION_DEFAULTS[kind];
            const current = config[kind];
            const stat = stats[kind];
            return (
              <li key={kind} className="flex flex-wrap items-start gap-x-4 gap-y-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-medium">{definition.name}</h2>
                    {current.enabled ? (
                      <Badge variant="secondary">Active</Badge>
                    ) : (
                      <Badge variant="outline">Désactivée</Badge>
                    )}
                    {stat.failed > 0 ? (
                      <Badge variant="destructive">
                        {stat.failed} échec{stat.failed > 1 ? "s" : ""}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{definition.trigger}</p>
                  <p className="mt-2 truncate text-sm">{current.subject}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stat.sent} envoi{stat.sent > 1 ? "s" : ""} ·{" "}
                    {stat.lastSentAt
                      ? `dernier le ${formatAdminDateTime(stat.lastSentAt)}`
                      : "jamais exécutée"}
                  </p>
                  {stat.lastError ? (
                    <p className="mt-1 text-xs text-destructive">
                      Dernière erreur : {stat.lastError}
                    </p>
                  ) : null}
                </div>
                <AutomationEditor
                  kind={kind}
                  name={definition.name}
                  trigger={definition.trigger}
                  enabled={current.enabled}
                  subject={current.subject}
                  body={current.body}
                  ctaLabel={definition.cta?.label ?? null}
                  save={saveAutomation}
                  sendTest={sendAutomationTest}
                />
              </li>
            );
          })}
        </ul>
      </div>

      <div className="max-w-3xl rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="text-sm font-medium">Ce que ces automatisations ne font pas</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>
            <strong className="font-medium text-foreground">Aucun envoi différé.</strong> Un
            e-mail « deux jours après l’inscription » suppose une file d’attente
            persistante et une tâche planifiée qui la vide : il faudrait une table
            supplémentaire. Plutôt qu’un champ « délai » qui ne serait pas respecté, il n’y
            a pas de champ.
          </li>
          <li>
            <strong className="font-medium text-foreground">Aucun déclencheur
            modifiable.</strong> Le moment de l’envoi est fixé dans le code, là où
            l’événement est certain : confirmation réelle du compte, webhook Stripe signé.
          </li>
          <li>
            Chaque envoi laisse une trace dans{" "}
            <Link
              href="/admin/emails"
              className="underline underline-offset-2 hover:text-foreground"
            >
              l’historique des e-mails
            </Link>
            , succès comme échec.
          </li>
        </ul>
      </div>
    </div>
  );
}
