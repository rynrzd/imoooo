"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Bell,
  CreditCard,
  Download,
  Laptop,
  LifeBuoy,
  LogOut,
  Moon,
  Palette,
  Shield,
  Sun,
  Trash2,
  UserRound,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { startProductTour } from "@/components/onboarding/product-tour";
import { FormField } from "@/components/shared/form-field";
import { TestEmailCard } from "@/components/shared/test-email-card";
import { PlanBadge } from "@/components/subscription/plan-badge";
import { CONTACT_EMAIL } from "@/components/marketing/site-footer";
import { downloadFile } from "@/lib/download";
import { logger } from "@/lib/logger";
import { hasFeature } from "@/lib/stripe/entitlements";
import { getPlan } from "@/lib/stripe/plans";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  deleteAvatar,
  fetchNotificationPreferences,
  getAvatarUrl,
  requestEmailChange,
  saveNotificationPreferences,
  updatePassword,
  uploadAvatar,
  verifyCurrentPassword,
  type NotificationPreferences,
} from "@/lib/supabase/account";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const APP_VERSION = "0.1.0 (bêta)";
const DELETE_SENTENCE = "SUPPRIMER MON COMPTE";

/* ------------------------------------------------------------------ */
/* Schémas                                                             */
/* ------------------------------------------------------------------ */

const profileSchema = z.object({
  fullName: z.string().min(2, "Nom requis."),
  phone: z.string().min(10, "Téléphone invalide.").or(z.literal("")),
  companyName: z.string(),
});
type ProfileValues = z.infer<typeof profileSchema>;

const emailSchema = z.object({
  newEmail: z.string().email("E-mail invalide."),
  currentPassword: z.string().min(1, "Mot de passe actuel requis."),
});
type EmailValues = z.infer<typeof emailSchema>;

const passwordSchema = z
  .object({
    current: z.string().min(1, "Mot de passe actuel requis."),
    password: z.string().min(8, "8 caractères minimum."),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirm"],
  });
type PasswordValues = z.infer<typeof passwordSchema>;

/** Robustesse indicative : longueur + variété de caractères. */
function passwordStrength(password: string): { score: number; label: string } {
  let score = 0;
  if (password.length >= 8) score += 25;
  if (password.length >= 12) score += 25;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 20;
  if (/\d/.test(password)) score += 15;
  if (/[^a-zA-Z0-9]/.test(password)) score += 15;
  const label = score >= 80 ? "Fort" : score >= 50 ? "Correct" : "Faible";
  return { score, label };
}

const NOTIFICATION_LABELS: {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
}[] = [
  { key: "rent_late", label: "Loyers en retard", description: "Alerte dès qu'un loyer n'est pas reçu à la date prévue." },
  { key: "payment_received", label: "Paiements reçus", description: "Confirmation à chaque encaissement de loyer." },
  { key: "lease_expiring", label: "Bail bientôt terminé", description: "Alerte avant la date de fin d'un bail." },
  { key: "document_expiring", label: "Document bientôt expiré", description: "Assurance, diagnostics… avant leur échéance." },
  { key: "maintenance_overdue", label: "Travaux en retard", description: "Chantier dont la date prévue est dépassée." },
  { key: "monthly_report", label: "Rapport mensuel", description: "Synthèse de vos revenus et dépenses chaque début de mois." },
  { key: "product_updates", label: "Annonces produit", description: "Nouveautés et améliorations de Noviqo." },
];

const THEMES = [
  { value: "light", label: "Clair", icon: Sun },
  { value: "dark", label: "Sombre", icon: Moon },
  { value: "system", label: "Système", icon: Laptop },
] as const;

const emptySubscribe = () => () => {};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function SettingsPage() {
  const { data, profile, updateProfile, setAvatarPath, isLive } = useAppStore();
  // Exports : inclus à partir du plan Starter (affichage — le plan vient de la base).
  const exportCheck = isLive
    ? hasFeature(profile?.plan, "simple_exports")
    : { allowed: true, reason: null };
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(emptySubscribe, () => true, () => false);

  const demoGuard = () => {
    if (isSupabaseConfigured) return false;
    toast.info("Mode démo : configurez Supabase pour activer les comptes.");
    return true;
  };

  /* ---------- Profil ---------- */

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
      toast.success("Profil mis à jour.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    }
  });

  /* ---------- Avatar ---------- */

  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = React.useState(false);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);
  const avatarPath = profile?.avatarPath ?? null;

  React.useEffect(() => {
    if (!isSupabaseConfigured || !avatarPath) {
      setAvatarUrl(null);
      return;
    }
    let cancelled = false;
    getAvatarUrl(createClient(), avatarPath).then((url) => {
      if (!cancelled) setAvatarUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [avatarPath]);

  const onAvatarFile = async (file: File | null) => {
    if (!file || demoGuard()) return;
    setAvatarBusy(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expirée. Reconnectez-vous.");
      const { path, signedUrl } = await uploadAvatar(supabase, user.id, file, avatarPath);
      setAvatarPath(path);
      setAvatarUrl(signedUrl);
      toast.success("Photo de profil mise à jour.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setAvatarBusy(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const onAvatarDelete = async () => {
    if (!avatarPath || demoGuard()) return;
    setAvatarBusy(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expirée. Reconnectez-vous.");
      await deleteAvatar(supabase, user.id, avatarPath);
      setAvatarPath(null);
      setAvatarUrl(null);
      toast.success("Photo de profil supprimée.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suppression impossible.");
    } finally {
      setAvatarBusy(false);
    }
  };

  /* ---------- Changement d'e-mail ---------- */

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
      const valid = await verifyCurrentPassword(supabase, profile.email, values.currentPassword);
      if (!valid) {
        toast.error("Mot de passe actuel incorrect.");
        return;
      }
      await requestEmailChange(supabase, values.newEmail);
      resetEmail({ newEmail: "", currentPassword: "" });
      toast.success(
        "E-mails de confirmation envoyés (ancienne et nouvelle adresse). L'adresse changera après confirmation."
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Changement d'e-mail impossible.");
    }
  });

  /* ---------- Mot de passe ---------- */

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    watch: watchPassword,
    formState: { errors: passwordErrors, isSubmitting: isPasswordSubmitting },
  } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });
  const newPassword = watchPassword("password") ?? "";
  const strength = passwordStrength(newPassword);

  const onPasswordSubmit = handlePasswordSubmit(async (values) => {
    if (demoGuard()) return;
    try {
      const supabase = createClient();
      if (!profile?.email) throw new Error("Session expirée. Reconnectez-vous.");
      const valid = await verifyCurrentPassword(supabase, profile.email, values.current);
      if (!valid) {
        toast.error("Mot de passe actuel incorrect.");
        return;
      }
      await updatePassword(supabase, values.password);
      resetPassword({ current: "", password: "", confirm: "" });
      // Comportement Supabase : les autres sessions restent actives.
      // Utiliser « Se déconnecter partout » ci-dessous pour les révoquer.
      toast.success("Mot de passe mis à jour.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Mise à jour impossible.");
    }
  });

  /* ---------- Sessions ---------- */

  const [lastSignIn, setLastSignIn] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!isSupabaseConfigured) return;
    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        setLastSignIn(session?.user.last_sign_in_at ?? null);
      });
  }, []);

  const signOut = async (scope: "local" | "global") => {
    if (demoGuard()) return;
    const supabase = createClient();
    const { error } = await supabase.auth.signOut({ scope });
    if (error) {
      toast.error(error.message);
      return;
    }
    router.replace("/connexion");
    router.refresh();
  };

  /* ---------- Notifications ---------- */

  const [prefs, setPrefs] = React.useState<NotificationPreferences | null>(null);
  const [prefsError, setPrefsError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!isSupabaseConfigured) {
      setPrefs(DEFAULT_NOTIFICATION_PREFERENCES);
      return;
    }
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      try {
        setPrefs(await fetchNotificationPreferences(supabase, user.id));
      } catch (e) {
        logger.error("settings/notifications", e);
        setPrefsError("Chargement des préférences impossible. Rechargez la page.");
      }
    });
  }, []);

  const savePrefs = async (next: NotificationPreferences, previous: NotificationPreferences) => {
    setPrefs(next);
    if (!isSupabaseConfigured) return;
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expirée.");
      await saveNotificationPreferences(supabase, user.id, next);
      toast.success("Préférence enregistrée.");
    } catch (e) {
      setPrefs(previous); // rien n'a été enregistré : on revient à l'état réel
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    }
  };

  const togglePref = async (key: keyof NotificationPreferences, checked: boolean) => {
    if (!prefs) return;
    await savePrefs({ ...prefs, [key]: checked }, prefs);
  };

  const saveReminder = async (patch: Partial<NotificationPreferences>) => {
    if (!prefs) return;
    await savePrefs({ ...prefs, ...patch }, prefs);
  };

  /* ---------- Exports ---------- */

  const exportJson = () => {
    downloadFile(
      `immopilot-export-${new Date().toISOString().slice(0, 10)}.json`,
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
      `immopilot-loyers-${new Date().toISOString().slice(0, 10)}.csv`,
      [header, ...rows].join("\n"),
      "text/csv;charset=utf-8"
    );
    toast.success("Export CSV des loyers téléchargé.");
  };

  /* ---------- Suppression du compte ---------- */

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteSentence, setDeleteSentence] = React.useState("");
  const [deletePassword, setDeletePassword] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);

  const onDeleteAccount = async () => {
    if (demoGuard()) return;
    setDeleting(true);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: deleteSentence, password: deletePassword }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        toast.error(body.error ?? "Suppression impossible.");
        return;
      }
      await createClient().auth.signOut().catch(() => undefined);
      window.location.assign("/");
    } catch {
      toast.error("Erreur réseau : le compte n'a pas été supprimé.");
    } finally {
      setDeleting(false);
    }
  };

  /* ---------- Abonnement ---------- */

  const plan = getPlan(profile?.plan);
  const propertyCount = data.properties.length;
  const maxProperties = plan.limits.maxProperties;

  const initials =
    (profile?.fullName || "IP")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "IP";

  return (
    <>
      <PageHeader
        title="Paramètres"
        description="Gérez votre compte, votre sécurité, vos préférences et vos données"
      />

      <Tabs defaultValue="profile">
        <div className="overflow-x-auto">
          <TabsList
            variant="line"
            className="w-max min-w-full justify-start border-b border-border"
          >
            <TabsTrigger value="profile"><UserRound data-icon="inline-start" />Profil</TabsTrigger>
            <TabsTrigger value="security"><Shield data-icon="inline-start" />Sécurité</TabsTrigger>
            <TabsTrigger value="notifications"><Bell data-icon="inline-start" />Notifications</TabsTrigger>
            <TabsTrigger value="appearance"><Palette data-icon="inline-start" />Apparence</TabsTrigger>
            <TabsTrigger value="subscription"><CreditCard data-icon="inline-start" />Abonnement</TabsTrigger>
            <TabsTrigger value="data"><Download data-icon="inline-start" />Données</TabsTrigger>
          </TabsList>
        </div>

        {/* ================= Profil ================= */}
        <TabsContent value="profile" className="animate-panel-in space-y-4 pt-4">
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Photo de profil</CardTitle>
              <CardDescription>JPG, PNG ou WEBP — 20 Mo maximum.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <Avatar className="size-14">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt="Photo de profil" /> : null}
                <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => void onAvatarFile(e.target.files?.[0] ?? null)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={avatarBusy}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {avatarBusy ? "Envoi…" : avatarUrl ? "Remplacer" : "Ajouter une photo"}
                </Button>
                {avatarUrl ? (
                  <Button variant="ghost" disabled={avatarBusy} onClick={() => void onAvatarDelete()}>
                    Supprimer
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Informations</CardTitle>
              <CardDescription>Vos informations personnelles.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onProfileSubmit} className="space-y-4">
                <FormField label="Nom complet" htmlFor="fullName" error={errors.fullName?.message}>
                  <Input id="fullName" {...register("fullName")} />
                </FormField>
                <FormField label="Téléphone" htmlFor="phone" error={errors.phone?.message}>
                  <Input id="phone" type="tel" {...register("phone")} />
                </FormField>
                <FormField label="Entreprise / SCI (facultatif)" htmlFor="companyName" error={errors.companyName?.message}>
                  <Input id="companyName" {...register("companyName")} />
                </FormField>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Enregistrement…" : "Enregistrer"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Adresse e-mail</CardTitle>
              <CardDescription>
                Adresse actuelle : <span className="text-foreground">{profile?.email || "—"}</span>.
                Le changement est confirmé par e-mail sur l&apos;ancienne et la nouvelle adresse.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onEmailSubmit} className="space-y-4">
                <FormField label="Nouvelle adresse e-mail" htmlFor="newEmail" error={emailErrors.newEmail?.message}>
                  <Input id="newEmail" type="email" autoComplete="email" {...registerEmail("newEmail")} />
                </FormField>
                <FormField label="Mot de passe actuel" htmlFor="emailPassword" error={emailErrors.currentPassword?.message}>
                  <Input id="emailPassword" type="password" autoComplete="current-password" {...registerEmail("currentPassword")} />
                </FormField>
                <Button type="submit" disabled={emailSubmitting}>
                  {emailSubmitting ? "Envoi…" : "Changer d'adresse e-mail"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= Sécurité ================= */}
        <TabsContent value="security" className="animate-panel-in space-y-4 pt-4">
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Mot de passe</CardTitle>
              <CardDescription>
                Au moins 8 caractères. Après changement, les autres appareils
                restent connectés : utilisez « Se déconnecter partout » pour les révoquer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onPasswordSubmit} className="space-y-4">
                <FormField label="Mot de passe actuel" htmlFor="current-password" error={passwordErrors.current?.message}>
                  <Input id="current-password" type="password" autoComplete="current-password" {...registerPassword("current")} />
                </FormField>
                <FormField label="Nouveau mot de passe" htmlFor="new-password" error={passwordErrors.password?.message}>
                  <Input id="new-password" type="password" autoComplete="new-password" {...registerPassword("password")} />
                  {newPassword.length > 0 ? (
                    <div className="space-y-1 pt-1">
                      <Progress
                        value={strength.score}
                        aria-label="Robustesse du mot de passe"
                        indicatorClassName={
                          strength.score >= 80
                            ? "bg-emerald-600"
                            : strength.score >= 50
                              ? "bg-amber-500"
                              : "bg-red-500"
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Robustesse : {strength.label}
                      </p>
                    </div>
                  ) : null}
                </FormField>
                <FormField label="Confirmer le mot de passe" htmlFor="confirm-password" error={passwordErrors.confirm?.message}>
                  <Input id="confirm-password" type="password" autoComplete="new-password" {...registerPassword("confirm")} />
                </FormField>
                <Button type="submit" disabled={isPasswordSubmitting}>
                  {isPasswordSubmitting ? "Mise à jour…" : "Mettre à jour"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Sessions et appareils</CardTitle>
              <CardDescription>
                Supabase ne fournit pas la liste détaillée des appareils :
                seules la session actuelle et la déconnexion globale sont disponibles.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3.5 py-2.5">
                <div>
                  <p className="text-sm font-medium text-foreground">Cet appareil</p>
                  <p className="text-xs text-muted-foreground">
                    {lastSignIn
                      ? `Dernière connexion : ${new Date(lastSignIn).toLocaleString("fr-FR")}`
                      : "Session active"}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  Session actuelle
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void signOut("local")}>
                  <LogOut data-icon="inline-start" />
                  Se déconnecter de cet appareil
                </Button>
                <Button variant="outline" onClick={() => void signOut("global")}>
                  Se déconnecter partout
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= Notifications ================= */}
        <TabsContent value="notifications" className="animate-panel-in space-y-4 pt-4">
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Préférences de notifications</CardTitle>
              <CardDescription>
                « Appli » alimente le centre de notifications ; « E-mail »
                s&apos;appliquera dès qu&apos;un fournisseur d&apos;envoi sera configuré
                (aucun e-mail n&apos;est envoyé aujourd&apos;hui). Les e-mails de
                sécurité restent toujours actifs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {prefsError ? (
                <p className="text-sm text-destructive">{prefsError}</p>
              ) : !prefs ? (
                <p className="text-sm text-muted-foreground">Chargement des préférences…</p>
              ) : (
                <>
                  <div className="flex items-center justify-end gap-6 pb-1 text-[11px] font-medium text-muted-foreground uppercase">
                    <span>Appli</span>
                    <span>E-mail</span>
                  </div>
                  {NOTIFICATION_LABELS.map((setting, index) => {
                    const appKey = `${setting.key}_app` as keyof NotificationPreferences;
                    return (
                      <React.Fragment key={setting.key}>
                        {index > 0 ? <Separator /> : null}
                        <div className="flex items-center justify-between gap-4 py-2.5">
                          <div className="min-w-0 space-y-0.5">
                            <Label htmlFor={`notif-${setting.key}-app`}>{setting.label}</Label>
                            <p className="text-xs text-muted-foreground">{setting.description}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-6">
                            <Switch
                              id={`notif-${setting.key}-app`}
                              aria-label={`${setting.label} — dans l'application`}
                              checked={Boolean(prefs[appKey])}
                              onCheckedChange={(checked) => void togglePref(appKey, checked)}
                            />
                            <Switch
                              id={`notif-${setting.key}`}
                              aria-label={`${setting.label} — par e-mail`}
                              checked={Boolean(prefs[setting.key])}
                              onCheckedChange={(checked) => void togglePref(setting.key, checked)}
                            />
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </>
              )}
            </CardContent>
          </Card>

          {prefs ? (
            <Card className="max-w-xl">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Relances de loyers impayés</CardTitle>
                <CardDescription>
                  Configurez le comportement en cas d&apos;impayé. Aucun e-mail
                  automatique n&apos;est envoyé tant qu&apos;un fournisseur n&apos;est pas
                  configuré côté serveur — vos réglages sont conservés.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5" role="radiogroup" aria-label="Mode de relance">
                  {(
                    [
                      { value: "notification", label: "Notification dans l'application uniquement" },
                      { value: "email_owner", label: "M'envoyer un e-mail (propriétaire)" },
                      { value: "email_tenant", label: "Envoyer un rappel automatique au locataire" },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={prefs.rent_reminder_mode === option.value}
                      onClick={() => void saveReminder({ rent_reminder_mode: option.value })}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        prefs.rent_reminder_mode === option.value
                          ? "border-foreground bg-muted font-medium text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted/60"
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "size-2 rounded-full",
                          prefs.rent_reminder_mode === option.value ? "bg-primary" : "bg-border"
                        )}
                      />
                      {option.label}
                    </button>
                  ))}
                </div>

                {prefs.rent_reminder_mode !== "notification" ? (
                  <>
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium text-foreground">Jalons d&apos;envoi</p>
                      <div className="flex flex-wrap gap-2">
                        {[3, 7, 15].map((day) => {
                          const enabled = prefs.rent_reminder_days.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              aria-pressed={enabled}
                              onClick={() =>
                                void saveReminder({
                                  rent_reminder_days: enabled
                                    ? prefs.rent_reminder_days.filter((d) => d !== day)
                                    : [...prefs.rent_reminder_days, day].sort((a, b) => a - b),
                                })
                              }
                              className={cn(
                                "rounded-full border px-3 py-1 text-sm transition-colors",
                                enabled
                                  ? "border-foreground bg-foreground text-background"
                                  : "border-border text-muted-foreground hover:bg-muted"
                              )}
                            >
                              J+{day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {prefs.rent_reminder_mode === "email_tenant" ? (
                      <>
                        <div className="flex items-center justify-between gap-4">
                          <Label htmlFor="reminder-copy">M&apos;envoyer une copie</Label>
                          <Switch
                            id="reminder-copy"
                            checked={prefs.rent_reminder_copy_owner}
                            onCheckedChange={(checked) =>
                              void saveReminder({ rent_reminder_copy_owner: checked })
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="reminder-message">
                            Message personnalisé (facultatif)
                          </Label>
                          <textarea
                            id="reminder-message"
                            rows={3}
                            defaultValue={prefs.rent_reminder_custom_message ?? ""}
                            onBlur={(e) =>
                              void saveReminder({
                                rent_reminder_custom_message: e.target.value.trim() || null,
                              })
                            }
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            placeholder="Ajouté au rappel envoyé au locataire."
                          />
                        </div>
                      </>
                    ) : null}
                  </>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <TestEmailCard email={profile?.email ?? null} />
        </TabsContent>

        {/* ================= Apparence ================= */}
        <TabsContent value="appearance" className="animate-panel-in pt-4">
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Apparence</CardTitle>
              <CardDescription>
                Choisissez le thème de l&apos;interface. « Système » suit le réglage
                de votre appareil. La préférence est conservée sur cet appareil.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Thème">
                {THEMES.map((option) => {
                  const selected = mounted && theme === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        setTheme(option.value);
                        toast.success(`Thème « ${option.label} » appliqué.`);
                      }}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        selected
                          ? "border-foreground bg-muted font-medium text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      )}
                    >
                      <option.icon className="size-4" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= Abonnement ================= */}
        <TabsContent value="subscription" className="animate-panel-in space-y-4 pt-4">
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                Votre plan
                <PlanBadge planId={profile?.plan} />
              </CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Logements utilisés</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {propertyCount} / {maxProperties === null ? "illimité" : maxProperties}
                  </span>
                </div>
                {maxProperties !== null ? (
                  <Progress
                    value={Math.min(100, (propertyCount * 100) / maxProperties)}
                    aria-label="Logements utilisés"
                  />
                ) : null}
                <div className="flex items-center justify-between pt-1 text-sm">
                  <span className="text-muted-foreground">Documents</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {data.documents.length} /{" "}
                    {plan.limits.maxDocuments === null ? "illimité" : plan.limits.maxDocuments}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Photos</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {data.photos.length} /{" "}
                    {plan.limits.maxPhotos === null ? "illimité" : plan.limits.maxPhotos}
                  </span>
                </div>
              </div>
              <ul className="space-y-1.5">
                {plan.highlights.map((feature) => (
                  <li key={feature} className="text-sm text-muted-foreground">
                    · {feature}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Paiement en ligne bientôt disponible : le changement de plan se
                fera depuis cette page, sans engagement.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/abonnement" className={buttonVariants({ variant: "outline" })}>
                  <CreditCard data-icon="inline-start" />
                  Voir les plans
                </Link>
                <Link href="/tarifs" className={buttonVariants({ variant: "ghost" })}>
                  Page Tarifs
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= Données ================= */}
        <TabsContent value="data" className="animate-panel-in space-y-4 pt-4">
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Exporter mes données</CardTitle>
              <CardDescription>
                Export complet de vos données (profil, logements, locataires,
                baux, loyers, dépenses, travaux, métadonnées des documents et
                photos). Les fichiers eux-mêmes se téléchargent depuis leurs pages.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {exportCheck.allowed ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={exportJson}>
                    <Download data-icon="inline-start" />
                    Export complet (JSON)
                  </Button>
                  <Button variant="outline" onClick={exportCsv}>
                    <Download data-icon="inline-start" />
                    Loyers (CSV)
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">{exportCheck.reason}</p>
                  <Link
                    href="/abonnement"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Voir les plans
                  </Link>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Confidentialité</CardTitle>
              <CardDescription>
                Données stockées : compte (e-mail, nom, téléphone), logements,
                locataires, baux, loyers, dépenses, travaux, documents et photos.
                Elles sont conservées tant que le compte est actif et ne sont
                jamais partagées à des fins commerciales.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3 text-sm">
              <Link href="/confidentialite" className="text-foreground underline-offset-2 hover:underline">
                Politique de confidentialité
              </Link>
              <Link href="/cgu" className="text-foreground underline-offset-2 hover:underline">
                CGU
              </Link>
              <Link href="/mentions-legales" className="text-foreground underline-offset-2 hover:underline">
                Mentions légales
              </Link>
            </CardContent>
          </Card>

          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <LifeBuoy className="size-4" />
                Support
              </CardTitle>
              <CardDescription>Version {APP_VERSION}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Link href="/#faq" className={buttonVariants({ variant: "outline" })}>
                FAQ
              </Link>
              <Link href="/contact" className={buttonVariants({ variant: "outline" })}>
                Nous contacter
              </Link>
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("[Noviqo] Signalement de bug")}`}
                className={buttonVariants({ variant: "outline" })}
              >
                Signaler un bug
              </a>
              <Button
                variant="outline"
                onClick={() => window.dispatchEvent(new CustomEvent("immopilot:onboarding"))}
              >
                Revoir le guide
              </Button>
              <Button variant="outline" onClick={() => startProductTour()}>
                Revoir la visite
              </Button>
            </CardContent>
          </Card>

          {/* Zone dangereuse */}
          <Card className="max-w-xl border-destructive/30">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-destructive">
                Zone dangereuse
              </CardTitle>
              <CardDescription>
                La suppression du compte est définitive : logements, baux, loyers,
                documents et photos seront effacés. Exportez vos données avant.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 data-icon="inline-start" />
                Supprimer mon compte
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation forte de suppression */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!deleting) {
            setDeleteOpen(open);
            if (!open) {
              setDeleteSentence("");
              setDeletePassword("");
            }
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogTitle>Supprimer définitivement votre compte</DialogTitle>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cette action est irréversible : toutes vos données (logements,
              baux, loyers, documents, photos) et votre compte seront supprimés.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="delete-sentence">
                Saisissez « {DELETE_SENTENCE} » pour confirmer
              </Label>
              <Input
                id="delete-sentence"
                value={deleteSentence}
                onChange={(e) => setDeleteSentence(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="delete-password">Mot de passe</Label>
              <Input
                id="delete-password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={deleting} onClick={() => setDeleteOpen(false)}>
                Annuler
              </Button>
              <Button
                variant="destructive"
                disabled={
                  deleting || deleteSentence !== DELETE_SENTENCE || deletePassword.length === 0
                }
                onClick={() => void onDeleteAccount()}
              >
                {deleting ? "Suppression…" : "Supprimer définitivement"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
