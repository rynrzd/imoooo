import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAdminDate } from "@/lib/admin/format";
import { logger } from "@/lib/logger";
import { isStripeConfigured } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Transactions" };
export const dynamic = "force-dynamic";

interface TransactionRow {
  id: string;
  date: string;
  email: string;
  description: string;
  amountCents: number;
  status: "succeeded" | "failed" | "pending" | "refunded";
}

const STATUS_LABELS: Record<TransactionRow["status"], string> = {
  succeeded: "Payé",
  failed: "Échoué",
  pending: "En attente",
  refunded: "Remboursé",
};

/** Derniers paiements réels depuis l'API Stripe (jamais de données fictives). */
async function loadStripeTransactions(): Promise<TransactionRow[] | null> {
  try {
    const stripe = getStripe();
    const charges = await stripe.charges.list({ limit: 50 });
    return charges.data.map((charge) => ({
      id: charge.id,
      date: new Date(charge.created * 1000).toISOString(),
      email: charge.billing_details?.email ?? charge.receipt_email ?? "",
      description: charge.description ?? "Paiement",
      amountCents: charge.amount,
      status: charge.refunded
        ? "refunded"
        : charge.status === "succeeded"
          ? "succeeded"
          : charge.status === "pending"
            ? "pending"
            : "failed",
    }));
  } catch (e) {
    logger.error("admin/transactions", e);
    return null;
  }
}

/** /admin/transactions — encaissements Stripe + achats Fondateur confirmés. */
export default async function AdminTransactionsPage() {
  const transactions = isStripeConfigured ? await loadStripeTransactions() : null;

  // Repli sans Stripe : les achats Fondateur confirmés déjà en base.
  let founderRows: TransactionRow[] = [];
  if (!transactions) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("founder_purchases")
      .select("id, user_id, amount_cents, confirmed_at")
      .eq("status", "confirmed")
      .order("confirmed_at", { ascending: false })
      .limit(50);
    const ids = (data ?? []).map((r) => r.user_id as string);
    const emails = new Map<string, string>();
    if (ids.length > 0) {
      const { data: profiles } = await admin.from("profiles").select("id, email").in("id", ids);
      for (const p of profiles ?? []) emails.set(p.id as string, (p.email as string) ?? "");
    }
    founderRows = (data ?? []).map((r) => ({
      id: r.id as string,
      date: (r.confirmed_at as string) ?? "",
      email: emails.get(r.user_id as string) ?? "",
      description: "Offre Fondateur (paiement unique)",
      amountCents: (r.amount_cents as number) ?? 0,
      status: "succeeded" as const,
    }));
  }

  const rows = transactions ?? founderRows;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Transactions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {transactions
            ? "50 derniers paiements réels, lus directement depuis Stripe."
            : isStripeConfigured
              ? "Lecture Stripe momentanément impossible — achats Fondateur affichés depuis la base."
              : "Stripe n'est pas configuré : seuls les achats Fondateur confirmés en base sont affichés."}
        </p>
      </div>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Aucune transaction pour le moment.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground">
                    {row.date ? formatAdminDate(row.date) : "—"}
                  </TableCell>
                  <TableCell className="max-w-56 truncate">{row.email || "—"}</TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground">
                    {row.description}
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">
                    {(row.amountCents / 100).toFixed(2).replace(".", ",")} €
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.status === "succeeded"
                          ? "secondary"
                          : row.status === "failed"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {STATUS_LABELS[row.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
