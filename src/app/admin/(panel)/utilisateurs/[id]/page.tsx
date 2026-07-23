import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { UserNoteForm } from "@/components/admin/user-note-form";
import { UserPlanForm } from "@/components/admin/user-plan-form";
import { Badge } from "@/components/ui/badge";
import {
  addUserNote,
  banUser,
  changeUserPlan,
  deleteUserAccount,
  reactivateUser,
  suspendUser,
} from "@/lib/admin/actions/users";
import {
  auditActionLabel,
  PLAN_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
} from "@/lib/admin/labels";
import { MODERATION_LABELS } from "@/lib/admin/types";
import { getUserDetail } from "@/lib/admin/users";
import { getPlan } from "@/config/plans";
import { formatAdminDate } from "@/lib/admin/format";

export const metadata: Metadata = { title: "Fiche utilisateur" };
export const dynamic = "force-dynamic";

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right text-sm">{value}</span>
    </div>
  );
}

function quota(used: number, max: number | null): string {
  return max === null ? `${used} / illimité` : `${used} / ${max}`;
}

/** /admin/utilisateurs/[id] — fiche complète + actions administratives. */
export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUserDetail(id).catch(() => null);
  if (!user) notFound();

  const plan = getPlan(user.plan);
  const sub = user.subscription;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/utilisateurs"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            <ArrowLeft className="size-3.5" /> Utilisateurs
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {user.full_name || user.email || "Compte sans nom"}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={user.plan === "free" ? "outline" : "secondary"}>
            {PLAN_LABELS[user.plan] ?? user.plan}
          </Badge>
          <Badge
            variant={
              user.moderation === "banned"
                ? "destructive"
                : user.moderation === "suspended"
                  ? "secondary"
                  : "outline"
            }
          >
            {MODERATION_LABELS[user.moderation]}
          </Badge>
          {user.founder ? <Badge>Fondateur n°{user.founder.purchase_number}</Badge> : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Profil */}
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="text-sm font-medium">Profil</h2>
          <div className="mt-2 divide-y divide-border/60">
            <Info label="E-mail" value={user.email || "—"} />
            <Info label="Nom" value={user.full_name || "—"} />
            <Info label="Téléphone" value={user.phone || "—"} />
            <Info label="Inscription" value={formatAdminDate(user.created_at)} />
            <Info
              label="Dernière connexion"
              value={user.last_sign_in_at ? formatAdminDate(user.last_sign_in_at) : "Jamais"}
            />
            <Info label="E-mail confirmé" value={user.email_confirmed ? "Oui" : "Non"} />
            {user.moderation !== "active" && user.moderation_reason ? (
              <Info label="Raison" value={user.moderation_reason} />
            ) : null}
          </div>
        </div>

        {/* Abonnement */}
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="text-sm font-medium">Abonnement</h2>
          <div className="mt-2 divide-y divide-border/60">
            <Info label="Plan" value={PLAN_LABELS[user.plan] ?? user.plan} />
            <Info
              label="Statut"
              value={
                sub ? (SUBSCRIPTION_STATUS_LABELS[sub.status] ?? sub.status) : "Aucun abonnement"
              }
            />
            <Info label="Fournisseur" value={sub?.provider ?? "—"} />
            <Info
              label="Prochaine échéance"
              value={sub?.current_period_end ? formatAdminDate(sub.current_period_end) : "—"}
            />
            <Info
              label="Annulation programmée"
              value={sub?.cancel_at_period_end ? "Oui (fin de période)" : "Non"}
            />
            <Info label="Accès à vie" value={sub?.lifetime_access ? "Oui (Fondateur)" : "Non"} />
            <Info
              label="Stripe Customer"
              value={
                sub?.stripe_customer_id ? (
                  <code className="text-xs">{sub.stripe_customer_id}</code>
                ) : (
                  "—"
                )
              }
            />
            <Info
              label="Stripe Subscription"
              value={
                sub?.stripe_subscription_id ? (
                  <code className="text-xs">{sub.stripe_subscription_id}</code>
                ) : (
                  "—"
                )
              }
            />
          </div>
          <div className="mt-3 border-t border-border/60 pt-3">
            <p className="mb-2 text-xs text-muted-foreground">
              Changement de plan exceptionnel (via Stripe si l&apos;abonnement est facturé) :
            </p>
            <UserPlanForm currentPlan={user.plan} action={changeUserPlan.bind(null, user.id)} />
          </div>
        </div>

        {/* Utilisation & quotas */}
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="text-sm font-medium">Utilisation et quotas</h2>
          <div className="mt-2 divide-y divide-border/60">
            <Info
              label="Logements"
              value={quota(user.usage.properties, plan.limits.maxProperties)}
            />
            <Info
              label="Locataires actifs"
              value={quota(user.usage.activeTenants, plan.limits.maxActiveTenants)}
            />
            <Info
              label="Documents"
              value={quota(user.usage.documents, plan.limits.maxDocuments)}
            />
            <Info label="Photos" value={quota(user.usage.photos, plan.limits.maxPhotos)} />
            <Info label="Stockage inclus" value={`${plan.limits.storageMb} Mo`} />
          </div>
        </div>
      </div>

      {/* Actions sensibles */}
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="text-sm font-medium">Actions administratives</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Chaque action est confirmée, exécutée côté serveur et journalisée dans l&apos;audit.
          Les mots de passe ne sont jamais visibles ni modifiables ici.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {user.moderation === "active" ? (
            <>
              <ConfirmAction
                label="Suspendre"
                title="Suspendre ce compte"
                description="Le client ne pourra plus se connecter pendant 30 jours (ou jusqu'à réactivation). Ses données sont conservées."
                confirmLabel="Suspendre le compte"
                withReason
                action={suspendUser.bind(null, user.id)}
              />
              <ConfirmAction
                label="Bannir"
                title="Bannir ce compte"
                description="Connexion bloquée définitivement (jusqu'à levée manuelle). Ses données sont conservées."
                confirmLabel="Bannir le compte"
                variant="destructive"
                withReason
                action={banUser.bind(null, user.id)}
              />
            </>
          ) : (
            <ConfirmAction
              label="Réactiver"
              title="Réactiver ce compte"
              description="Le client pourra de nouveau se connecter immédiatement."
              confirmLabel="Réactiver"
              withReason
              action={reactivateUser.bind(null, user.id)}
            />
          )}
          <ConfirmAction
            label="Supprimer le compte"
            title="Suppression définitive"
            description="Abonnement Stripe résilié, fichiers supprimés, compte et données effacés. Cette action est IRRÉVERSIBLE. Réservée au rôle owner."
            confirmLabel="Supprimer définitivement"
            variant="destructive"
            requiredPhrase="SUPPRIMER"
            withReason
            action={deleteUserAccount.bind(null, user.id)}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Notes internes */}
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="text-sm font-medium">Notes internes</h2>
          <div className="mt-3">
            <UserNoteForm action={addUserNote.bind(null, user.id)} />
          </div>
          <div className="mt-3 divide-y divide-border/60">
            {user.notes.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">Aucune note.</p>
            ) : (
              user.notes.map((note) => (
                <div key={note.id} className="py-2.5">
                  <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {note.created_by_email} · {formatAdminDate(note.created_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Historique administratif */}
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="text-sm font-medium">Historique des actions administratives</h2>
          <div className="mt-2 divide-y divide-border/60">
            {user.history.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">Aucune action enregistrée.</p>
            ) : (
              user.history.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p
                      className={`truncate text-sm ${entry.result === "error" ? "text-destructive" : ""}`}
                    >
                      {auditActionLabel(entry.action)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{entry.admin_email}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatAdminDate(entry.created_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
