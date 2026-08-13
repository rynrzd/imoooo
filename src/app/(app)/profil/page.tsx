"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronRight,
  LifeBuoy,
  LogOut,
  Rocket,
  Shield,
  UserRound,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  SettingsGroup,
  SettingsRow,
} from "@/components/profile/settings-shell";
import { getPlan } from "@/config/plans";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { useAppStore } from "@/lib/store";
import { useAvatar } from "@/lib/use-avatar";

/**
 * PROFIL — le hub unique du compte.
 *
 * Il a absorbé la totalité de l'ancien écran « Paramètres » (sept onglets,
 * 1 100 lignes, tous les formulaires empilés sur une seule page). Ici : aucun
 * formulaire, uniquement l'identité, le plan réel et des lignes qui ouvrent
 * chacune leur page. Rien n'a été perdu au passage — le tableau ci-dessous dit
 * où chaque fonction est partie.
 *
 *   Photo, nom, téléphone, entreprise, e-mail → /profil/informations
 *   Mot de passe, sessions                    → /profil/securite
 *   Thème, notifications, relances            → /profil/preferences
 *   Exports, confidentialité, suppression     → /profil/donnees
 *   Guide de démarrage, support               → /profil/aide
 *   Plan, factures                            → /abonnement (page Stripe réelle)
 *
 * Aucun lien « Administrateur » n'apparaît ici : l'espace d'administration est
 * un autre produit, protégé côté serveur, et n'a rien à faire dans le compte
 * d'un client.
 */
export default function ProfilePage() {
  const { data, profile, isLive } = useAppStore();
  const { url: avatarUrl, initials } = useAvatar();
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);

  const plan = getPlan(profile?.plan);
  const maxProperties = plan.limits.maxProperties;
  // Un compte Fondateur a un accès à vie sans plafond : afficher « 1 / 25 »
  // lui mentirait sur ce qu'il a acheté.
  const usage = profile?.isFounder
    ? `${data.properties.length} logement${data.properties.length > 1 ? "s" : ""} · accès Fondateur`
    : maxProperties === null
      ? `${data.properties.length} logement${data.properties.length > 1 ? "s" : ""} · illimité`
      : `${data.properties.length} / ${maxProperties} logement${maxProperties > 1 ? "s" : ""}`;

  const signOut = async () => {
    if (!isSupabaseConfigured) {
      toast.info("Mode démo : configurez Supabase pour activer les comptes.");
      return;
    }
    if (signingOut) return;
    setSigningOut(true);
    const { error } = await createClient().auth.signOut();
    if (error) {
      toast.error("Déconnexion impossible. Réessayez.");
      setSigningOut(false);
      return;
    }
    router.replace("/connexion");
    router.refresh();
  };

  return (
    <div className="mx-auto w-full max-w-xl">
      <h1 className="pb-6 text-2xl font-semibold tracking-[-0.03em] text-foreground">
        Profil
      </h1>

      {/* ---------- Identité ---------- */}
      <section className="flex items-center gap-4 pb-7">
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary text-lg font-semibold text-foreground ring-1 ring-border">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt=""
              width={64}
              height={64}
              unoptimized
              className="size-full object-cover"
            />
          ) : initials ? (
            initials
          ) : (
            <UserRound className="size-6 text-muted-foreground" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold tracking-[-0.02em] text-foreground">
            {profile?.fullName?.trim() || "Votre compte"}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {profile?.email || (isLive ? "—" : "Mode démo")}
          </p>
          <Link
            href="/profil/informations"
            className="inline-flex min-h-9 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Modifier
          </Link>
        </div>
      </section>

      {/* ---------- Plan actuel ---------- */}
      <Link
        href="/abonnement"
        className="flex items-stretch gap-4 rounded-xl bg-primary-soft px-4 py-3.5 transition-opacity duration-200 hover:opacity-90"
      >
        <span className="flex flex-col justify-center">
          <span className="text-[0.7rem] font-semibold tracking-[0.08em] text-primary uppercase">
            Plan actuel
          </span>
        </span>
        <span aria-hidden className="w-px shrink-0 bg-primary/20" />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.95rem] font-semibold text-foreground">
            {plan.name}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {usage}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-0.5 text-sm font-medium text-primary">
          Gérer
          <ChevronRight className="size-4" aria-hidden />
        </span>
      </Link>

      {/* ---------- Groupes ---------- */}
      <div className="space-y-7 pt-7">
        <SettingsGroup label="Votre compte">
          <SettingsRow
            href="/profil/informations"
            icon={UserRound}
            label="Informations personnelles"
            detail="Nom et adresse e-mail"
          />
          <SettingsRow
            href="/profil/securite"
            icon={Shield}
            label="Sécurité"
            detail="Mot de passe et sessions"
          />
        </SettingsGroup>

        <SettingsGroup label="Votre espace">
          <SettingsRow
            href="/abonnement"
            icon={Wallet}
            label="Abonnement"
            detail="Plan, factures et utilisation"
          />
          <SettingsRow
            href="/profil/preferences"
            icon={Bell}
            label="Préférences"
            detail="Apparence et notifications"
          />
          <SettingsRow
            href="/profil/aide"
            icon={Rocket}
            label="Guide de démarrage"
            detail="Relancer le parcours Nireo"
          />
        </SettingsGroup>

        <SettingsGroup label="Vos données">
          <SettingsRow
            href="/profil/donnees"
            icon={Shield}
            label="Données et confidentialité"
            detail="Export et gestion du compte"
          />
          <SettingsRow
            href="/profil/aide"
            icon={LifeBuoy}
            label="Aide et contact"
            detail="Besoin d'aide ?"
          />
        </SettingsGroup>

        {/* ---------- Actions ---------- */}
        <section className="border-t border-border pt-2">
          <ul>
            <SettingsRow
              icon={LogOut}
              label={signingOut ? "Déconnexion…" : "Se déconnecter"}
              onClick={() => void signOut()}
            />
          </ul>
          <Link
            href="/profil/donnees#supprimer"
            className="inline-flex min-h-11 items-center px-1 text-sm font-medium text-danger underline-offset-4 hover:underline"
          >
            Supprimer mon compte
          </Link>
        </section>
      </div>
    </div>
  );
}
