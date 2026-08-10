"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, Download, FileText, Loader2, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import {
  buildDocument,
  computeTotal,
  emptyForm,
  formatEuros,
  MONTHS,
  type QuittanceDocument,
  type QuittanceErrors,
  type QuittanceField,
  type QuittanceForm,
} from "@/lib/quittance/document";
import { cn } from "@/lib/utils";

/**
 * Générateur de quittance de loyer — formulaire, aperçu, téléchargement.
 *
 * Confidentialité : tout reste dans l'onglet. Aucune saisie n'est envoyée à
 * un serveur, écrite en base ou conservée après la fermeture de la page — le
 * PDF est fabriqué dans le navigateur (voir src/lib/quittance/pdf.ts).
 *
 * Une seule source de vérité : `buildDocument()` produit un objet
 * `QuittanceDocument` que l'aperçu HTML et le PDF affichent tous les deux.
 * L'aperçu est en HTML — et non un PDF embarqué — parce qu'un <iframe> de PDF
 * ne s'affiche pas de façon fiable sur Safari iOS, où se trouve une grande
 * partie du trafic.
 */

/* ------------------------------------------------------------------ */
/*  Champs                                                             */
/* ------------------------------------------------------------------ */

function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-[13px] text-foreground">
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Ligne de l'aperçu : libellé à gauche, montant aligné à droite. */
function AmountRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 border-t border-zinc-200 py-2 text-[13px] first:border-t-0",
        strong ? "font-semibold text-zinc-900" : "text-zinc-500"
      )}
    >
      <span>{label}</span>
      <span className={cn("tabular-nums", strong ? "text-zinc-900" : "text-zinc-700")}>
        {value}
      </span>
    </div>
  );
}

/**
 * Aperçu du document, sur fond blanc : c'est une page, pas une interface.
 * Il reprend l'ordre exact du PDF pour qu'on reconnaisse le fichier obtenu.
 */
function DocumentPreview({ doc }: { doc: QuittanceDocument }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white text-zinc-900 shadow-sm">
      <div className="px-5 py-7 sm:px-9 sm:py-10">
        <p className="text-center text-base font-bold tracking-tight sm:text-lg">{doc.title}</p>
        <p className="mt-1.5 text-center text-[13px] text-zinc-500">
          Période : {doc.periodLabel}
        </p>

        <div className="mt-6 border-t border-zinc-200 pt-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                Bailleur
              </p>
              <p className="mt-1.5 text-[13px] whitespace-pre-line">
                {doc.landlordName}
                {"\n"}
                {doc.landlordAddress}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                Locataire
              </p>
              <p className="mt-1.5 text-[13px] whitespace-pre-line">{doc.tenantNames}</p>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
              Logement loué
            </p>
            <p className="mt-1.5 text-[13px] whitespace-pre-line">{doc.propertyAddress}</p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2">
          <AmountRow label="Loyer hors charges" value={formatEuros(doc.rentCents)} />
          <AmountRow label="Provision pour charges" value={formatEuros(doc.chargesCents)} />
          <AmountRow label="Total dû pour la période" value={formatEuros(doc.totalCents)} strong />
          <AmountRow label="Montant réellement payé" value={formatEuros(doc.paidCents)} strong />
          {doc.remainingCents > 0 ? (
            <AmountRow label="Solde restant dû" value={formatEuros(doc.remainingCents)} strong />
          ) : null}
        </div>

        <div className="mt-6 space-y-2.5 text-[13px] leading-relaxed">
          {doc.statement.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <p className="text-zinc-500">Paiement reçu le {doc.paymentDateLabel}.</p>
        </div>

        <div className="mt-8 text-right text-[13px]">
          <p>
            Fait à {doc.place}, le {doc.issueDateLabel}
          </p>
          <p className="mt-1 text-[12px] text-zinc-500">Signature du bailleur</p>
          <span aria-hidden className="mt-8 ml-auto block h-px w-40 bg-zinc-300" />
        </div>

        <p className="mt-8 border-t border-zinc-200 pt-3 text-center text-[10px] leading-relaxed text-zinc-500">
          Document établi par le bailleur à l’aide du générateur gratuit Nireo — nireo.fr
          <br />
          Modèle générique, sans valeur de conseil juridique : vérifiez les informations au
          regard de votre situation.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function QuittanceGenerator({
  /**
   * Date du jour « aaaa-mm-jj », calculée par le serveur (Europe/Paris) et
   * transmise ici : serveur et client partent ainsi du même formulaire, sans
   * écart d'hydratation autour de minuit.
   */
  today,
}: {
  today: string;
}) {
  const [form, setForm] = React.useState<QuittanceForm>(() => emptyForm(today));
  const [errors, setErrors] = React.useState<QuittanceErrors>({});
  const [doc, setDoc] = React.useState<QuittanceDocument | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [downloaded, setDownloaded] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);

  const previewRef = React.useRef<HTMLDivElement>(null);
  const afterRef = React.useRef<HTMLDivElement>(null);

  // Année en cours ± quelques exercices : une quittance se rédige rarement
  // pour une période très ancienne, et jamais très loin dans le futur.
  const currentYear = Number(today.slice(0, 4));
  const years = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => currentYear + 1 - i),
    [currentYear]
  );

  const set = (field: QuittanceField) => (value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    // Une correction efface l'erreur du champ : pas de rouge qui persiste.
    setErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
    // Le document affiché ne doit jamais être celui d'une saisie précédente.
    setDoc(null);
    setDownloaded(false);
  };

  const liveTotal = computeTotal(form);
  const errorCount = Object.keys(errors).length;

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFailure(null);
    const result = buildDocument(form);
    if (!result.ok) {
      setErrors(result.errors);
      setDoc(null);
      // Focus sur le premier champ fautif : utile au clavier comme au lecteur d'écran.
      const first = Object.keys(result.errors)[0];
      document.getElementById(`q-${first}`)?.focus();
      return;
    }
    setErrors({});
    setDoc(result.document);
    setDownloaded(false);
    track("quittance_apercu", { type: result.document.kind });
    window.requestAnimationFrame(() =>
      previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  };

  const onDownload = async () => {
    if (!doc || busy) return;
    setBusy(true);
    setFailure(null);
    let url: string | null = null;
    try {
      const { renderQuittancePdf } = await import("@/lib/quittance/pdf");
      const blob = await renderQuittancePdf(doc);
      url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setDownloaded(true);
      track("quittance_telechargement", { type: doc.kind });
      window.requestAnimationFrame(() =>
        afterRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      );
    } catch {
      setFailure(
        "Le PDF n’a pas pu être créé sur cet appareil. Réessayez, ou ouvrez la page dans un autre navigateur."
      );
    } finally {
      // L'URL temporaire est libérée une fois le téléchargement amorcé.
      const created = url;
      if (created) window.setTimeout(() => URL.revokeObjectURL(created), 20_000);
      setBusy(false);
    }
  };

  const reset = () => {
    setForm(emptyForm(today));
    setErrors({});
    setDoc(null);
    setDownloaded(false);
    setFailure(null);
  };

  /** Attributs communs aux champs texte (erreur + description accessibles). */
  const inputProps = (field: QuittanceField) => ({
    id: `q-${field}`,
    value: form[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(field)(e.target.value),
    "aria-invalid": errors[field] ? (true as const) : undefined,
    "aria-describedby": errors[field] ? `q-${field}-error` : undefined,
  });

  return (
    <div className="space-y-8">
      {/* ---------------------------- Formulaire ---------------------------- */}
      <form onSubmit={onSubmit} noValidate className="nireo-auth">
        <div className="nireo-glass nireo-hairline rounded-2xl p-5 sm:rounded-3xl sm:p-8">
          <fieldset className="space-y-4">
            <legend className="text-[11px] font-semibold tracking-widest text-primary uppercase">
              Bailleur
            </legend>
            <Field
              id="q-landlordName"
              label="Nom ou raison sociale"
              error={errors.landlordName}
            >
              <Input {...inputProps("landlordName")} autoComplete="name" placeholder="Marie Durand" />
            </Field>
            <Field
              id="q-landlordAddress"
              label="Adresse du bailleur"
              hint="Numéro, rue, code postal et ville."
              error={errors.landlordAddress}
            >
              <Input
                {...inputProps("landlordAddress")}
                autoComplete="street-address"
                placeholder="12 rue des Lilas, 69003 Lyon"
              />
            </Field>
          </fieldset>

          <fieldset className="mt-8 space-y-4">
            <legend className="text-[11px] font-semibold tracking-widest text-primary uppercase">
              Locataire et logement
            </legend>
            <Field
              id="q-tenantNames"
              label="Nom du ou des locataires"
              hint="Séparez plusieurs locataires par « et »."
              error={errors.tenantNames}
            >
              <Input {...inputProps("tenantNames")} placeholder="Paul Martin et Léa Martin" />
            </Field>
            <Field
              id="q-propertyAddress"
              label="Adresse complète du logement"
              error={errors.propertyAddress}
            >
              <Input
                {...inputProps("propertyAddress")}
                placeholder="8 rue Bellecour, appartement 3B, 69002 Lyon"
              />
            </Field>
          </fieldset>

          <fieldset className="mt-8 space-y-4">
            <legend className="text-[11px] font-semibold tracking-widest text-primary uppercase">
              Période
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="q-month" label="Mois concerné" error={errors.month}>
                <select
                  id="q-month"
                  value={form.month}
                  onChange={(e) => set("month")(e.target.value)}
                  className="h-11 w-full rounded-[0.7rem] border border-input bg-input/30 px-3 text-[0.92rem] text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {MONTHS.map((name, index) => (
                    <option key={name} value={String(index + 1)}>
                      {name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="q-year" label="Année" error={errors.year}>
                <select
                  id="q-year"
                  value={form.year}
                  onChange={(e) => set("year")(e.target.value)}
                  className="h-11 w-full rounded-[0.7rem] border border-input bg-input/30 px-3 text-[0.92rem] text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {years.map((year) => (
                    <option key={year} value={String(year)}>
                      {year}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </fieldset>

          <fieldset className="mt-8 space-y-4">
            <legend className="text-[11px] font-semibold tracking-widest text-primary uppercase">
              Montants
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="q-rent"
                label="Loyer hors charges"
                hint="En euros, par exemple 750 ou 750,50."
                error={errors.rent}
              >
                <Input {...inputProps("rent")} inputMode="decimal" placeholder="750" />
              </Field>
              <Field
                id="q-charges"
                label="Charges"
                hint="Laissez vide s’il n’y a pas de charges."
                error={errors.charges}
              >
                <Input {...inputProps("charges")} inputMode="decimal" placeholder="60" />
              </Field>
            </div>

            {/* Total calculé : jamais saisi, toujours déduit du loyer et des charges. */}
            <div className="flex items-baseline justify-between gap-4 rounded-[0.7rem] border border-border bg-muted/40 px-3.5 py-3">
              <span className="text-[13px] text-muted-foreground">Total dû pour la période</span>
              <span className="text-base font-semibold text-foreground tabular-nums">
                {liveTotal === null ? "—" : formatEuros(liveTotal)}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="q-paid"
                label="Montant réellement payé"
                hint="Un paiement partiel produit un reçu, pas une quittance."
                error={errors.paid}
              >
                <Input {...inputProps("paid")} inputMode="decimal" placeholder="810" />
              </Field>
              <Field id="q-paymentDate" label="Date du paiement" error={errors.paymentDate}>
                <Input {...inputProps("paymentDate")} type="date" />
              </Field>
            </div>
          </fieldset>

          <fieldset className="mt-8 space-y-4">
            <legend className="text-[11px] font-semibold tracking-widest text-primary uppercase">
              Établissement du document
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="q-place" label="Fait à" error={errors.place}>
                <Input {...inputProps("place")} placeholder="Lyon" />
              </Field>
              <Field id="q-issueDate" label="Le" error={errors.issueDate}>
                <Input {...inputProps("issueDate")} type="date" />
              </Field>
            </div>
          </fieldset>

          {errorCount > 0 ? (
            <p role="alert" className="mt-6 text-sm text-destructive">
              {errorCount === 1
                ? "Un champ doit être corrigé avant de continuer."
                : `${errorCount} champs doivent être corrigés avant de continuer.`}
            </p>
          ) : null}

          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <button
              type="submit"
              className={cn(
                buttonVariants({ size: "lg" }),
                "nireo-glow nireo-sheen h-11 w-full px-6 text-[0.95rem] sm:w-auto"
              )}
            >
              <FileText className="size-4" aria-hidden />
              Générer l’aperçu
            </button>
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Tout effacer
            </button>
          </div>
        </div>
      </form>

      {/* ----------------------------- Aperçu ------------------------------ */}
      {doc ? (
        <div ref={previewRef} className="scroll-mt-28 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Aperçu du document</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {doc.kind === "quittance"
                  ? "Le paiement couvre la totalité du loyer et des charges : une quittance est établie."
                  : `Le paiement est inférieur au total dû : c’est un reçu, pas une quittance. Solde restant : ${formatEuros(
                      doc.remainingCents
                    )}.`}
              </p>
            </div>
          </div>

          <DocumentPreview doc={doc} />

          {failure ? (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          ) : null}

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => void onDownload()}
              disabled={busy}
              className={cn(
                buttonVariants({ size: "lg" }),
                "nireo-glow nireo-sheen h-11 w-full px-6 text-[0.95rem] sm:w-auto"
              )}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Download className="size-4" aria-hidden />
              )}
              {busy ? "Création du PDF…" : "Télécharger le PDF"}
            </button>
            <p className="text-xs text-muted-foreground">
              Format A4 · gratuit · sans inscription · aucune donnée envoyée à Nireo.
            </p>
          </div>
        </div>
      ) : null}

      {/* -------- Après téléchargement seulement : proposition Nireo -------- */}
      {downloaded ? (
        <div
          ref={afterRef}
          className="nireo-glass nireo-hairline scroll-mt-28 rounded-2xl p-5 sm:p-6"
        >
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Check className="size-4 text-primary" aria-hidden />
            Document téléchargé.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Vous gérez encore vos loyers manuellement ? Nireo centralise gratuitement votre
            premier logement, vos locataires, vos documents et vos paiements.
          </p>
          <Link
            href="/inscription"
            onClick={() => track("cta_essai_gratuit", { source: "generateur_quittance" })}
            className={cn(
              buttonVariants({ size: "lg" }),
              "mt-5 h-11 w-full px-6 text-[0.95rem] sm:w-auto"
            )}
          >
            Créer mon compte gratuit
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
