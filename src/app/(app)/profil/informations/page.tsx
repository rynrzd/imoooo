"use client";

import * as React from "react";
import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { TextField } from "@/components/form/fields";
import { toUserMessage } from "@/components/form/errors";
import { SubmitButton } from "@/components/form/submit-button";
import {
  SettingsPageShell,
  SettingsSection,
} from "@/components/profile/settings-shell";
import {
  deleteAvatar,
  requestEmailChange,
  uploadAvatar,
  verifyCurrentPassword,
} from "@/lib/supabase/account";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { useAppStore } from "@/lib/store";
import { useAvatar } from "@/lib/use-avatar";

/**
 * Informations personnelles — identité, coordonnées, adresse e-mail.
 *
 * Reprise à l'identique des trois cartes « Profil » de l'ancien écran
 * Paramètres : photo, informations, changement d'e-mail. Les appels serveur
 * n'ont pas bougé d'une ligne (`uploadAvatar`, `updateProfile`,
 * `requestEmailChange`) — seule la mise en page suit désormais le système
 * commun.
 */

const profileSchema = z.object({
  fullName: z.string().min(2, "Indiquez votre nom."),
  phone: z
    .string()
    .refine((v) => v === "" || v.replace(/\D/g, "").length >= 10, {
      message: "Numéro de téléphone incomplet.",
    }),
  companyName: z.string(),
});
type ProfileValues = z.infer<typeof profileSchema>;

const emailSchema = z.object({
  newEmail: z.string().email("Adresse e-mail invalide."),
  currentPassword: z.string().min(1, "Votre mot de passe actuel est requis."),
});
type EmailValues = z.infer<typeof emailSchema>;

export default function PersonalInformationPage() {
  const { profile, updateProfile, setAvatarPath } = useAppStore();
  const { url: avatarUrl, initials } = useAvatar();

  /** Mode démo : aucun appel serveur possible, on le dit au lieu de simuler. */
  const demoGuard = () => {
    if (isSupabaseConfigured) return false;
    toast.info("Mode démo : configurez Supabase pour activer les comptes.");
    return true;
  };

  /* ---------------- Photo ---------------- */

  const [localAvatar, setLocalAvatar] = React.useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = React.useState(false);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);
  const shownAvatar = localAvatar ?? avatarUrl;

  const onAvatarFile = async (file: File | null) => {
    if (!file || demoGuard() || avatarBusy) return;
    setAvatarBusy(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expirée. Reconnectez-vous.");
      const { path, signedUrl } = await uploadAvatar(
        supabase,
        user.id,
        file,
        profile?.avatarPath ?? null
      );
      setAvatarPath(path);
      setLocalAvatar(signedUrl);
      toast.success("Photo de profil mise à jour.");
    } catch (e) {
      toast.error(toUserMessage(e, "Envoi de la photo impossible."));
    } finally {
      setAvatarBusy(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const onAvatarDelete = async () => {
    const path = profile?.avatarPath;
    if (!path || demoGuard() || avatarBusy) return;
    setAvatarBusy(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expirée. Reconnectez-vous.");
      await deleteAvatar(supabase, user.id, path);
      setAvatarPath(null);
      setLocalAvatar(null);
      toast.success("Photo de profil supprimée.");
    } catch (e) {
      toast.error(toUserMessage(e, "Suppression de la photo impossible."));
    } finally {
      setAvatarBusy(false);
    }
  };

  /* ---------------- Identité ---------------- */

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: profile
      ? {
          fullName: profile.fullName || "",
          phone: profile.phone || "",
          companyName: profile.companyName || "",
        }
      : undefined,
  });

  const onProfileSubmit = handleSubmit(async (values) => {
    try {
      await updateProfile(values);
      toast.success("Informations enregistrées.");
    } catch (e) {
      toast.error(toUserMessage(e, "Enregistrement impossible."));
    }
  });

  /* ---------------- Adresse e-mail ---------------- */

  const {
    register: registerEmail,
    handleSubmit: handleEmailSubmit,
    reset: resetEmail,
    formState: { errors: emailErrors, isSubmitting: emailSubmitting },
  } = useForm<EmailValues>({ resolver: zodResolver(emailSchema) });

  const onEmailSubmit = handleEmailSubmit(async (values) => {
    if (demoGuard()) return;
    try {
      const supabase = createClient();
      if (!profile?.email) throw new Error("Session expirée. Reconnectez-vous.");
      const valid = await verifyCurrentPassword(
        supabase,
        profile.email,
        values.currentPassword
      );
      if (!valid) {
        toast.error("Mot de passe actuel incorrect.");
        return;
      }
      await requestEmailChange(supabase, values.newEmail);
      resetEmail({ newEmail: "", currentPassword: "" });
      toast.success(
        "Deux e-mails de confirmation ont été envoyés (ancienne et nouvelle adresse). L'adresse changera une fois les deux confirmés."
      );
    } catch (e) {
      toast.error(toUserMessage(e, "Changement d'adresse impossible."));
    }
  });

  return (
    <SettingsPageShell
      title="Informations personnelles"
      description="Votre identité et vos coordonnées. Elles n'apparaissent nulle part publiquement."
    >
      {/* ---------- Photo ---------- */}
      <SettingsSection
        title="Photo de profil"
        description="JPG, PNG ou WEBP — 20 Mo maximum. Elle reste privée : seul votre compte peut l'afficher."
      >
        <div className="flex items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary text-lg font-semibold text-foreground ring-1 ring-border">
            {shownAvatar ? (
              <Image
                src={shownAvatar}
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
          {/* Le vrai bouton, c'est celui d'à côté : ce champ n'existe que pour
              ouvrir le sélecteur de fichiers. `sr-only` le cachait à l'œil mais
              le laissait dans l'ordre de tabulation — une personne au clavier
              tombait donc sur un champ de fichier SANS ÉTIQUETTE, avant même
              d'atteindre le bouton qui le déclenche. On le sort du parcours et
              de la lecture : le bouton porte déjà le nom et l'action. */}
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            id="avatar-file"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => void onAvatarFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={avatarBusy}
              onClick={() => avatarInputRef.current?.click()}
              className="min-h-11 rounded-[0.625rem] border border-input bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
            >
              {avatarBusy
                ? "Envoi…"
                : shownAvatar
                  ? "Remplacer"
                  : "Ajouter une photo"}
            </button>
            {shownAvatar ? (
              <button
                type="button"
                disabled={avatarBusy}
                onClick={() => void onAvatarDelete()}
                className="min-h-11 px-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-danger hover:underline disabled:opacity-60"
              >
                Supprimer
              </button>
            ) : null}
          </div>
        </div>
      </SettingsSection>

      {/* ---------- Identité ---------- */}
      <SettingsSection title="Identité">
        <form onSubmit={onProfileSubmit} className="space-y-5" noValidate>
          <TextField
            id="fullName"
            label="Nom complet"
            autoComplete="name"
            error={errors.fullName?.message}
            {...register("fullName")}
          />
          <TextField
            id="phone"
            label="Téléphone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            optional
            placeholder="06 12 34 56 78"
            error={errors.phone?.message}
            {...register("phone")}
          />
          <TextField
            id="companyName"
            label="Entreprise ou SCI"
            autoComplete="organization"
            optional
            hint="Apparaît sur vos quittances de loyer."
            error={errors.companyName?.message}
            {...register("companyName")}
          />
          <SubmitButton pending={isSubmitting}>Enregistrer</SubmitButton>
        </form>
      </SettingsSection>

      {/* ---------- E-mail ---------- */}
      <SettingsSection
        title="Adresse e-mail"
        description={`Adresse actuelle : ${profile?.email || "—"}. Le changement est confirmé par e-mail sur l'ancienne ET la nouvelle adresse : tant que les deux ne sont pas confirmées, rien ne change.`}
      >
        <form onSubmit={onEmailSubmit} className="space-y-5" noValidate>
          <TextField
            id="newEmail"
            label="Nouvelle adresse e-mail"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            error={emailErrors.newEmail?.message}
            {...registerEmail("newEmail")}
          />
          <TextField
            id="emailPassword"
            label="Mot de passe actuel"
            type="password"
            autoComplete="current-password"
            hint="Il confirme que c'est bien vous."
            error={emailErrors.currentPassword?.message}
            {...registerEmail("currentPassword")}
          />
          <SubmitButton pending={emailSubmitting} pendingLabel="Envoi…">
            Changer d&apos;adresse e-mail
          </SubmitButton>
        </form>
      </SettingsSection>
    </SettingsPageShell>
  );
}
