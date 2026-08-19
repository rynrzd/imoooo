import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, MailCheck, MailX, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { EmailComposer } from "@/components/admin/emails/email-composer";
import { TemplateEditor } from "@/components/admin/emails/template-editor";
import { StatCard } from "@/components/admin/stat-card";
import {
  deleteEmailTemplate,
  duplicateEmailTemplate,
  saveEmailTemplate,
  searchRecipientsAction,
  sendAdminEmail,
} from "@/lib/admin/actions/emails";
import {
  EMAIL_ORIGIN_LABELS,
  emailKindLabel,
  emailKindOrigin,
  getEmailOverview,
  getEmailTemplates,
  getRecipient,
  listEmailLogs,
  type EmailView,
} from "@/lib/admin/emails";
import { formatAdminDateTime } from "@/lib/admin/format";
import { isEmailConfigured } from "@/lib/email/provider";

export const metadata: Metadata = { title: "Emails" };
export const dynamic = "force-dynamic";

const PER_PAGE = 25;

const VIEWS: { id: EmailView | "modeles"; label: string }[] = [
  { id: "tous", label: "Tous" },
  { id: "envoyes", label: "Envoyés" },
  { id: "automatiques", label: "Automatiques" },
  { id: "modeles", label: "Modèles" },
];

function isHistoryView(view: string): view is EmailView {
  return view === "tous" || view === "envoyes" || view === "automatiques";
}

/**
 * /admin/emails — écrire à un client, retrouver ce qui est parti.
 *
 * L'historique est la table `email_logs` telle quelle : tout e-mail que
 * Nireo envoie y passe déjà. Rien n'est reconstitué ni estimé — un envoi
 * absent de la table est un envoi qui n'a pas eu lieu, et un échec s'affiche
 * comme un échec, avec le message du fournisseur.
 */
export default async function AdminEmailsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawView = typeof params.vue === "string" ? params.vue : "tous";
  const view = VIEWS.some((v) => v.id === rawView) ? rawView : "tous";
  const q = typeof params.q === "string" ? params.q : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);
  // Depuis la fiche d'un client : « Envoyer un e-mail » pré-remplit le
  // destinataire au lieu de le faire rechercher une seconde fois.
  const preselect = typeof params.a === "string" ? params.a : "";

  const [overview, templates, recipient] = await Promise.all([
    getEmailOverview(),
    getEmailTemplates(),
    preselect ? getRecipient(preselect).catch(() => null) : Promise.resolve(null),
  ]);

  const history = isHistoryView(view)
    ? await listEmailLogs({ view, q, page, perPage: PER_PAGE })
    : { items: [], total: 0 };
  const pageCount = Math.max(1, Math.ceil(history.total / PER_PAGE));

  const viewHref = (id: string, p = 1) => {
    const sp = new URLSearchParams();
    if (id !== "tous") sp.set("vue", id);
    if (q) sp.set("q", q);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `/admin/emails${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Emails</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Écrire à un client et retrouver tout ce qui lui a été envoyé.
          </p>
        </div>
        <EmailComposer
          key={recipient?.id ?? "vide"}
          templates={templates}
          initialRecipient={recipient}
          defaultOpen={Boolean(recipient)}
          canSend={isEmailConfigured}
          search={searchRecipientsAction}
          send={sendAdminEmail}
        />
      </div>

      {!isEmailConfigured ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-destructive/10 p-3 text-sm text-destructive ring-1 ring-destructive/20">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            Aucun fournisseur e-mail n’est configuré sur ce serveur. Les envois — manuels
            comme automatiques — sont impossibles tant que <code>EMAIL_PROVIDER</code>,
            l’expéditeur et la clé du fournisseur ne sont pas renseignés dans les variables
            d’environnement.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Envoyés (30 jours)"
          value={String(overview.sent30d)}
          icon={MailCheck}
        />
        <StatCard
          label="Échecs (30 jours)"
          value={String(overview.failed30d)}
          hint={overview.failed30d > 0 ? "Voir le détail dans l’historique" : undefined}
          icon={MailX}
        />
        <StatCard
          label="Dernier envoi"
          value={overview.lastSentAt ? formatAdminDateTime(overview.lastSentAt) : "—"}
          icon={Send}
        />
      </div>

      {/* Onglets = liens : l'URL décrit ce qu'on regarde, elle se partage. */}
      <nav className="flex flex-wrap gap-1" aria-label="Vues des e-mails">
        {VIEWS.map((item) => {
          const active = item.id === view;
          return (
            <Link
              key={item.id}
              href={viewHref(item.id)}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "rounded-lg bg-accent px-2.5 py-1.5 text-sm font-medium text-foreground"
                  : "rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground [transition-property:color,background-color] [transition-duration:var(--mo-micro)] [transition-timing-function:var(--mo-ease)] hover:bg-accent/60 hover:text-foreground motion-reduce:transition-none"
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {view === "modeles" ? (
        <TemplatesPanel templates={templates} />
      ) : (
        <>
          <form className="flex flex-wrap items-center gap-2" action="/admin/emails" method="get">
            {view !== "tous" ? <input type="hidden" name="vue" value={view} /> : null}
            <Input
              name="q"
              defaultValue={q}
              placeholder="Rechercher (destinataire, sujet)…"
              className="w-full sm:w-72"
            />
            <Button type="submit" variant="outline" size="sm">
              Rechercher
            </Button>
            {q ? (
              <Link
                href={viewHref(view)}
                className="text-sm text-muted-foreground underline-offset-2 hover:underline"
              >
                Effacer
              </Link>
            ) : null}
          </form>

          <HistoryList items={history.items} total={history.total} />

          {pageCount > 1 ? (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {page} / {pageCount}
              </span>
              <div className="flex gap-3">
                {page > 1 ? (
                  <Link
                    href={viewHref(view, page - 1)}
                    className="underline-offset-2 hover:underline"
                  >
                    ← Précédente
                  </Link>
                ) : null}
                {page < pageCount ? (
                  <Link
                    href={viewHref(view, page + 1)}
                    className="underline-offset-2 hover:underline"
                  >
                    Suivante →
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Historique                                                          */
/* ------------------------------------------------------------------ */

/**
 * Une liste et non un tableau : sur un téléphone, cinq colonnes deviennent
 * illisibles, et l'information utile ici (à qui, quoi, quand, quel statut)
 * tient naturellement en deux lignes.
 */
function HistoryList({
  items,
  total,
}: {
  items: Awaited<ReturnType<typeof listEmailLogs>>["items"];
  total: number;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl bg-card p-8 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
        Aucun e-mail à afficher.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <ul className="divide-y divide-border">
        {items.map((item) => {
          const origin = emailKindOrigin(item.kind);
          return (
            <li key={item.id} className="flex flex-wrap items-start gap-x-3 gap-y-1.5 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.subject}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.full_name ? `${item.full_name} · ` : ""}
                  {item.recipient}
                </p>
                {item.status === "failed" && item.error ? (
                  <p className="mt-1 text-xs text-destructive">{item.error}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                <Badge variant="outline">{emailKindLabel(item.kind)}</Badge>
                <Badge variant="outline">{EMAIL_ORIGIN_LABELS[origin]}</Badge>
                {item.status === "sent" ? (
                  <Badge variant="secondary">Envoyé</Badge>
                ) : (
                  <Badge variant="destructive">Échec</Badge>
                )}
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatAdminDateTime(item.created_at)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
        {total} e-mail{total > 1 ? "s" : ""} enregistré{total > 1 ? "s" : ""}.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modèles                                                             */
/* ------------------------------------------------------------------ */

function TemplatesPanel({
  templates,
}: {
  templates: Awaited<ReturnType<typeof getEmailTemplates>>;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {templates.length} modèle{templates.length > 1 ? "s" : ""} — proposés au moment de
          la rédaction.
        </p>
        <TemplateEditor
          save={saveEmailTemplate}
          triggerLabel="Nouveau modèle"
          triggerVariant="default"
        />
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl bg-card p-8 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          Aucun modèle pour l’instant.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <ul className="divide-y divide-border">
            {templates.map((template) => (
              <li
                key={template.id}
                className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{template.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{template.subject}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/80">
                    {template.body}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <TemplateEditor
                    template={template}
                    save={saveEmailTemplate}
                    triggerLabel="Modifier"
                  />
                  <ConfirmAction
                    label="Dupliquer"
                    title="Dupliquer ce modèle"
                    description={`Une copie de « ${template.name} » sera créée.`}
                    confirmLabel="Dupliquer"
                    action={duplicateEmailTemplate.bind(null, template.id)}
                  />
                  <ConfirmAction
                    label="Supprimer"
                    title="Supprimer ce modèle"
                    description={`« ${template.name} » sera définitivement supprimé. Les e-mails déjà envoyés ne sont pas affectés.`}
                    confirmLabel="Supprimer"
                    variant="destructive"
                    action={deleteEmailTemplate.bind(null, template.id)}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
