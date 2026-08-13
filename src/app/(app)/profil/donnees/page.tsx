"use client";

import * as React from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDestructive } from "@/components/form/confirm-destructive";
import { Field } from "@/components/form/fields";
import {
  SettingsPageShell,
  SettingsSection,
} from "@/components/profile/settings-shell";
import { downloadFile } from "@/lib/download";
import { hasFeature } from "@/lib/stripe/entitlements";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { useAppStore } from "@/lib/store";

/**
 * Données et confidentialité — export, informations légales, suppression.
 *
 * La suppression du compte reste ce qu'elle était : un appel à la route
 * serveur `/api/account/delete`, qui exige une session valide, la phrase de
 * confirmation ET le mot de passe, révoque l'abonnement Stripe, vide le
 * Storage puis supprime l'utilisateur avec la clé secrète. Aucune clé
 * `service_role` n'approche le navigateur, et si la configuration serveur
 * manque, la route répond 503 avec un message clair : le blocage est signalé,
 * jamais simulé.
 */

const DELETE_SENTENCE = "SUPPRIMER MON COMPTE";

export default function DataPrivacyPage() {
  const { data, profile, isLive } = useAppStore();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [password, setPassword] = React.useState("");

  // Les exports sont inclus à partir du plan Starter. La règle vient de la
  // source de vérité des abonnements — aucun quota n'est écrit ici.
  const exportCheck = isLive
    ? hasFeature(profile?.plan, "simple_exports")
    : { allowed: true, reason: null };

  const exportJson = () => {
    downloadFile(
      `nireo-export-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ profile, ...data }, null, 2),
      "application/json"
    );
    toast.success("Export JSON téléchargé.");
  };

  const exportCsv = () => {
    const header = "mois;logement;locataire;prevu;recu;statut;date_paiement";
    const rows = data.rentPayments.map((p) => {
      const property = data.properties.find((x) => x.id === p.propertyId);
      const tenant = data.tenants.find((x) => x.id === p.tenantId);
      return [
        p.month,
        property?.name ?? "",
        tenant ? `${tenant.firstName} ${tenant.lastName}` : "",
        p.expected,
        p.received,
        p.status,
        p.paidAt ?? "",
      ].join(";");
    });
    downloadFile(
      `nireo-loyers-${new Date().toISOString().slice(0, 10)}.csv`,
      [header, ...rows].join("\n"),
      "text/csv;charset=utf-8"
    );
    toast.success("Export CSV des loyers téléchargé.");
  };

  const deleteAccount = async () => {
    if (!isSupabaseConfigured) {
      throw new Error("Mode démo : configurez Supabase pour activer les comptes.");
    }
    const response = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: DELETE_SENTENCE, password }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      // Le serveur renvoie déjà un message français explicite (mot de passe
      // incorrect, abonnement actif, configuration manquante…).
      throw new Error(body.error ?? "Suppression impossible.");
    }
    await createClient().auth.signOut().catch(() => undefined);
    window.location.assign("/");
  };

  return (
    <SettingsPageShell
      title="Données et confidentialité"
      description="Ce que Nireo conserve, comment le récupérer, et comment tout effacer."
    >
      {/* ---------- Export ---------- */}
      <SettingsSection
        title="Exporter mes données"
        description="Profil, logements, locataires, baux, loyers, dépenses, travaux, et les métadonnées de vos documents et photos. Les fichiers eux-mêmes se téléchargent depuis leurs pages."
      >
        {exportCheck.allowed ? (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={exportJson}
              className="inline-flex min-h-11 items-center gap-2 rounded-[0.625rem] border border-input bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Download className="size-4" aria-hidden />
              Export complet (JSON)
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex min-h-11 items-center gap-2 rounded-[0.625rem] border border-input bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Download className="size-4" aria-hidden />
              Loyers (CSV)
            </button>
          </div>
        ) : (
          // Fonction verrouillée : une ligne discrète, pas un écran entier.
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[0.625rem] bg-primary-soft px-3.5 py-3">
            <p className="min-w-0 text-sm text-foreground">
              Emportez toutes vos données en un fichier, quand vous le souhaitez.
            </p>
            <Link
              href="/abonnement"
              className="shrink-0 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Découvrir Pro
            </Link>
          </div>
        )}
      </SettingsSection>

      {/* ---------- Confidentialité ---------- */}
      <SettingsSection
        title="Confidentialité"
        description="Données stockées : compte (e-mail, nom, téléphone), logements, locataires, baux, loyers, dépenses, travaux, documents et photos. Elles sont conservées tant que le compte est actif et ne sont jamais partagées à des fins commerciales."
      >
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link
            href="/confidentialite"
            className="min-h-11 content-center text-foreground underline-offset-2 hover:underline"
          >
            Politique de confidentialité
          </Link>
          <Link
            href="/cgu"
            className="min-h-11 content-center text-foreground underline-offset-2 hover:underline"
          >
            CGU
          </Link>
          <Link
            href="/mentions-legales"
            className="min-h-11 content-center text-foreground underline-offset-2 hover:underline"
          >
            Mentions légales
          </Link>
        </div>
      </SettingsSection>

      {/* ---------- Suppression ---------- */}
      <section id="supprimer" className="space-y-4 border-t border-border pt-8">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-danger">
            Supprimer mon compte
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Définitif. Exportez vos données avant : après suppression, plus rien
            n&apos;est récupérable, ni par vous ni par le support.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setPassword("");
            setConfirmOpen(true);
          }}
          className="min-h-11 rounded-[0.625rem] border border-danger/40 px-4 text-sm font-medium text-danger transition-colors hover:bg-danger-soft"
        >
          Supprimer mon compte
        </button>
      </section>

      <ConfirmDestructive
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Supprimer définitivement votre compte"
        target={profile?.email || "Votre compte Nireo"}
        consequences={[
          `${data.properties.length} logement${data.properties.length > 1 ? "s" : ""} et leurs fiches`,
          "Locataires, baux et échéances de loyer",
          "Dépenses, travaux et leurs justificatifs",
          `${data.documents.length + data.photos.length} fichier${data.documents.length + data.photos.length > 1 ? "s" : ""} (documents et photos)`,
          "Votre abonnement en cours, résilié chez Stripe",
        ]}
        preserved={["Rien : la suppression est totale."]}
        confirmWord={DELETE_SENTENCE}
        blocked={password.length === 0}
        confirmLabel="Supprimer définitivement"
        extra={
          <Field label="Votre mot de passe" htmlFor="delete-password">
            <input
              id="delete-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full border border-input bg-card text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
            />
          </Field>
        }
        onConfirm={deleteAccount}
      />
    </SettingsPageShell>
  );
}
