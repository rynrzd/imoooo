import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PLAN_LABELS, SUBSCRIPTION_STATUS_LABELS } from "@/lib/admin/labels";
import { listUsers } from "@/lib/admin/users";
import { formatAdminDate } from "@/lib/admin/format";

export const metadata: Metadata = { title: "Utilisateurs" };
export const dynamic = "force-dynamic";

const PER_PAGE = 25;

const SELECT_CLASS =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none " +
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function moderationBadge(status: string) {
  if (status === "banned") return <Badge variant="destructive">Banni</Badge>;
  if (status === "suspended") return <Badge variant="secondary">Suspendu</Badge>;
  return <Badge variant="outline">Actif</Badge>;
}

/** /admin/utilisateurs — recherche, filtres, accès à la fiche client. */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const plan = typeof params.plan === "string" ? params.plan : "";
  const statut = typeof params.statut === "string" ? params.statut : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);

  const { items, total } = await listUsers({ q, plan, statut, page, perPage: PER_PAGE });
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));

  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (plan) sp.set("plan", plan);
    if (statut) sp.set("statut", statut);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `/admin/utilisateurs${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Utilisateurs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total} compte{total > 1 ? "s" : ""} client — les administrateurs ne sont pas listés.
        </p>
      </div>

      {/* Recherche + filtres (GET : partageable, sans JavaScript) */}
      <form className="flex flex-wrap items-center gap-2" action="/admin/utilisateurs" method="get">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Rechercher (e-mail, nom)…"
          className="w-full sm:w-64"
        />
        <select name="plan" defaultValue={plan} className={SELECT_CLASS} aria-label="Filtrer par plan">
          <option value="">Tous les plans</option>
          <option value="free">Gratuit</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="business">Business+</option>
        </select>
        <select
          name="statut"
          defaultValue={statut}
          className={SELECT_CLASS}
          aria-label="Filtrer par statut"
        >
          <option value="">Tous les statuts</option>
          <option value="active">Actifs</option>
          <option value="suspended">Suspendus</option>
          <option value="banned">Bannis</option>
        </select>
        <Button type="submit" variant="outline" size="sm">
          Filtrer
        </Button>
      </form>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Abonnement</TableHead>
              <TableHead>Inscription</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Aucun utilisateur ne correspond à ces critères.
                </TableCell>
              </TableRow>
            ) : (
              items.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Link
                      href={`/admin/utilisateurs/${user.id}`}
                      className="block max-w-64 hover:underline"
                    >
                      <span className="block truncate font-medium">
                        {user.full_name || "Sans nom"}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.plan === "free" ? "outline" : "secondary"}>
                      {PLAN_LABELS[user.plan] ?? user.plan}
                      {user.lifetime_access ? " · à vie" : ""}
                    </Badge>
                  </TableCell>
                  <TableCell>{moderationBadge(user.moderation)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.subscription_status
                      ? (SUBSCRIPTION_STATUS_LABELS[user.subscription_status] ??
                        user.subscription_status)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatAdminDate(user.created_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} / {pageCount}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className="underline-offset-2 hover:underline">
                ← Précédente
              </Link>
            ) : null}
            {page < pageCount ? (
              <Link href={pageHref(page + 1)} className="underline-offset-2 hover:underline">
                Suivante →
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
