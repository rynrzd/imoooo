"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PARTNER_TYPE_LABELS,
  type MarketingPartnerRow,
  type PartnerType,
} from "@/lib/marketing/types";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none " +
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const PLAN_CHOICES = [
  { id: "starter", label: "Starter" },
  { id: "pro", label: "Pro" },
  { id: "business", label: "Business+" },
] as const;

interface FormState {
  name: string;
  companyName: string;
  partnerType: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  commissionType: string;
  commissionValue: string;
  commissionDurationType: string;
  commissionDurationMonths: string;
  applicablePlans: string[];
  attributionWindowDays: string;
  isActive: boolean;
  startsAt: string;
  expiresAt: string;
}

function initialState(partner?: MarketingPartnerRow): FormState {
  return {
    name: partner?.name ?? "",
    companyName: partner?.company_name ?? "",
    partnerType: partner?.partner_type ?? "autre",
    contactName: partner?.contact_name ?? "",
    email: partner?.email ?? "",
    phone: partner?.phone ?? "",
    address: partner?.address ?? "",
    notes: partner?.notes ?? "",
    commissionType: partner?.commission_type ?? "percent",
    commissionValue: partner ? String(partner.commission_value) : "",
    commissionDurationType: partner?.commission_duration_type ?? "first_payment",
    commissionDurationMonths: partner?.commission_duration_months
      ? String(partner.commission_duration_months)
      : "",
    applicablePlans: partner?.applicable_plans ?? [],
    attributionWindowDays: String(partner?.attribution_window_days ?? 30),
    isActive: partner?.is_active ?? true,
    startsAt: partner?.starts_at ? partner.starts_at.slice(0, 10) : "",
    expiresAt: partner?.expires_at ? partner.expires_at.slice(0, 10) : "",
  };
}

/**
 * Formulaire partenaire (création + modification). Le navigateur envoie
 * les valeurs à la route API admin : la validation FAIT FOI côté serveur,
 * le code et le lien uniques sont générés serveur, jamais ici.
 */
export function PartnerFormDialog({
  partner,
  triggerLabel,
  triggerVariant = "default",
}: {
  partner?: MarketingPartnerRow;
  triggerLabel: string;
  triggerVariant?: "default" | "outline";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(() => initialState(partner));

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const togglePlan = (id: string) =>
    set(
      "applicablePlans",
      form.applicablePlans.includes(id)
        ? form.applicablePlans.filter((p) => p !== id)
        : [...form.applicablePlans, id]
    );

  const submit = async () => {
    if (pending) return;
    if (!form.name.trim()) return void toast.error("Le nom du partenaire est requis.");
    const value = Number(form.commissionValue.replace(",", "."));
    if (form.commissionValue !== "" && (!Number.isFinite(value) || value < 0)) {
      return void toast.error("Taux de commission invalide.");
    }
    setPending(true);
    try {
      const response = await fetch("/api/admin/marketing/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: partner ? "update" : "create",
          partnerId: partner?.id,
          values: {
            name: form.name,
            companyName: form.companyName,
            partnerType: form.partnerType,
            contactName: form.contactName,
            email: form.email,
            phone: form.phone,
            address: form.address,
            notes: form.notes,
            commissionType: form.commissionType,
            commissionValue: form.commissionValue === "" ? 0 : value,
            commissionDurationType: form.commissionDurationType,
            commissionDurationMonths: form.commissionDurationMonths
              ? Number(form.commissionDurationMonths)
              : null,
            applicablePlans: form.applicablePlans,
            attributionWindowDays: Number(form.attributionWindowDays) || 30,
            isActive: form.isActive,
            startsAt: form.startsAt,
            expiresAt: form.expiresAt,
          },
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        partnerId?: string;
      };
      if (response.ok && result.ok) {
        toast.success(result.message ?? "Partenaire enregistré.");
        setOpen(false);
        if (!partner) setForm(initialState());
        if (!partner && result.partnerId) {
          router.push(`/admin/marketing/partenaires/${result.partnerId}`);
        } else {
          router.refresh();
        }
      } else {
        toast.error(result.error ?? "Enregistrement impossible.");
      }
    } catch {
      toast.error("Enregistrement impossible. Vérifiez votre connexion.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant={triggerVariant} />}>
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{partner ? "Modifier le partenaire" : "Nouveau partenaire"}</DialogTitle>
          <DialogDescription>
            {partner
              ? "Le code et le lien uniques ne changent jamais."
              : "Le code, le slug, le lien et le QR code uniques sont générés automatiquement."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Nom du partenaire *</Label>
              <Input id="p-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Assurance Dupont" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-company">Entreprise</Label>
              <Input id="p-company" value={form.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="Dupont Assurances SARL" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-type">Type de partenaire</Label>
              <select id="p-type" value={form.partnerType} onChange={(e) => set("partnerType", e.target.value)} className={SELECT_CLASS}>
                {(Object.keys(PARTNER_TYPE_LABELS) as PartnerType[]).map((type) => (
                  <option key={type} value={type}>
                    {PARTNER_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-contact">Nom du contact</Label>
              <Input id="p-contact" value={form.contactName} onChange={(e) => set("contactName", e.target.value)} placeholder="Marie Dupont" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-email">E-mail</Label>
              <Input id="p-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="contact@exemple.fr" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-phone">Téléphone</Label>
              <Input id="p-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="06 12 34 56 78" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-address">Adresse</Label>
            <Input id="p-address" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="12 rue de la Paix, 75002 Paris" />
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Commission — rien n’est versé sans configuration explicite.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-ctype">Type de commission</Label>
                <select id="p-ctype" value={form.commissionType} onChange={(e) => set("commissionType", e.target.value)} className={SELECT_CLASS}>
                  <option value="percent">Pourcentage (%)</option>
                  <option value="fixed">Montant fixe (€) / client payant</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-cvalue">
                  {form.commissionType === "percent" ? "Pourcentage (%)" : "Montant (€)"}
                </Label>
                <Input id="p-cvalue" inputMode="decimal" value={form.commissionValue} onChange={(e) => set("commissionValue", e.target.value)} placeholder={form.commissionType === "percent" ? "10" : "25"} />
              </div>
            </div>
            {form.commissionType === "percent" ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="p-cduration">Durée de la commission</Label>
                  <select id="p-cduration" value={form.commissionDurationType} onChange={(e) => set("commissionDurationType", e.target.value)} className={SELECT_CLASS}>
                    <option value="first_payment">Premier paiement uniquement</option>
                    <option value="months">Pendant N mois</option>
                    <option value="lifetime">Tant que l’abonnement est actif</option>
                  </select>
                </div>
                {form.commissionDurationType === "months" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="p-cmonths">Nombre de mois</Label>
                    <Input id="p-cmonths" inputMode="numeric" value={form.commissionDurationMonths} onChange={(e) => set("commissionDurationMonths", e.target.value)} placeholder="12" />
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="mt-3 space-y-1.5">
              <Label>Plans concernés</Label>
              <div className="flex flex-wrap gap-3">
                {PLAN_CHOICES.map((plan) => (
                  <label key={plan.id} className="flex cursor-pointer items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={form.applicablePlans.includes(plan.id)}
                      onChange={() => togglePlan(plan.id)}
                      className="size-4 rounded border-border"
                    />
                    {plan.label}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Aucune case cochée = tous les plans payants.</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-window">Attribution (jours)</Label>
              <Input id="p-window" inputMode="numeric" value={form.attributionWindowDays} onChange={(e) => set("attributionWindowDays", e.target.value)} placeholder="30" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-start">Début</Label>
              <Input id="p-start" type="date" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-end">Fin</Label>
              <Input id="p-end" type="date" value={form.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-notes">Notes internes</Label>
            <textarea
              id="p-notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              placeholder="Jamais visibles par le partenaire ni les clients."
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
              className="size-4 rounded border-border"
            />
            Partenaire actif (lien et attributions ouverts)
          </label>
        </div>

        <DialogFooter showCloseButton>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Enregistrement…" : partner ? "Enregistrer" : "Créer le partenaire"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
