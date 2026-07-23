import type { Metadata } from "next";
import { TicketDialog, type TicketData } from "@/components/admin/ticket-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  replyToTicket,
  setTicketNote,
  setTicketPriority,
  setTicketStatus,
} from "@/lib/admin/actions/support";
import { TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS } from "@/lib/admin/labels";
import { isEmailConfigured } from "@/lib/email/provider";
import { formatAdminDate } from "@/lib/admin/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Support" };
export const dynamic = "force-dynamic";

const SELECT_CLASS =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none " +
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/** /admin/support — demandes du formulaire de contact, triables et traitables. */
export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const statut = typeof params.statut === "string" ? params.statut : "";
  const priorite = typeof params.priorite === "string" ? params.priorite : "";

  const admin = createAdminClient();
  let query = admin
    .from("contact_messages")
    .select(
      "id, name, email, subject, message, admin_status, priority, internal_note, replied_at, created_at",
      { count: "exact" }
    );
  if (statut && ["ouvert", "en_cours", "resolu", "ferme"].includes(statut)) {
    query = query.eq("admin_status", statut);
  }
  if (priorite && ["basse", "normale", "haute"].includes(priorite)) {
    query = query.eq("priority", priorite);
  }
  const { data, count, error } = await query.order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(`Lecture des tickets impossible : ${error.message}`);
  const tickets = (data ?? []) as TicketData[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Support</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {count ?? 0} demande{(count ?? 0) > 1 ? "s" : ""} reçue
          {(count ?? 0) > 1 ? "s" : ""} via le formulaire de contact.
          {!isEmailConfigured
            ? " Fournisseur d'e-mail non configuré : les réponses par e-mail sont indisponibles."
            : ""}
        </p>
      </div>

      <form className="flex flex-wrap items-center gap-2" action="/admin/support" method="get">
        <select
          name="statut"
          defaultValue={statut}
          className={SELECT_CLASS}
          aria-label="Filtrer par statut"
        >
          <option value="">Tous les statuts</option>
          <option value="ouvert">Ouverts</option>
          <option value="en_cours">En cours</option>
          <option value="resolu">Résolus</option>
          <option value="ferme">Fermés</option>
        </select>
        <select
          name="priorite"
          defaultValue={priorite}
          className={SELECT_CLASS}
          aria-label="Filtrer par priorité"
        >
          <option value="">Toutes les priorités</option>
          <option value="haute">Haute</option>
          <option value="normale">Normale</option>
          <option value="basse">Basse</option>
        </select>
        <Button type="submit" variant="outline" size="sm">
          Filtrer
        </Button>
      </form>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reçu le</TableHead>
              <TableHead>Expéditeur</TableHead>
              <TableHead>Sujet</TableHead>
              <TableHead>Priorité</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Réponse</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Aucune demande ne correspond à ces critères.
                </TableCell>
              </TableRow>
            ) : (
              tickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell className="text-muted-foreground">
                    {formatAdminDate(ticket.created_at)}
                  </TableCell>
                  <TableCell>
                    <span className="block max-w-44 truncate font-medium">{ticket.name}</span>
                    <span className="block max-w-44 truncate text-xs text-muted-foreground">
                      {ticket.email}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-52 truncate">{ticket.subject}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        ticket.priority === "haute"
                          ? "destructive"
                          : ticket.priority === "basse"
                            ? "outline"
                            : "secondary"
                      }
                    >
                      {TICKET_PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        ticket.admin_status === "ouvert"
                          ? "default"
                          : ticket.admin_status === "en_cours"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {TICKET_STATUS_LABELS[ticket.admin_status] ?? ticket.admin_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {ticket.replied_at ? formatAdminDate(ticket.replied_at) : "—"}
                  </TableCell>
                  <TableCell>
                    <TicketDialog
                      ticket={ticket}
                      emailEnabled={isEmailConfigured}
                      onStatus={setTicketStatus.bind(null, ticket.id)}
                      onPriority={setTicketPriority.bind(null, ticket.id)}
                      onNote={setTicketNote.bind(null, ticket.id)}
                      onReply={replyToTicket.bind(null, ticket.id)}
                    />
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
