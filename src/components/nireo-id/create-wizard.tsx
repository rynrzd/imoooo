"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImagePlus,
  Loader2,
  Lock,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAssetAction } from "@/features/nireo-id/actions/owner";
import { BoxScanner } from "./box-scanner";
import {
  ADD_METHODS,
  ADD_METHOD_HINTS,
  ADD_METHOD_LABELS,
  ALLOWED_DOCUMENT_MIME,
  ALLOWED_IMAGE_MIME,
  CHECK_FREQUENCIES,
  CONDITION_GRADES,
  EPREL_HOSTS,
  type AddMethod,
  CONDITION_GRADE_LABELS,
  CONDITION_POINTS,
  MAX_CONDITION_PHOTOS,
  MAX_DOCUMENT_BYTES,
  MAX_PHOTO_BYTES,
  PURCHASE_CONDITIONS,
  PURCHASE_CONDITION_LABELS,
  type ConditionGrade,
  type PurchaseCondition,
} from "@/features/nireo-id/constants";
import { formatFileSize } from "@/features/nireo-id/format";
import { cn } from "@/lib/utils";

/**
 * Ajout d'un téléphone — quatre étapes, mobile d'abord.
 *
 * Objectif : moins de 90 secondes lorsque l'utilisateur a la boîte ou la
 * facture. Les saisies (texte et fichiers) sont conservées d'une étape à
 * l'autre. RIEN n'est écrit en base avant la dernière étape : la création
 * est atomique côté serveur, et un échec ne laisse ni fiche partielle ni
 * fichier orphelin.
 */

const STEPS = [
  { title: "Méthode", hint: "Comment ajouter" },
  { title: "Informations", hint: "L'appareil" },
  { title: "État initial", hint: "Constat" },
  { title: "Confirmation", hint: "Création" },
] as const;

interface Draft {
  brand: string;
  model: string;
  color: string;
  storage_capacity: string;
  serial_number: string;
  imei: string;
  purchase_date: string;
  purchase_source: string;
  purchase_condition: PurchaseCondition;
  warranty_end: string;
  internal_reference: string;
  eprel_url: string;
  check_frequency_months: string;
  condition: Partial<Record<string, ConditionGrade>>;
  battery_health: string;
  condition_comment: string;
}

const EMPTY_DRAFT: Draft = {
  brand: "",
  model: "",
  color: "",
  storage_capacity: "",
  serial_number: "",
  imei: "",
  purchase_date: "",
  purchase_source: "",
  purchase_condition: "inconnu",
  warranty_end: "",
  internal_reference: "",
  eprel_url: "",
  check_frequency_months: "1",
  condition: {},
  battery_health: "",
  condition_comment: "",
};

export function CreateWizard({
  workspaceId = null,
  workspaceName = null,
}: {
  workspaceId?: string | null;
  workspaceName?: string | null;
} = {}) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [method, setMethod] = React.useState<AddMethod | null>(null);
  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT);
  const [primaryPhoto, setPrimaryPhoto] = React.useState<File | null>(null);
  const [conditionPhotos, setConditionPhotos] = React.useState<File[]>([]);
  const [purchaseProof, setPurchaseProof] = React.useState<File | null>(null);
  const [consent, setConsent] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<{
    id: string;
    public_id: string;
    next_check_on?: string;
  } | null>(null);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  /**
   * Valeur lue par la caméra : on ne préremplit QUE ce qui est réellement
   * reconnu. Aucune caractéristique n'est inventée à partir d'un lien.
   */
  const applyScan = (raw: string) => {
    const value = raw.trim();
    const digits = value.replace(/\D/g, "");

    if (/^https?:\/\//i.test(value)) {
      try {
        const url = new URL(value);
        if ((EPREL_HOSTS as readonly string[]).includes(url.hostname)) {
          update("eprel_url", url.toString());
          toast.info(
            "Étiquette européenne reconnue. Ouvrez la fiche officielle et confirmez les informations."
          );
          return;
        }
      } catch {
        // Lien illisible : on retombe sur la saisie manuelle.
      }
      toast.error("Ce code ne correspond pas à une étiquette officielle. Saisissez les informations.");
      return;
    }

    if (digits.length === 15) {
      update("imei", digits);
      toast.success("IMEI détecté. Vérifiez-le avant de continuer.");
      return;
    }
    if (value.length >= 5) {
      update("serial_number", value);
      toast.success("Numéro de série détecté. Vérifiez-le avant de continuer.");
      return;
    }
    toast.error("Code illisible. Saisissez les informations manuellement.");
  };

  const canContinue = () => {
    if (step === 0) return method !== null;
    if (step === 1) return draft.brand.trim().length > 0 && draft.model.trim().length > 0;
    if (step === 3) return consent;
    return true;
  };

  const goNext = () => {
    if (!canContinue()) {
      setError(
        step === 0
          ? "Choisissez une méthode d’ajout."
          : step === 1
            ? "Renseignez au minimum la marque et le modèle."
            : "Confirmez l'exactitude des informations déclarées."
      );
      return;
    }
    setError(null);
    setStep((value) => Math.min(value + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setError(null);
    setStep((value) => Math.max(value - 1, 0));
  };

  const pickPhoto = (file: File | null, target: "primary" | "condition") => {
    if (!file) return;
    if (!(ALLOWED_IMAGE_MIME as readonly string[]).includes(file.type)) {
      toast.error("Format d'image non pris en charge (JPEG, PNG, WebP ou HEIC).");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error(`Photo trop volumineuse : ${formatFileSize(MAX_PHOTO_BYTES)} maximum.`);
      return;
    }
    if (target === "primary") {
      setPrimaryPhoto(file);
      return;
    }
    setConditionPhotos((current) => {
      if (current.length >= MAX_CONDITION_PHOTOS) {
        toast.error(`${MAX_CONDITION_PHOTOS} photos maximum pour le constat d'état.`);
        return current;
      }
      return [...current, file];
    });
  };

  const pickProof = (file: File | null) => {
    if (!file) return;
    if (!(ALLOWED_DOCUMENT_MIME as readonly string[]).includes(file.type)) {
      toast.error("Format non pris en charge (PDF, JPEG, PNG, WebP ou HEIC).");
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      toast.error(`Fichier trop volumineux : ${formatFileSize(MAX_DOCUMENT_BYTES)} maximum.`);
      return;
    }
    setPurchaseProof(file);
  };

  const submit = async () => {
    if (pending) return;
    if (!consent) {
      setError("Confirmez l’exactitude des informations déclarées.");
      return;
    }
    setPending(true);
    setError(null);

    const form = new FormData();
    form.set("brand", draft.brand);
    form.set("model", draft.model);
    form.set("color", draft.color);
    form.set("storage_capacity", draft.storage_capacity);
    form.set("serial_number", draft.serial_number);
    form.set("imei", draft.imei);
    form.set("purchase_date", draft.purchase_date);
    form.set("purchase_source", draft.purchase_source);
    form.set("purchase_condition", draft.purchase_condition);
    form.set("warranty_end", draft.warranty_end);
    form.set("internal_reference", draft.internal_reference);
    form.set("eprel_url", draft.eprel_url);
    form.set("check_frequency_months", draft.check_frequency_months);
    if (workspaceId) form.set("workspace_id", workspaceId);
    form.set("consent_accuracy", "true");
    for (const point of CONDITION_POINTS) {
      const grade = draft.condition[point.key];
      if (grade) form.set(`condition_${point.key}`, grade);
    }
    if (draft.battery_health) form.set("battery_health", draft.battery_health);
    if (draft.condition_comment) form.set("condition_comment", draft.condition_comment);
    if (primaryPhoto) form.set("primary_photo", primaryPhoto);
    if (purchaseProof) form.set("purchase_proof", purchaseProof);
    for (const photo of conditionPhotos) form.append("condition_photos", photo);

    const result = await createAssetAction(form);
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    // Écran de confirmation : la fiche n'est proposée qu'APRÈS écriture
    // réelle en base (identifiant public renvoyé par le serveur).
    setCreated(result.data);
    router.refresh();
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  /* ---------------- Étape 4 : confirmation ---------------- */
  if (created) {
    return (
      <div className="space-y-6">
        <div className="nid-panel rounded-lg p-6 text-center">
          <Check className="mx-auto size-7 text-[var(--nid-success)]" aria-hidden />
          <h1 className="mt-4 text-xl font-semibold text-foreground">
            Votre téléphone a bien été ajouté.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {draft.brand} {draft.model} — identifiant{" "}
            <span className="font-mono">{created.public_id}</span>
          </p>
          {created.next_check_on ? (
            <p className="mt-3 border-l-2 border-primary py-2 pl-4 text-sm text-foreground">
              Premier bilan prévu le{" "}
              {new Date(`${created.next_check_on}T00:00:00`).toLocaleDateString("fr-FR")}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button data-touch render={<Link href={`/id/app/objets/${created.id}`} />}>
              Voir mon téléphone
            </Button>
            <Button
              variant="outline"
              data-touch
              render={<Link href={workspaceId ? `/id/entreprise/${workspaceId}/parc` : "/id/app"} />}
            >
              {workspaceId ? "Revenir au parc" : "Revenir à l’accueil"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-semibold text-foreground">Ajouter mon téléphone</h1>
          <p className="text-sm text-muted-foreground tabular-nums">
            Étape {step + 1} / {STEPS.length}
          </p>
        </div>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-label="Progression de la création"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-sm font-medium text-foreground">{STEPS[step].title}</p>
      </div>

      <div className="nid-panel rounded-lg p-5 sm:p-6">
        {/* ---------------- Étape 1 : méthode ---------------- */}
        {step === 0 ? (
          <fieldset className="space-y-4">
            <legend className="text-sm font-medium text-foreground">
              Comment souhaitez-vous ajouter ce téléphone ?
            </legend>

            <div className="grid gap-2 sm:grid-cols-2">
              {ADD_METHODS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMethod(value)}
                  aria-pressed={method === value}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-colors",
                    method === value
                      ? "border-primary bg-accent"
                      : "border-border bg-card hover:bg-muted"
                  )}
                >
                  <span className="block text-sm font-medium text-foreground">
                    {ADD_METHOD_LABELS[value]}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {ADD_METHOD_HINTS[value]}
                  </span>
                </button>
              ))}
            </div>

            {method === "scan" || method === "etiquette" ? (
              <BoxScanner
                onDetected={applyScan}
                label={method === "scan" ? "Scanner la boîte" : "Scanner l’étiquette"}
              />
            ) : null}

            {method === "etiquette" && draft.eprel_url ? (
              <p className="nid-note rounded-xl p-3 text-xs">
                Étiquette officielle reconnue.{" "}
                <a
                  href={draft.eprel_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline underline-offset-2"
                >
                  Ouvrir la fiche officielle
                </a>{" "}
                puis confirmez les informations à l’étape suivante. Nireo ne préremplit aucune
                caractéristique qu’elle n’a pas réellement récupérée.
              </p>
            ) : null}

            {method === "facture" ? (
              <>
                <FilePicker
                  id="purchase-proof-first"
                  label="Facture ou preuve d’achat"
                  hint={`PDF ou image — ${formatFileSize(MAX_DOCUMENT_BYTES)} maximum. Document privé par défaut.`}
                  accept={ALLOWED_DOCUMENT_MIME.join(",")}
                  file={purchaseProof}
                  onPick={pickProof}
                  onClear={() => setPurchaseProof(null)}
                />
                <p className="rounded-xl border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Le document est conservé dans votre espace privé. Aucune lecture automatique
                  n’est effectuée : vous saisissez les informations à l’étape suivante.
                </p>
              </>
            ) : null}

            {method === "manuel" ? (
              <p className="rounded-xl border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                Vous saisirez la marque, le modèle et les informations dont vous disposez à
                l’étape suivante. Rien n’est obligatoire en dehors de la marque et du modèle.
              </p>
            ) : null}
          </fieldset>
        ) : null}

        {/* ---------------- Étape 2 : informations ---------------- */}
        {step === 1 ? (
          <fieldset className="space-y-4">
            <legend className="sr-only">Identité de l’appareil</legend>
            <p className="border-l-2 border-border py-1.5 pl-3 text-xs text-muted-foreground">
              Catégorie : <strong className="text-foreground">téléphone</strong> — seule
              catégorie disponible aujourd’hui.
            </p>
            <Field label="Marque" htmlFor="brand" required>
              <Input
                id="brand"
                value={draft.brand}
                onChange={(event) => update("brand", event.target.value)}
                placeholder="Apple, Samsung, Xiaomi…"
                autoComplete="off"
                required
              />
            </Field>
            <Field label="Modèle" htmlFor="model" required>
              <Input
                id="model"
                value={draft.model}
                onChange={(event) => update("model", event.target.value)}
                placeholder="iPhone 13, Galaxy S22…"
                autoComplete="off"
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Couleur (facultatif)" htmlFor="color">
                <Input
                  id="color"
                  value={draft.color}
                  onChange={(event) => update("color", event.target.value)}
                  placeholder="Bleu nuit"
                />
              </Field>
              <Field label="Stockage (facultatif)" htmlFor="storage">
                <Input
                  id="storage"
                  value={draft.storage_capacity}
                  onChange={(event) => update("storage_capacity", event.target.value)}
                  placeholder="128 Go"
                />
              </Field>
            </div>

            <FilePicker
              id="primary-photo"
              label="Photo principale (facultatif)"
              hint={`Images JPEG, PNG, WebP ou HEIC — ${formatFileSize(MAX_PHOTO_BYTES)} maximum.`}
              accept={ALLOWED_IMAGE_MIME.join(",")}
              file={primaryPhoto}
              onPick={(file) => pickPhoto(file, "primary")}
              onClear={() => setPrimaryPhoto(null)}
            />
          </fieldset>
        ) : null}

        {step === 1 ? (
          <fieldset className="mt-6 space-y-4">
            <legend className="sr-only">Identifiants privés</legend>
            <p className="flex items-start gap-2.5 rounded-xl border border-border bg-muted px-3 py-3 text-xs leading-relaxed text-muted-foreground">
              <Lock className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
              Ces identifiants restent privés. Ils ne sont jamais affichés sur
              une page publique : au maximum les quatre derniers caractères, et
              seulement si vous l’autorisez.
            </p>
            <Field label="Numéro de série (facultatif)" htmlFor="serial">
              <Input
                id="serial"
                value={draft.serial_number}
                onChange={(event) => update("serial_number", event.target.value)}
                placeholder="F2LX…"
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
            <Field label="IMEI (facultatif)" htmlFor="imei">
              <Input
                id="imei"
                value={draft.imei}
                onChange={(event) => update("imei", event.target.value)}
                placeholder="15 chiffres"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              Astuce : composez <span className="font-mono">*#06#</span> sur le
              téléphone pour afficher son IMEI.
            </p>
          </fieldset>
        ) : null}

        {step === 1 ? (
          <fieldset className="mt-6 space-y-4">
            <legend className="sr-only">Achat et propriété</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date d’achat (facultatif)" htmlFor="purchase-date">
                <Input
                  id="purchase-date"
                  type="date"
                  value={draft.purchase_date}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => update("purchase_date", event.target.value)}
                />
              </Field>
              <Field label="Vendeur ou enseigne (facultatif)" htmlFor="purchase-source">
                <Input
                  id="purchase-source"
                  value={draft.purchase_source}
                  onChange={(event) => update("purchase_source", event.target.value)}
                  placeholder="Boutique, site, particulier…"
                />
              </Field>
            </div>

            <Field label="État à l’acquisition" htmlFor="purchase-condition">
              <select
                id="purchase-condition"
                value={draft.purchase_condition}
                onChange={(event) =>
                  update("purchase_condition", event.target.value as PurchaseCondition)
                }
                className="w-full rounded-xl border border-input bg-transparent text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {PURCHASE_CONDITIONS.map((value) => (
                  <option key={value} value={value}>
                    {PURCHASE_CONDITION_LABELS[value]}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fin de garantie (facultatif)" htmlFor="warranty-end">
                <Input
                  id="warranty-end"
                  type="date"
                  value={draft.warranty_end}
                  onChange={(event) => update("warranty_end", event.target.value)}
                />
              </Field>
              <Field label="Fréquence des bilans" htmlFor="check-frequency">
                <select
                  id="check-frequency"
                  value={draft.check_frequency_months}
                  onChange={(event) => update("check_frequency_months", event.target.value)}
                  className="w-full rounded-xl border border-input bg-transparent text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {CHECK_FREQUENCIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {workspaceId ? (
              <Field label="Référence interne (facultatif)" htmlFor="internal-reference">
                <Input
                  id="internal-reference"
                  value={draft.internal_reference}
                  onChange={(event) => update("internal_reference", event.target.value)}
                  placeholder="PARC-001"
                />
              </Field>
            ) : null}

            <FilePicker
              id="purchase-proof"
              label="Preuve d’achat (facultatif)"
              hint={`PDF ou image — ${formatFileSize(MAX_DOCUMENT_BYTES)} maximum. Document privé par défaut.`}
              accept={ALLOWED_DOCUMENT_MIME.join(",")}
              file={purchaseProof}
              onPick={pickProof}
              onClear={() => setPurchaseProof(null)}
            />
          </fieldset>
        ) : null}

        {/* ---------------- Étape 3 : état initial ---------------- */}
        {step === 2 ? (
          <fieldset className="space-y-5">
            <legend className="sr-only">État déclaré</legend>
            <p className="border-l-2 border-border py-1.5 pl-3 text-xs text-muted-foreground">
              Tout ce que vous saisissez ici sera marqué{" "}
              <strong className="text-foreground">« Déclaré par le propriétaire »</strong>.
            </p>

            <div className="space-y-3">
              {CONDITION_POINTS.map((point) => (
                <div key={point.key} className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm text-foreground">{point.label}</span>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={point.label}>
                    {CONDITION_GRADES.map((grade) => {
                      const active = draft.condition[point.key] === grade;
                      return (
                        <button
                          key={grade}
                          type="button"
                          onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              condition: {
                                ...current.condition,
                                [point.key]: active ? undefined : grade,
                              },
                            }))
                          }
                          aria-pressed={active}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs transition-colors",
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {CONDITION_GRADE_LABELS[grade]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <Field label="Santé de la batterie en % (facultatif)" htmlFor="battery">
              <Input
                id="battery"
                type="number"
                min={1}
                max={100}
                value={draft.battery_health}
                onChange={(event) => update("battery_health", event.target.value)}
                placeholder="Ex. 87"
                inputMode="numeric"
              />
            </Field>

            <Field label="Commentaires (facultatif)" htmlFor="condition-comment">
              <textarea
                id="condition-comment"
                value={draft.condition_comment}
                onChange={(event) => update("condition_comment", event.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Rayure au dos, coin légèrement marqué…"
                className="w-full rounded-xl border border-input bg-transparent text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </Field>

            <div>
              <p className="text-sm font-medium text-foreground">
                Photos de l’état ({conditionPhotos.length}/{MAX_CONDITION_PHOTOS})
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {conditionPhotos.map((photo, index) => (
                  <span
                    key={`${photo.name}-${index}`}
                    className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2 text-xs text-foreground"
                  >
                    <span className="max-w-[10rem] truncate">{photo.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setConditionPhotos((current) => current.filter((_, i) => i !== index))
                      }
                      aria-label={`Retirer ${photo.name}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              {conditionPhotos.length < MAX_CONDITION_PHOTOS ? (
                <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted focus-within:ring-3 focus-within:ring-ring/50">
                  <ImagePlus className="size-4" aria-hidden />
                  Ajouter une photo
                  <input
                    type="file"
                    accept={ALLOWED_IMAGE_MIME.join(",")}
                    className="sr-only"
                    onChange={(event) => {
                      pickPhoto(event.target.files?.[0] ?? null, "condition");
                      event.target.value = "";
                    }}
                  />
                </label>
              ) : null}
            </div>
          </fieldset>
        ) : null}

        {/* ---------------- Étape 4 : vérification ---------------- */}
        {step === 3 ? (
          <div className="space-y-5">
            <h2 className="text-base font-semibold text-foreground">Vérification</h2>
            {workspaceName ? (
              <p className="border-l-2 border-border py-1.5 pl-3 text-xs text-muted-foreground">
                Ce téléphone sera enregistré dans l’espace{" "}
                <strong>{workspaceName}</strong>.
              </p>
            ) : null}
            <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
              <Summary label="Appareil" value={`${draft.brand} ${draft.model}`.trim() || "—"} />
              <Summary
                label="Couleur / stockage"
                value={[draft.color, draft.storage_capacity].filter(Boolean).join(" · ") || "—"}
              />
              <Summary
                label="Numéro de série"
                value={draft.serial_number ? "Renseigné (privé)" : "Non renseigné"}
              />
              <Summary label="IMEI" value={draft.imei ? "Renseigné (privé)" : "Non renseigné"} />
              <Summary label="Date d’achat" value={draft.purchase_date || "Non renseignée"} />
              <Summary
                label="État à l’acquisition"
                value={PURCHASE_CONDITION_LABELS[draft.purchase_condition]}
              />
              <Summary label="Photo principale" value={primaryPhoto ? primaryPhoto.name : "Aucune"} />
              <Summary
                label="Preuve d’achat"
                value={purchaseProof ? purchaseProof.name : "Aucune"}
              />
              <Summary
                label="Constat d’état"
                value={
                  Object.values(draft.condition).filter(Boolean).length > 0
                    ? `${Object.values(draft.condition).filter(Boolean).length} point(s) évalué(s)`
                    : "Non renseigné"
                }
              />
              <Summary label="Photos d’état" value={`${conditionPhotos.length} photo(s)`} />
            </dl>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-0.5 size-4 shrink-0 rounded border-input"
              />
              <span className="text-muted-foreground">
                Je confirme que ces informations sont exactes à ma connaissance
                et je comprends qu’elles seront présentées comme{" "}
                <strong className="text-foreground">déclarées par le propriétaire</strong>,
                sans certification de Nireo.
              </span>
            </label>

            <p className="text-xs text-muted-foreground">
              Un identifiant Nireo unique sera généré à la création (format
              NIR-PH-XXXX-XXXX). Rien n’est enregistré avant votre validation.
            </p>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        {step === 0 ? (
          <Button variant="ghost" data-touch render={<Link href="/id/app" />}>
            Annuler
          </Button>
        ) : (
          <Button variant="outline" data-touch onClick={goBack} disabled={pending}>
            <ArrowLeft className="size-4" data-icon="inline-start" />
            Retour
          </Button>
        )}

        {step < STEPS.length - 1 ? (
          <Button data-touch onClick={goNext}>
            Continuer
            <ArrowRight className="size-4" data-icon="inline-end" />
          </Button>
        ) : (
          <Button data-touch onClick={submit} disabled={pending || !consent}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                Création…
              </>
            ) : (
              <>
                <Check className="size-4" data-icon="inline-start" />
                Ajouter mon téléphone
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium break-words text-foreground">{value}</dd>
    </div>
  );
}

function FilePicker({
  id,
  label,
  hint,
  accept,
  file,
  onPick,
  onClear,
}: {
  id: string;
  label: string;
  hint: string;
  accept: string;
  file: File | null;
  onPick: (file: File | null) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted px-3 py-2.5">
          <span className="min-w-0">
            <span className="block truncate text-sm text-foreground">{file.name}</span>
            <span className="block text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
          </span>
          <Button variant="ghost" size="sm" onClick={onClear} aria-label={`Retirer ${file.name}`}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ) : (
        <input
          id={id}
          type="file"
          accept={accept}
          onChange={(event) => onPick(event.target.files?.[0] ?? null)}
          className="block w-full cursor-pointer rounded-xl border border-dashed border-border bg-transparent px-3 py-3 text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        />
      )}
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
