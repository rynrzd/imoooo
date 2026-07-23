import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { auditActionLabel } from "@/lib/admin/labels";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Journal d'audit" };
export const dynamic = "force-dynamic";

const PER_PAGE = 50;

const SELECT_CLASS =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none " +
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

interface AuditLogRow {
  id: string;
  admin_email: string;
  action: string;
  target_label: string;
  old_value: unknown;
  new_value: unknown;
  ip: string | null;
  result: string;
  detail: string;
  created_at: string;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

function compactJson(value: unknown): string {
  if (value === null || value === undefined) return "";
  try {
    const text = JSON.stringify(value);
    return text === "{}" ? "" : text;
  } catch {
    return "";
  }
}

/** /admin/audit — journal complet des actions administratives. */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const resultat = typeof params.resultat === "string" ? params.resultat : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);

  const admin = createAdminClient();
  let query = admin.from("admin_audit_logs").select("*", { count: "exact" });
  if (resultat === "error" || resultat === "success") query = query.eq("result", resultat);
  if (q) {
    const term = q.replace(/[%_,()]/g, " ").trim();
    if (term) {
      query = query.or(
        `action.ilike.%${term}%,admin_email.ilike.%${term}%,target_label.ilike.%${term}%`
      );
    }
  }

  const from = (page - 1) * PER_PAGE;
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, from + PER_PAGE - 1);
  if (error) throw new Error(`Lecture du journal impossible : ${error.message}`);
  const rows = (data ?? []) as AuditLogRow[];
  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));

  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (resultat) sp.set("resultat", resultat);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `/admin/audit${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Journal d&apos;audit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total} action{total > 1 ? "s" : ""} enregistrée{total > 1 ? "s" : ""} — connexions,
          modérations, abonnements, paramètres.
        </p>
      </div>

      <form className="flex flex-wrap items-center gap-2" action="/admin/audit" method="get">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Rechercher (action, admin, cible)…"
          className="w-full sm:w-72"
        />
        <select
          name="resultat"
          defaultValue={resultat}
          className={SELECT_CLASS}
          aria-label="Filtrer par résultat"
        >
          <option value="">Tous les résultats</option>
          <option value="success">Succès</option>
          <option value="error">Erreurs</option>
        </select>
        <Button type="submit" variant="outline" size="sm">
          Filtrer
        </Button>
      </form>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Administrateur</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Cible</TableHead>
              <TableHead>Valeurs</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Résultat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Aucune entrée ne correspond à ces critères.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const oldValue = compactJson(row.old_value);
                const newValue = compactJson(row.new_value);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(row.created_at)}
                    </TableCell>
                    <TableCell className="max-w-44 truncate">{row.admin_email || "—"}</TableCell>
                    <TableCell>
                      <span title={row.action}>{auditActionLabel(row.action)}</span>
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-muted-foreground">
                      {row.target_label || "—"}
                    </TableCell>
                    <TableCell>
                      <div
                        className="max-w-52 truncate text-xs text-muted-foreground"
                        title={[oldValue && `Avant : ${oldValue}`, newValue && `Après : ${newValue}`]
                          .filter(Boolean)
                          .join("\n")}
                      >
                        {oldValue ? `${oldValue} → ` : ""}
                        {newValue || (oldValue ? "" : "—")}
                      </div>
                      {row.detail ? (
                        <div
                          className="max-w-52 truncate text-xs text-destructive/80"
                          title={row.detail}
                        >
                          {row.detail}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.ip || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.result === "error" ? "destructive" : "outline"}>
                        {row.result === "error" ? "Erreur" : "Succès"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
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
