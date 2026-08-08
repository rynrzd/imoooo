import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, BadgeCheck, Clock, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdminOverview } from "@/features/nireo-id/server/admin";
import { requireNidAdminPage } from "@/features/nireo-id/server/guards";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function NidAdminHomePage() {
  await requireNidAdminPage();
  const overview = await getAdminOverview();

  const cards = [
    {
      label: "Candidatures en attente",
      value: overview.pendingApplications,
      icon: Clock,
      href: "/id/admin/professionnels?statut=en_attente",
    },
    {
      label: "Professionnels approuvés",
      value: overview.approvedProfessionals,
      icon: BadgeCheck,
      href: "/id/admin/professionnels?statut=approuve",
    },
    {
      label: "Signalements ouverts",
      value: overview.openDisputes,
      icon: AlertTriangle,
      href: "/id/admin/signalements",
    },
    { label: "Passeports créés", value: overview.assets, icon: Smartphone, href: null },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Administration Nireo ID</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Comptes professionnels, signalements et traçabilité. Ces droits sont
          distincts de l’administration de Nireo Immo.
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <li key={card.label} className="nid-panel rounded-2xl p-4">
            <card.icon className="size-4 text-primary" aria-hidden />
            <p className="mt-3 text-2xl font-semibold text-foreground tabular-nums">{card.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{card.label}</p>
            {card.href ? (
              <Link
                href={card.href}
                className="mt-2 inline-block text-xs text-primary underline-offset-2 hover:underline"
              >
                Consulter
              </Link>
            ) : null}
          </li>
        ))}
      </ul>

      <section className="nid-panel rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-foreground">Interventions professionnelles</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {overview.proEvents} événement{overview.proEvents > 1 ? "s" : ""} portent aujourd’hui
          le niveau « Validé par un professionnel ».
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/id/admin/professionnels" />}>
            Examiner les candidatures
          </Button>
          <Button variant="outline" render={<Link href="/id/admin/journal" />}>
            Consulter le journal
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">Règles de l’administration</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>· Chaque décision exige un motif et laisse une trace dans le journal d’audit.</li>
          <li>· Aucune fonction « se connecter en tant que l’utilisateur » n’existe.</li>
          <li>· Les documents privés des utilisateurs ne sont pas consultables depuis ici.</li>
          <li>· Une suspension révoque immédiatement les accès du professionnel concerné.</li>
        </ul>
      </section>
    </div>
  );
}
