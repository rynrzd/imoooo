"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitApplicationAction } from "@/features/nireo-id/actions/professional";
import {
  PRO_ACTIVITIES,
  PRO_ACTIVITY_LABELS,
  type ProActivity,
} from "@/features/nireo-id/constants";
import type { ProfessionalProfileRow } from "@/features/nireo-id/types";

/**
 * Candidature à un compte professionnel.
 * Déposer une candidature n'accorde AUCUN droit : le compte reste
 * « en attente » tant qu'un administrateur Nireo ne l'a pas approuvé.
 */
export function ProfessionalApplicationForm({
  profile,
  defaultEmail,
}: {
  profile: ProfessionalProfileRow | null;
  defaultEmail: string;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState({
    trade_name: profile?.trade_name ?? "",
    legal_name: profile?.legal_name ?? "",
    siret: profile?.siret ?? "",
    address: profile?.address ?? "",
    postal_code: profile?.postal_code ?? "",
    city: profile?.city ?? "",
    manager_name: profile?.manager_name ?? "",
    contact_email: profile?.contact_email ?? defaultEmail,
    contact_phone: profile?.contact_phone ?? "",
    activity: (profile?.activity ?? "reparation") as ProActivity,
  });
  const [accept, setAccept] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const set = (key: keyof typeof values, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const form = new FormData();
    for (const [key, value] of Object.entries(values)) form.set(key, value);
    form.set("accept_rules", accept ? "true" : "false");

    const result = await submitApplicationAction(form);
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success("Candidature transmise à l’équipe Nireo.");
    router.push("/id/pro");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="nid-panel space-y-5 rounded-2xl p-5 sm:p-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="trade_name">Nom commercial *</Label>
          <Input
            id="trade_name"
            value={values.trade_name}
            onChange={(event) => set("trade_name", event.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="legal_name">Raison sociale</Label>
          <Input
            id="legal_name"
            value={values.legal_name}
            onChange={(event) => set("legal_name", event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="siret">SIRET</Label>
          <Input
            id="siret"
            value={values.siret}
            onChange={(event) => set("siret", event.target.value)}
            inputMode="numeric"
            placeholder="14 chiffres"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="activity">Type d’activité *</Label>
          <select
            id="activity"
            value={values.activity}
            onChange={(event) => set("activity", event.target.value)}
            className="w-full rounded-xl border border-input bg-transparent text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {PRO_ACTIVITIES.map((value) => (
              <option key={value} value={value}>
                {PRO_ACTIVITY_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address">Adresse professionnelle</Label>
        <Input
          id="address"
          value={values.address}
          onChange={(event) => set("address", event.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="postal_code">Code postal</Label>
          <Input
            id="postal_code"
            value={values.postal_code}
            onChange={(event) => set("postal_code", event.target.value)}
            inputMode="numeric"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">Ville</Label>
          <Input id="city" value={values.city} onChange={(event) => set("city", event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="manager_name">Nom du responsable *</Label>
          <Input
            id="manager_name"
            value={values.manager_name}
            onChange={(event) => set("manager_name", event.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact_phone">Téléphone professionnel</Label>
          <Input
            id="contact_phone"
            type="tel"
            value={values.contact_phone}
            onChange={(event) => set("contact_phone", event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact_email">E-mail professionnel *</Label>
        <Input
          id="contact_email"
          type="email"
          value={values.contact_email}
          onChange={(event) => set("contact_email", event.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          C’est l’adresse qu’un client saisira pour vous donner accès à son
          téléphone, et celle à laquelle la décision vous sera notifiée.
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm">
        <input
          type="checkbox"
          checked={accept}
          onChange={(event) => setAccept(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 rounded border-input"
        />
        <span className="text-muted-foreground">
          Je m’engage à n’enregistrer que des interventions réellement
          effectuées, à corriger une erreur par révocation motivée plutôt que
          par suppression, et à n’accéder à un téléphone qu’avec l’accord de
          son propriétaire.
        </span>
      </label>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" data-touch disabled={pending || !accept}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
            Envoi…
          </>
        ) : (
          <>
            <Send className="size-4" data-icon="inline-start" />
            {profile ? "Mettre à jour ma candidature" : "Déposer ma candidature"}
          </>
        )}
      </Button>
    </form>
  );
}
