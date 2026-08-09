import type { Metadata } from "next";
import Link from "next/link";
import { Download, ExternalLink, ShieldCheck, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRO_STATUS_LABELS } from "@/features/nireo-id/constants";
import { isNireoIdConfigured, nidUserClient } from "@/features/nireo-id/server/client";
import {
  getNidAdminContext,
  getProfessionalProfile,
  requireNidSession,
} from "@/features/nireo-id/server/guards";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Compte et confidentialité",
  robots: { index: false, follow: false },
};

async function loadSummary() {
  if (!isNireoIdConfigured) {
    return { assets: 0, events: 0, documents: 0, shares: 0 };
  }
  try {
    const supabase = await nidUserClient();
    const head = { count: "exact" as const, head: true };
    const [assets, events, documents, shares] = await Promise.all([
      supabase.from("nid_assets").select("id", head),
      supabase.from("nid_events").select("id", head),
      supabase.from("nid_documents").select("id", head),
      supabase.from("nid_share_links").select("id", head).is("revoked_at", null),
    ]);
    return {
      assets: assets.count ?? 0,
      events: events.count ?? 0,
      documents: documents.count ?? 0,
      shares: shares.count ?? 0,
    };
  } catch {
    return { assets: 0, events: 0, documents: 0, shares: 0 };
  }
}

export default async function NidSettingsPage() {
  const session = await requireNidSession("/id/app/parametres");
  const [summary, professional, admin] = await Promise.all([
    loadSummary(),
    getProfessionalProfile(session.user.id),
    getNidAdminContext(),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Compte et confidentialité</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Nireo ID utilise votre compte Nireo existant. Aucun second mot de
          passe, aucun second profil.
        </p>
      </header>

      <section className="nid-panel space-y-3 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-foreground">Compte</h2>
        <p className="text-sm text-muted-foreground">
          Connecté avec <span className="font-medium text-foreground">{session.email}</span>
        </p>
        <Button variant="outline" data-touch render={<Link href="/parametres" />}>
          <ExternalLink className="size-4" data-icon="inline-start" />
          Gérer mon compte Nireo
        </Button>
      </section>

      <section className="nid-panel space-y-4 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-foreground">Mes données Nireo ID</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Téléphones", value: summary.assets },
            { label: "Événements", value: summary.events },
            { label: "Documents", value: summary.documents },
            { label: "Liens actifs", value: summary.shares },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-border p-3">
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="mt-1 text-xl font-semibold text-foreground tabular-nums">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
        <Button variant="outline" data-touch render={<a href="/api/nireo-id/export" download />}>
          <Download className="size-4" data-icon="inline-start" />
          Exporter mes données (JSON)
        </Button>
        <p className="text-xs text-muted-foreground">
          L’export contient vos téléphones, leur historique, les métadonnées de
          vos documents et vos liens de partage. Les fichiers restent
          téléchargeables depuis chaque téléphone.
        </p>
      </section>

      <section className="nid-panel space-y-3 rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Wrench className="size-4 text-primary" aria-hidden />
          Compte professionnel
        </h2>
        {professional ? (
          <>
            <p className="text-sm text-muted-foreground">
              {professional.trade_name} —{" "}
              <span className="font-medium text-foreground">
                {PRO_STATUS_LABELS[professional.status]}
              </span>
            </p>
            {professional.decision_reason ? (
              <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                {professional.decision_reason}
              </p>
            ) : null}
            <Button variant="outline" data-touch render={<Link href="/id/pro" />}>
              Ouvrir l’espace professionnel
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Réparateur, reconditionneur ou atelier de diagnostic ? Demandez
              un compte professionnel pour enregistrer vos interventions dans
              les téléphones de vos clients.
            </p>
            <Button variant="outline" data-touch render={<Link href="/id/pro/candidature" />}>
              Demander un compte professionnel
            </Button>
          </>
        )}
      </section>

      {admin ? (
        <section className="nid-panel space-y-3 rounded-2xl p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="size-4 text-primary" aria-hidden />
            Administration Nireo ID
          </h2>
          <p className="text-sm text-muted-foreground">
            Votre compte dispose du rôle « {admin.admin.role} » sur Nireo ID.
            Ces droits sont indépendants de l’administration de Nireo Immo.
          </p>
          <Button variant="outline" data-touch render={<Link href="/id/admin" />}>
            Ouvrir l’administration
          </Button>
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">Ce que Nireo ID ne fait pas</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>· Aucune vérification qu’un appareil est déclaré volé.</li>
          <li>· Aucune certification officielle ni garantie d’authenticité.</li>
          <li>· Aucune publication automatique de vos documents.</li>
          <li>· Aucun accès administrateur silencieux à vos fichiers privés.</li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Supprimer un téléphone transmis à un autre propriétaire est
          impossible : son historique appartient désormais à l’objet. Vous
          pouvez en revanche archiver vos téléphones et supprimer vos
          documents personnels.
        </p>
      </section>
    </div>
  );
}
