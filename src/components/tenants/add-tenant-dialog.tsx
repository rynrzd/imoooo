"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toUserMessage } from "@/components/form/errors";
import {
  AmountField,
  DateField,
  FileField,
  MoreDetails,
  SelectField,
  TextField,
} from "@/components/form/fields";
import { SheetForm } from "@/components/form/sheet-form";
import { SubmitButton } from "@/components/form/submit-button";
import { todayISO } from "@/lib/dates";
import { parseAmount } from "@/lib/property-types";
import { useAppStore } from "@/lib/store";
import { saveGuarantor } from "@/lib/tenant-dossier";

/**
 * NOUVEAU BAIL — deux parties, jamais plus.
 *
 *   1. Les conditions : qui loue, quel logement, à quel prix, depuis quand.
 *   2. Le document    : le bail signé (facultatif, importé pour de vrai).
 *
 * Elle remplace l'assistant en CINQ étapes (informations, bail, garant,
 * documents, résumé) dont trois étaient facultatives : le garant et les
 * documents sont désormais repliés ou déplacés, et le résumé a disparu — il
 * relisait des champs que l'utilisateur venait de saisir deux écrans plus tôt.
 *
 * Les informations de la PERSONNE et celles de la LOCATION restent visuellement
 * séparées, même si le modèle les crée ensemble (`tenants` + `leases`).
 */

interface AddTenantDialogProps {
  /** Pré-sélectionne et verrouille le logement (ouverture depuis sa fiche). */
  propertyId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Masque le bouton déclencheur (mode contrôlé). */
  showTrigger?: boolean;
}

export function AddTenantDialog({
  propertyId,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: AddTenantDialogProps) {
  const { data, addTenant, addDocument } = useAppStore();

  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  const [part, setPart] = React.useState<1 | 2>(1);
  const [busy, setBusy] = React.useState(false);
  const [createdPropertyId, setCreatedPropertyId] = React.useState<string | null>(
    null
  );

  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [target, setTarget] = React.useState(propertyId ?? "");
  const [entryDate, setEntryDate] = React.useState(todayISO());
  const [rent, setRent] = React.useState("");
  const [charges, setCharges] = React.useState("");
  const [deposit, setDeposit] = React.useState("");
  const [guarantor, setGuarantor] = React.useState("");
  const [guarantorPhone, setGuarantorPhone] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const [file, setFile] = React.useState<File | null>(null);
  const [progress, setProgress] = React.useState<number | null>(null);

  // Seuls les logements sans bail actif peuvent recevoir un locataire.
  const available = data.properties.filter((p) => !p.currentTenantId);

  const reset = React.useCallback(() => {
    setPart(1);
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setTarget(propertyId ?? "");
    setEntryDate(todayISO());
    setRent("");
    setCharges("");
    setDeposit("");
    setGuarantor("");
    setGuarantorPhone("");
    setErrors({});
    setFile(null);
    setProgress(null);
    setCreatedPropertyId(null);
  }, [propertyId]);

  // Différé d'un tick : aucun setState synchrone dans le corps de l'effet.
  React.useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(reset, 0);
    return () => window.clearTimeout(id);
  }, [open, reset]);

  /** Loyer du logement choisi : proposé, jamais imposé. */
  const prefillFromProperty = (id: string) => {
    const property = data.properties.find((p) => p.id === id);
    if (!property) return;
    if (rent === "" && property.rent > 0) setRent(String(property.rent));
    if (charges === "" && property.charges > 0) {
      setCharges(String(property.charges));
    }
  };

  const submitLease = async () => {
    if (busy) return;
    const next: Record<string, string> = {};
    if (firstName.trim().length < 2) next.firstName = "Prénom requis.";
    if (lastName.trim().length < 2) next.lastName = "Nom requis.";
    if (
      email.trim() !== "" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      next.email = "Adresse e-mail invalide.";
    }
    if (!target) next.target = "Choisissez un logement.";
    if (!entryDate) next.entryDate = "Date d'entrée requise.";
    const rentValue = parseAmount(rent);
    if (rentValue === null || rentValue < 0) next.rent = "Indiquez le loyer.";
    const chargesValue = charges.trim() === "" ? 0 : parseAmount(charges);
    if (chargesValue === null || chargesValue < 0) {
      next.charges = "Montant invalide.";
    }
    const depositValue = deposit.trim() === "" ? 0 : parseAmount(deposit);
    if (depositValue === null || depositValue < 0) {
      next.deposit = "Montant invalide.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await addTenant({
        propertyId: target,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        entryDate,
        rent: rentValue as number,
        charges: chargesValue as number,
        deposit: depositValue as number,
      });

      // Garant : conservé localement, rattaché au dossier du locataire.
      if (guarantor.trim()) {
        saveGuarantor(email.trim(), {
          name: guarantor.trim(),
          phone: guarantorPhone.trim() || undefined,
        });
      }

      setCreatedPropertyId(target);
      toast.success(
        `${firstName.trim()} ${lastName.trim()} est locataire — le bail est actif.`
      );
      setPart(2);
    } catch (e) {
      toast.error(toUserMessage(e, "Création du bail impossible."));
    } finally {
      setBusy(false);
    }
  };

  const submitDocument = async () => {
    if (!file || !createdPropertyId || busy) return;
    setBusy(true);
    setProgress(8);
    const ticker = window.setInterval(() => {
      setProgress((p) => (p === null ? null : Math.min(90, p + 7)));
    }, 220);
    try {
      await addDocument(
        {
          propertyId: createdPropertyId,
          name: `Bail — ${firstName.trim()} ${lastName.trim()}`.trim(),
          category: "bail",
        },
        file
      );
      setProgress(100);
      toast.success("Bail ajouté au dossier du logement.");
      setOpen(false);
    } catch (e) {
      toast.error(toUserMessage(e, "Import du document impossible."));
      setProgress(null);
    } finally {
      window.clearInterval(ticker);
      setBusy(false);
    }
  };

  return (
    <>
      {showTrigger ? (
        <Button onClick={() => setOpen(true)}>
          <Plus data-icon="inline-start" />
          Ajouter un locataire
        </Button>
      ) : null}

      <SheetForm
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
        title={part === 1 ? "Nouveau bail" : "Le document du bail"}
        description={
          part === 1
            ? "Le logement passera au statut « Loué » et les échéances de loyer seront suivies dès la date d'entrée."
            : "Importez le bail signé — il sera rangé dans le dossier du logement."
        }
        actions={
          part === 1 ? (
            <>
              <SubmitButton
                type="button"
                pending={busy}
                pendingLabel="Création…"
                onClick={() => void submitLease()}
              >
                Créer le bail
              </SubmitButton>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="mx-auto block min-h-11 px-3 text-sm font-medium text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
              >
                Annuler
              </button>
            </>
          ) : (
            <>
              <SubmitButton
                type="button"
                pending={busy}
                pendingLabel="Import…"
                disabled={!file}
                onClick={() => void submitDocument()}
              >
                Ajouter le bail signé
              </SubmitButton>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="mx-auto block min-h-11 px-3 text-sm font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
              >
                Je l&apos;ajouterai plus tard
              </button>
            </>
          )
        }
      >
        {part === 1 ? (
          <div className="space-y-7">
            {/* ---------- Le locataire ---------- */}
            <section className="space-y-5">
              <h3 className="text-[0.7rem] font-semibold tracking-[0.08em] text-primary uppercase">
                Le locataire
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <TextField
                  id="t-first"
                  label="Prénom"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  error={errors.firstName}
                />
                <TextField
                  id="t-last"
                  label="Nom"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  error={errors.lastName}
                />
              </div>
              <TextField
                id="t-email"
                label="Adresse e-mail"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                optional
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                hint="Nécessaire pour lui envoyer une relance de loyer."
                error={errors.email}
              />
              <TextField
                id="t-phone"
                label="Téléphone"
                type="tel"
                inputMode="tel"
                optional
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </section>

            {/* ---------- La location ---------- */}
            <section className="space-y-5 border-t border-border pt-6">
              <h3 className="text-[0.7rem] font-semibold tracking-[0.08em] text-primary uppercase">
                La location
              </h3>

              {propertyId ? (
                <p className="text-sm text-muted-foreground">
                  Logement :{" "}
                  <span className="font-medium text-foreground">
                    {data.properties.find((p) => p.id === propertyId)?.name ??
                      "—"}
                  </span>
                </p>
              ) : (
                <SelectField
                  id="t-property"
                  label="Logement"
                  value={target}
                  onChange={(e) => {
                    setTarget(e.target.value);
                    prefillFromProperty(e.target.value);
                  }}
                  placeholder="Choisir un logement disponible"
                  options={available.map((p) => ({ value: p.id, label: p.name }))}
                  hint={
                    available.length === 0
                      ? "Tous vos logements ont déjà un locataire en place."
                      : undefined
                  }
                  error={errors.target}
                />
              )}

              <div className="grid grid-cols-2 gap-4">
                <AmountField
                  id="t-rent"
                  label="Loyer"
                  value={rent}
                  onChange={(e) => setRent(e.target.value)}
                  placeholder="780"
                  error={errors.rent}
                />
                <AmountField
                  id="t-charges"
                  label="Charges"
                  optional
                  value={charges}
                  onChange={(e) => setCharges(e.target.value)}
                  placeholder="60"
                  error={errors.charges}
                />
              </div>

              <DateField
                id="t-entry"
                label="Date d'entrée"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                hint="Les échéances mensuelles partent de cette date."
                error={errors.entryDate}
              />

              <MoreDetails>
                <AmountField
                  id="t-deposit"
                  label="Dépôt de garantie"
                  optional
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  placeholder="780"
                  error={errors.deposit}
                />
                <TextField
                  id="t-guarantor"
                  label="Nom du garant"
                  optional
                  value={guarantor}
                  onChange={(e) => setGuarantor(e.target.value)}
                />
                <TextField
                  id="t-guarantor-phone"
                  label="Téléphone du garant"
                  type="tel"
                  inputMode="tel"
                  optional
                  value={guarantorPhone}
                  onChange={(e) => setGuarantorPhone(e.target.value)}
                />
              </MoreDetails>
            </section>
          </div>
        ) : (
          <FileField
            id="t-lease-file"
            label="Bail signé"
            optional
            file={file}
            onFile={setFile}
            progress={progress}
          />
        )}
      </SheetForm>
    </>
  );
}
