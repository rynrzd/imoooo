"use client";

import * as React from "react";
import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { TextAreaField } from "@/components/form/fields";
import { toUserMessage } from "@/components/form/errors";
import {
  SettingsPageShell,
  SettingsSection,
} from "@/components/profile/settings-shell";
import { TestEmailCard } from "@/components/shared/test-email-card";
import { logger } from "@/lib/logger";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  fetchNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/supabase/account";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Préférences — apparence et notifications.
 *
 * Le thème SOMBRE reste disponible et porte exactement la même identité que le
 * clair : ce ne sont pas deux designs, ce sont les mêmes jetons avec d'autres
 * valeurs de clarté (cf. globals.css). Le choix déjà enregistré des
 * utilisateurs est conservé — `next-themes` lit le même `localStorage` qu'avant,
 * rien n'a été réinitialisé.
 */

const THEMES = [
  { value: "light", label: "Clair", icon: Sun },
  { value: "dark", label: "Sombre", icon: Moon },
  { value: "system", label: "Système", icon: Laptop },
] as const;

const NOTIFICATIONS: {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
}[] = [
  {
    key: "rent_late",
    label: "Loyers en retard",
    description: "Dès qu'un loyer n'est pas reçu à la date prévue.",
  },
  {
    key: "payment_received",
    label: "Paiements reçus",
    description: "À chaque encaissement de loyer.",
  },
  {
    key: "lease_expiring",
    label: "Bail bientôt terminé",
    description: "Avant la date de fin d'un bail.",
  },
  {
    key: "document_expiring",
    label: "Document bientôt expiré",
    description: "Assurance, diagnostics… avant leur échéance.",
  },
  {
    key: "maintenance_overdue",
    label: "Travaux en retard",
    description: "Chantier dont la date prévue est dépassée.",
  },
  {
    key: "monthly_report",
    label: "Rapport mensuel",
    description: "Synthèse de vos revenus et dépenses chaque début de mois.",
  },
  {
    key: "product_updates",
    label: "Annonces produit",
    description: "Nouveautés et améliorations de Nireo.",
  },
];

const REMINDER_MODES = [
  { value: "notification", label: "Notification dans l'application uniquement" },
  { value: "email_owner", label: "M'envoyer un e-mail (propriétaire)" },
  { value: "email_tenant", label: "Envoyer un rappel automatique au locataire" },
] as const;

const emptySubscribe = () => () => {};

export default function PreferencesPage() {
  const { profile } = useAppStore();
  const { theme, setTheme } = useTheme();
  // Le thème n'est connu qu'après hydratation : cocher avant produirait un
  // décalage serveur/client.
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const [prefs, setPrefs] = React.useState<NotificationPreferences | null>(null);
  const [prefsError, setPrefsError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Différé d'un tick : aucun setState synchrone dans le corps de l'effet.
    const id = window.setTimeout(() => {
      if (!isSupabaseConfigured) {
        setPrefs(DEFAULT_NOTIFICATION_PREFERENCES);
        return;
      }
      const supabase = createClient();
      void supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user) return;
        try {
          setPrefs(await fetchNotificationPreferences(supabase, user.id));
        } catch (e) {
          logger.error("profil/preferences", e);
          setPrefsError(
            "Chargement des préférences impossible. Rechargez la page."
          );
        }
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  /** Écriture optimiste, ANNULÉE si le serveur refuse — jamais de faux succès. */
  const save = async (
    next: NotificationPreferences,
    previous: NotificationPreferences
  ) => {
    setPrefs(next);
    if (!isSupabaseConfigured) return;
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expirée. Reconnectez-vous.");
      await saveNotificationPreferences(supabase, user.id, next);
    } catch (e) {
      setPrefs(previous);
      toast.error(toUserMessage(e, "Préférence non enregistrée."));
    }
  };

  const toggle = (key: keyof NotificationPreferences, checked: boolean) => {
    if (!prefs) return;
    void save({ ...prefs, [key]: checked }, prefs);
  };

  const patch = (values: Partial<NotificationPreferences>) => {
    if (!prefs) return;
    void save({ ...prefs, ...values }, prefs);
  };

  return (
    <SettingsPageShell
      title="Préférences"
      description="L'apparence de l'interface et ce dont Nireo vous prévient."
    >
      {/* ---------- Apparence ---------- */}
      <SettingsSection
        title="Apparence"
        description="« Système » suit le réglage de votre appareil. La préférence est conservée sur cet appareil."
      >
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Thème">
          {THEMES.map((option) => {
            const selected = mounted && theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTheme(option.value)}
                className={cn(
                  "flex min-h-20 flex-col items-center justify-center gap-2 rounded-[0.625rem] border text-sm transition-colors duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                  selected
                    ? "border-primary bg-primary-soft font-semibold text-primary"
                    : "border-input bg-card font-normal text-foreground hover:bg-accent"
                )}
              >
                <option.icon className="size-4" aria-hidden />
                {option.label}
              </button>
            );
          })}
        </div>
      </SettingsSection>

      {/* ---------- Notifications ---------- */}
      <SettingsSection
        title="Notifications"
        description="« Appli » alimente le centre de notifications. « E-mail » s'appliquera dès qu'un fournisseur d'envoi sera configuré côté serveur — aucun e-mail n'est envoyé aujourd'hui. Les e-mails de sécurité restent toujours actifs."
      >
        {prefsError ? (
          <p role="alert" className="text-sm text-danger">
            {prefsError}
          </p>
        ) : !prefs ? (
          <p className="text-sm text-muted-foreground">
            Chargement des préférences…
          </p>
        ) : (
          <div>
            <div className="flex items-center justify-end gap-6 pr-1 pb-2 text-[11px] font-medium text-muted-foreground uppercase">
              <span className="w-9 text-center">Appli</span>
              <span className="w-9 text-center">E-mail</span>
            </div>
            <ul className="divide-y divide-border">
              {NOTIFICATIONS.map((setting) => {
                const appKey =
                  `${setting.key}_app` as keyof NotificationPreferences;
                return (
                  <li
                    key={setting.key}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div className="min-w-0">
                      <label
                        htmlFor={`notif-${setting.key}-app`}
                        className="block text-sm font-medium text-foreground"
                      >
                        {setting.label}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {setting.description}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-6">
                      <Switch
                        id={`notif-${setting.key}-app`}
                        aria-label={`${setting.label} — dans l'application`}
                        checked={Boolean(prefs[appKey])}
                        onCheckedChange={(checked) => toggle(appKey, checked)}
                      />
                      <Switch
                        id={`notif-${setting.key}`}
                        aria-label={`${setting.label} — par e-mail`}
                        checked={Boolean(prefs[setting.key])}
                        onCheckedChange={(checked) =>
                          toggle(setting.key, checked)
                        }
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </SettingsSection>

      {/* ---------- Relances ---------- */}
      {prefs ? (
        <SettingsSection
          title="Relances de loyers impayés"
          description="Vos réglages sont conservés. Aucun e-mail automatique n'est envoyé tant qu'un fournisseur n'est pas configuré côté serveur."
        >
          <div className="space-y-4">
            <div
              className="space-y-2"
              role="radiogroup"
              aria-label="Mode de relance"
            >
              {REMINDER_MODES.map((option) => {
                const active = prefs.rent_reminder_mode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => patch({ rent_reminder_mode: option.value })}
                    className={cn(
                      "flex min-h-12 w-full items-center gap-3 rounded-[0.625rem] border px-3 text-left text-sm transition-colors duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                      active
                        ? "border-primary bg-primary-soft font-medium text-foreground"
                        : "border-input bg-card text-muted-foreground hover:bg-accent"
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-4 shrink-0 place-items-center rounded-full border-2",
                        active ? "border-primary" : "border-border"
                      )}
                    >
                      {active ? (
                        <span className="size-1.5 rounded-full bg-primary" />
                      ) : null}
                    </span>
                    {option.label}
                  </button>
                );
              })}
            </div>

            {prefs.rent_reminder_mode !== "notification" ? (
              <div className="space-y-4 border-t border-border pt-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Jalons d&apos;envoi
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[3, 7, 15].map((day) => {
                      const enabled = prefs.rent_reminder_days.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          aria-pressed={enabled}
                          onClick={() =>
                            patch({
                              rent_reminder_days: enabled
                                ? prefs.rent_reminder_days.filter(
                                    (d) => d !== day
                                  )
                                : [...prefs.rent_reminder_days, day].sort(
                                    (a, b) => a - b
                                  ),
                            })
                          }
                          className={cn(
                            "min-h-11 rounded-[0.625rem] border px-4 text-sm transition-colors duration-200",
                            enabled
                              ? "border-primary bg-primary font-semibold text-primary-foreground"
                              : "border-input bg-card text-muted-foreground hover:bg-accent"
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
                      <label
                        htmlFor="reminder-copy"
                        className="text-sm font-medium text-foreground"
                      >
                        M&apos;envoyer une copie
                      </label>
                      <Switch
                        id="reminder-copy"
                        checked={prefs.rent_reminder_copy_owner}
                        onCheckedChange={(checked) =>
                          patch({ rent_reminder_copy_owner: checked })
                        }
                      />
                    </div>
                    <TextAreaField
                      id="reminder-message"
                      label="Message personnalisé"
                      optional
                      hint="Ajouté au rappel envoyé au locataire."
                      defaultValue={prefs.rent_reminder_custom_message ?? ""}
                      onBlur={(e) =>
                        patch({
                          rent_reminder_custom_message:
                            e.target.value.trim() || null,
                        })
                      }
                    />
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </SettingsSection>
      ) : null}

      <TestEmailCard email={profile?.email ?? null} />
    </SettingsPageShell>
  );
}
