"use client";

import * as React from "react";
import { ChevronDown, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * CHAMPS PARTAGÉS DE NIREO IMMO.
 *
 * Une seule définition de « à quoi ressemble un champ » : label TOUJOURS
 * visible au-dessus, surface blanche, filet d'un cheveu, rayon modéré. Le
 * placeholder ne remplace jamais le label — il illustre le format attendu.
 *
 * Les tailles viennent du scope `.nireo-form` (globals.css) : 44 px au doigt,
 * 16 px de corps pour qu'iOS ne zoome pas. Rien n'est réécrit ici.
 */

/* ------------------------------------------------------------------ */
/*  Enveloppe : label, aide, erreur                                    */
/* ------------------------------------------------------------------ */

export interface FieldProps {
  label: string;
  htmlFor: string;
  /** Message d'aide affiché sous le champ. */
  hint?: string;
  error?: string;
  /** Marque explicitement le champ comme facultatif. */
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-foreground"
      >
        {label}
        {optional ? (
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            facultatif
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        // `role="alert"` : le lecteur d'écran annonce l'erreur dès qu'elle apparaît.
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Attributs d'accessibilité communs (erreur annoncée, aide reliée). */
function a11y(id: string, error?: string, hint?: string) {
  return {
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": error
      ? `${id}-error`
      : hint
        ? `${id}-hint`
        : undefined,
  };
}

const CONTROL =
  "w-full border border-input bg-card text-foreground transition-colors outline-none " +
  "placeholder:text-muted-foreground/70 " +
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-3 aria-[invalid=true]:ring-danger/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

/* ------------------------------------------------------------------ */
/*  Texte                                                              */
/* ------------------------------------------------------------------ */

type InputProps = Omit<React.ComponentProps<"input">, "className">;

export function TextField({
  id,
  label,
  hint,
  error,
  optional,
  className,
  ...props
}: InputProps & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  className?: string;
}) {
  return (
    <Field
      label={label}
      htmlFor={id}
      hint={hint}
      error={error}
      optional={optional}
      className={className}
    >
      <input id={id} className={CONTROL} {...a11y(id, error, hint)} {...props} />
    </Field>
  );
}

/* ------------------------------------------------------------------ */
/*  Nombre et montant                                                  */
/* ------------------------------------------------------------------ */

/**
 * Champ numérique entier (surface, pièces, jours).
 * `inputMode="numeric"` : clavier chiffres sur mobile.
 */
export function NumberField(
  props: InputProps & {
    id: string;
    label: string;
    hint?: string;
    error?: string;
    optional?: boolean;
    /** Unité affichée à droite du champ (« m² », « %»). */
    unit?: string;
    className?: string;
  }
) {
  const { unit, ...rest } = props;
  return (
    <AffixField {...rest} suffix={unit} inputMode="numeric" />
  );
}

/**
 * Montant en euros — `inputMode="decimal"` (clavier avec virgule), symbole €
 * en suffixe et jamais dans la valeur saisie.
 */
export function AmountField(
  props: InputProps & {
    id: string;
    label: string;
    hint?: string;
    error?: string;
    optional?: boolean;
    className?: string;
  }
) {
  return <AffixField {...props} suffix="€" inputMode="decimal" />;
}

function AffixField({
  id,
  label,
  hint,
  error,
  optional,
  className,
  suffix,
  ...props
}: InputProps & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  className?: string;
  suffix?: string;
}) {
  return (
    <Field
      label={label}
      htmlFor={id}
      hint={hint}
      error={error}
      optional={optional}
      className={className}
    >
      <div className="relative">
        <input
          id={id}
          className={cn(CONTROL, "tabular-nums", suffix && "pr-11")}
          {...a11y(id, error, hint)}
          {...props}
        />
        {suffix ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
          >
            {suffix}
          </span>
        ) : null}
      </div>
    </Field>
  );
}

/* ------------------------------------------------------------------ */
/*  Date                                                               */
/* ------------------------------------------------------------------ */

export function DateField({
  id,
  label,
  hint,
  error,
  optional,
  className,
  ...props
}: InputProps & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  className?: string;
}) {
  return (
    <Field
      label={label}
      htmlFor={id}
      hint={hint}
      error={error}
      optional={optional}
      className={className}
    >
      <input
        id={id}
        type="date"
        className={cn(CONTROL, "tabular-nums")}
        {...a11y(id, error, hint)}
        {...props}
      />
    </Field>
  );
}

/* ------------------------------------------------------------------ */
/*  Sélection                                                          */
/* ------------------------------------------------------------------ */

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Sélection native : sur téléphone, la roue du système est plus rapide et
 * plus accessible qu'une liste maison, et elle ne peut pas sortir de l'écran.
 */
export function SelectField({
  id,
  label,
  hint,
  error,
  optional,
  className,
  options,
  placeholder,
  ...props
}: Omit<React.ComponentProps<"select">, "className" | "children"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  className?: string;
  options: SelectOption[];
  /** Option vide initiale (« Choisir un logement »). */
  placeholder?: string;
}) {
  return (
    <Field
      label={label}
      htmlFor={id}
      hint={hint}
      error={error}
      optional={optional}
      className={className}
    >
      <div className="relative">
        <select
          id={id}
          className={cn(CONTROL, "appearance-none pr-10")}
          {...a11y(id, error, hint)}
          {...props}
        >
          {placeholder ? (
            <option value="">{placeholder}</option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-3 my-auto size-4 text-muted-foreground"
        />
      </div>
    </Field>
  );
}

/* ------------------------------------------------------------------ */
/*  Choix segmenté                                                     */
/* ------------------------------------------------------------------ */

/**
 * Deux ou trois options exclusives, côte à côte (Loué / Vacant).
 * Le choix actif est porté par le fond cobalt ET le poids du texte — jamais
 * par la couleur seule.
 */
export function SegmentedField<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
  error,
  className,
  name,
}: {
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string; hint?: string }[];
  hint?: string;
  error?: string;
  className?: string;
  name: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <span className="block text-sm font-medium text-foreground">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex overflow-hidden rounded-[0.625rem] border border-input bg-card"
      >
        {options.map((option, index) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              name={name}
              aria-checked={active}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 px-3 py-2 text-sm transition-colors duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:ring-inset",
                index > 0 && "border-l border-input",
                active
                  ? "bg-primary font-semibold text-primary-foreground"
                  : "font-normal text-foreground hover:bg-accent"
              )}
            >
              {option.label}
              {option.hint ? (
                <span
                  className={cn(
                    "text-[0.7rem] font-normal",
                    active ? "text-primary-foreground/80" : "text-muted-foreground"
                  )}
                >
                  {option.hint}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Zone de texte                                                      */
/* ------------------------------------------------------------------ */

export function TextAreaField({
  id,
  label,
  hint,
  error,
  optional,
  className,
  ...props
}: Omit<React.ComponentProps<"textarea">, "className"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  className?: string;
}) {
  return (
    <Field
      label={label}
      htmlFor={id}
      hint={hint}
      error={error}
      optional={optional}
      className={className}
    >
      <textarea
        id={id}
        rows={3}
        className={cn(CONTROL, "resize-y")}
        {...a11y(id, error, hint)}
        {...props}
      />
    </Field>
  );
}

/* ------------------------------------------------------------------ */
/*  Import de fichier                                                  */
/* ------------------------------------------------------------------ */

/** Formats réellement acceptés par le Storage (cf. lib/supabase/storage.ts). */
export const DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.docx";

/**
 * Choix d'un fichier — une ligne cliquable, le nom du fichier retenu, et une
 * VRAIE barre de progression pendant l'envoi (jamais une animation décorative :
 * `progress` reste `null` tant qu'aucun envoi n'est en cours).
 */
export function FileField({
  id,
  label,
  hint,
  error,
  optional,
  accept = DOCUMENT_ACCEPT,
  file,
  onFile,
  progress = null,
  disabled,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  accept?: string;
  file: File | null;
  onFile: (file: File | null) => void;
  /** 0–100 pendant l'envoi, null au repos. */
  progress?: number | null;
  disabled?: boolean;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const uploading = progress !== null;

  return (
    <Field
      label={label}
      htmlFor={id}
      hint={hint}
      error={error}
      optional={optional}
      className={className}
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled || uploading}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />

      <div className="rounded-[0.625rem] border border-input bg-card">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
            <Paperclip className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-foreground">
              {file ? file.name : "Aucun fichier sélectionné"}
            </span>
            <span className="block text-xs text-muted-foreground">
              {file
                ? `${(file.size / 1024 / 1024).toFixed(1)} Mo`
                : "PDF, image ou Word — 20 Mo maximum"}
            </span>
          </span>
          {file && !uploading ? (
            <button
              type="button"
              onClick={() => {
                onFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              aria-label={`Retirer ${file.name}`}
              className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-danger"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || uploading}
              className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium text-primary transition-opacity hover:underline disabled:opacity-50"
            >
              Choisir
            </button>
          )}
        </div>

        {uploading ? (
          <div className="border-t border-border px-3 py-2">
            <div
              className="h-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progression de l'import"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-200"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
            <p className="pt-1 text-xs text-muted-foreground">
              Import en cours — {Math.round(progress)} %
            </p>
          </div>
        ) : null}
      </div>
    </Field>
  );
}

/* ------------------------------------------------------------------ */
/*  Options rares                                                      */
/* ------------------------------------------------------------------ */

/**
 * « Ajouter plus de détails » — les champs rares sont repliés par défaut.
 * `<details>` natif : il fonctionne sans JavaScript et reste accessible.
 */
export function MoreDetails({
  children,
  label = "Ajouter plus de détails",
}: {
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <details className="group border-t border-border pt-4">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-medium text-primary marker:content-none">
        <ChevronDown
          className="size-4 transition-transform duration-200 group-open:rotate-180"
          aria-hidden
        />
        {label}
      </summary>
      <div className="space-y-5 pt-4">{children}</div>
    </details>
  );
}

/* ------------------------------------------------------------------ */
/*  Bandeau d'information                                              */
/* ------------------------------------------------------------------ */

/** Note discrète en bas de formulaire (sauvegarde, confidentialité, quota). */
export function FormNote({
  icon: Icon,
  children,
  tone = "default",
}: {
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  tone?: "default" | "warning" | "danger";
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-[0.625rem] px-3 py-2.5 text-xs leading-relaxed",
        tone === "danger"
          ? "bg-danger-soft text-danger"
          : tone === "warning"
            ? "bg-warning-soft text-warning"
            : "text-muted-foreground"
      )}
    >
      {Icon ? (
        <span
          className={cn(
            "mt-px grid size-5 shrink-0 place-items-center rounded-full",
            tone === "default" && "bg-primary-soft text-primary"
          )}
        >
          <Icon className="size-3" />
        </span>
      ) : null}
      <span className="min-w-0">{children}</span>
    </div>
  );
}
