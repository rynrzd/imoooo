import type { Metadata } from "next";
import Link from "next/link";
import { Crown } from "lucide-react";
import { FounderConfigForm } from "@/components/admin/founder-config-form";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { setFounderConfig } from "@/lib/admin/actions/settings";
import { getSiteSettings } from "@/lib/admin/settings";
import { FOUNDER_TIERS, FOUNDER_TOTAL_PLACES } from "@/config/plans";
import { formatDate } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Fondateurs" };
export const dynamic = "force-dynamic";

interface FounderRow {
  id: string;
  user_id: string;
  purchase_number: number | null;
  tier: number | null;
  amount_cents: number | null;
  confirmed_at: string | null;
  created_at: string;
}

/** /admin/fondateurs — offre Fondateur : places, membres, configuration. */
export default async function AdminFoundersPage() {
  const admin = createAdminClient();
  const settings = await getSiteSettings();

  // Seuls les achats CONFIRMÉS comptent (paiement encaissé — règle serveur).
  const { data, error } = await admin
    .from("founder_purchases")
    .select("id, user_id, purchase_number, tier, amount_cents, confirmed_at, created_at")
    .eq("status", "confirmed")
    .order("purchase_number", { ascending: true });
  if (error) throw new Error(`Lecture des achats Fondateur impossible : ${error.message}`);
  const members = (data ?? []) as FounderRow[];

  const emails = new Map<string, string>();
  if (members.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email")
      .in(
        "id",
        members.map((m) => m.user_id)
      );
    for (const p of profiles ?? []) emails.set(p.id as string, (p.email as string) ?? "");
  }

  const maxPlaces = Math.min(FOUNDER_TOTAL_PLACES, settings.founder_max_places);
  const confirmed = members.length;
  const remaining = Math.max(0, maxPlaces - confirmed);
  const tier1 = members.filter((m) => m.tier === 1).length;
  const tier2 = members.filter((m) => m.tier === 2).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Offre Fondateur</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Accès Business+ à vie — une place n&apos;est comptée qu&apos;après paiement confirmé
          par le webhook Stripe.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Places confirmées" value={String(confirmed)} icon={Crown} />
        <StatCard
          label="Places restantes"
          value={String(remaining)}
          hint={`Sur ${maxPlaces} ouvertes (plafond absolu : ${FOUNDER_TOTAL_PLACES})`}
        />
        <StatCard
          label={`Palier 1 — ${FOUNDER_TIERS[0].price} €`}
          value={`${tier1} / ${FOUNDER_TIERS[0].toPlace - FOUNDER_TIERS[0].fromPlace + 1}`}
        />
        <StatCard
          label={`Palier 2 — ${FOUNDER_TIERS[1].price} €`}
          value={`${tier2} / ${FOUNDER_TIERS[1].toPlace - FOUNDER_TIERS[1].fromPlace + 1}`}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="text-sm font-medium">Configuration</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Appliquée immédiatement au tunnel d&apos;achat Fondateur (contrôle serveur).
          </p>
          <div className="mt-3">
            <FounderConfigForm
              enabled={settings.founder_enabled}
              maxPlaces={settings.founder_max_places}
              action={setFounderConfig}
            />
          </div>
        </div>

        <div className="rounded-xl bg-card ring-1 ring-foreground/10 lg:col-span-2">
          <h2 className="px-4 pt-4 text-sm font-medium">Membres Fondateur</h2>
          <div className="mt-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Place</TableHead>
                  <TableHead>Membre</TableHead>
                  <TableHead>Palier</TableHead>
                  <TableHead>Prix payé</TableHead>
                  <TableHead>Date d&apos;achat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Aucun membre Fondateur pour le moment.
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        n°{member.purchase_number ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/utilisateurs/${member.user_id}`}
                          className="block max-w-56 truncate hover:underline"
                        >
                          {emails.get(member.user_id) || member.user_id}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">Palier {member.tier ?? "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {typeof member.amount_cents === "number"
                          ? `${(member.amount_cents / 100).toFixed(2).replace(".", ",")} €`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.confirmed_at ? formatDate(member.confirmed_at) : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
