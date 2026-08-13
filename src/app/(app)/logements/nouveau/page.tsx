"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Lock } from "lucide-react";
import { toast } from "sonner";
import { toUserMessage } from "@/components/form/errors";
import {
  AmountField,
  DateField,
  FileField,
  FormNote,
  MoreDetails,
  NumberField,
  SegmentedField,
  SelectField,
  TextField,
} from "@/components/form/fields";
import {
  FormActions,
  FormBody,
  FormHeading,
  FormProgress,
  FormSecondaryAction,
  FormShell,
  FormTopBar,
} from "@/components/form/form-shell";
import { SubmitButton } from "@/components/form/submit-button";
import { useDraftAutosave, useFormDraft } from "@/components/form/use-form-draft";
import { useUnsavedChanges } from "@/components/form/use-unsaved-changes";
import { getPlan, isPlanId, type PlanId } from "@/config/plans";
import { todayISO } from "@/lib/dates";
import { formatCurrency, formatSurface } from "@/lib/format";
import { trackFunnel } from "@/lib/funnel";
import { DOCUMENT_CATEGORY_LABELS, toOptions } from "@/lib/labels";
import {
  needsRoomCount,
  parseAmount,
  PROPERTY_TYPES,
  ROOMS_BY_TYPE,
} from "@/lib/property-types";
import { useAppStore } from "@/lib/store";
import { canCreateProperty } from "@/lib/stripe/entitlements";
import { createClient } from "@/lib/supabase/client";
import {
  fetchTenantPeople,
  type TenantPerson,
} from "@/lib/supabase/mutations";
import type { DocumentCategory, PropertyType } from "@/lib/types";

/**
 * CRÉATION D'UN LOGEMENT — trois étapes, plein écran.
 *
 * Remplace l'ancienne modale sombre en six étapes (informations, photos,
 * documents, finances, locataire, résumé) qui demandait le prix d'acquisition
 * et la rentabilité avant même de savoir si le bien était loué. Ici :
 *
 *   1. Le bien       — ce qu'il faut pour créer sa fiche
 *   2. La location   — sautée d'un geste si le logement est vacant
 *   3. Les documents — le bail, ou rien
 *
 * Photos, dépenses et travaux ne sont PAS demandés : ils s'ajoutent depuis la
 * fiche du logement et n'ont aucune raison d'allonger la création.
 *
 * ── Intégrité ────────────────────────────────────────────────────────────
 * Les écritures ont lieu à la fin de l'étape 2, dans cet ordre : logement,
 * puis bail. Les identifiants créés sont mémorisés (`createdId`,
 * `leaseDone`) : si le bail échoue, réessayer ne recrée PAS un second
 * logement — la reprise ne fait que la partie manquante. Le document de
 * l'étape 3 est rattaché à un logement qui existe déjà : jamais de fichier
 * orphelin.
 *
 * ── Quota ────────────────────────────────────────────────────────────────
 * Vérifié à l'ouverture ET juste avant l'écriture, depuis la source de vérité
 * des abonnements. En cas de limite atteinte, la saisie n'est jamais perdue :
 * l'écran de blocage remplace les actions, pas le formulaire.
 */

/* ------------------------------------------------------------------ */
/*  État du formulaire                                                 */
/* ------------------------------------------------------------------ */

interface DraftValues {
  name: string;
  address: string;
  postalCode: string;
  city: string;
  status: "loue" | "vacant";
  type: PropertyType;
  surface: string;
  rooms: string;
  purchasePrice: string;
  purchaseDate: string;
  tenantMode: "existing" | "new";
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  entryDate: string;
  rent: string;
  charges: string;
  deposit: string;
}

const EMPTY: DraftValues = {
  name: "",
  address: "",
  postalCode: "",
  city: "",
  status: "loue",
  type: "T2",
  surface: "",
  rooms: "",
  purchasePrice: "",
  purchaseDate: "",
  tenantMode: "new",
  tenantId: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  entryDate: todayISO(),
  rent: "",
  charges: "",
  deposit: "",
};

type Errors = Partial<Record<keyof DraftValues, string>>;

export default function NewPropertyPage() {
  const router = useRouter();
  const {
    data,
    profile,
    userId,
    isLive,
    addProperty,
    addTenant,
    addLeaseForExistingTenant,
    addDocument,
  } = useAppStore();

  const [step, setStep] = React.useState<1 | 2 | 3 | 4>(1);
  const [values, setValues] = React.useState<DraftValues>(EMPTY);
  const [errors, setErrors] = React.useState<Errors>({});
  const [busy, setBusy] = React.useState(false);

  // Écritures déjà réussies — une reprise après erreur ne les rejoue pas.
  const [createdId, setCreatedId] = React.useState<string | null>(null);
  const [leaseDone, setLeaseDone] = React.useState(false);

  /* ---------------- Brouillon ---------------- */

  const draft = useFormDraft<DraftValues>("property-new", userId);
  const restoredRef = React.useRef(false);
  // Différé d'un tick : aucun setState synchrone dans le corps de l'effet.
  React.useEffect(() => {
    if (restoredRef.current || !draft.restored) return;
    restoredRef.current = true;
    const restored = draft.restored;
    const id = window.setTimeout(() => setValues({ ...EMPTY, ...restored }), 0);
    return () => window.clearTimeout(id);
  }, [draft.restored]);
  // Suspendu dès que le logement est créé : le brouillon n'a plus d'objet.
  useDraftAutosave(draft, values, createdId === null);

  const dirty = createdId === null && JSON.stringify(values) !== JSON.stringify(EMPTY);
  const confirmLeave = useUnsavedChanges(dirty);

  /* ---------------- Quota ---------------- */

  const planLabel: PlanId =
    profile && isPlanId(profile.plan) ? (profile.plan as PlanId) : "free";
  const plan = getPlan(profile?.plan);
  // Un Fondateur a un accès à vie sans plafond (comme dans le store).
  const quota =
    !isLive || profile?.isFounder
      ? { allowed: true, reason: null }
      : canCreateProperty(profile?.plan, data.properties.length);
  const blocked = !quota.allowed && createdId === null;

  /* ---------------- Mesure du tunnel ---------------- */

  const isFirstProperty = data.properties.length === 0;
  React.useEffect(() => {
    if (isFirstProperty) trackFunnel("first_property_started", { plan: planLabel });
  }, [isFirstProperty, planLabel]);

  /* ---------------- Locataires déjà enregistrés ---------------- */

  const [people, setPeople] = React.useState<TenantPerson[]>([]);
  React.useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    // La réponse arrive dans un callback asynchrone : aucun setState
    // synchrone n'a lieu dans le corps de l'effet.
    void fetchTenantPeople(createClient())
      .then((rows) => {
        if (cancelled) return;
        setPeople(rows);
        // Un compte sans aucun locataire ne se voit pas proposer un choix vide.
        if (rows.length > 0) setValues((v) => ({ ...v, tenantMode: "existing" }));
      })
      .catch(() => {
        // Liste indisponible : la création d'un nouveau locataire reste possible.
      });
    return () => {
      cancelled = true;
    };
  }, [isLive]);

  const set = <K extends keyof DraftValues>(key: K, value: DraftValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  /* ---------------- Documents (étape 3) ---------------- */

  const [file, setFile] = React.useState<File | null>(null);
  const [docName, setDocName] = React.useState("");
  const [docCategory, setDocCategory] = React.useState<DocumentCategory>("bail");
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const [docAdded, setDocAdded] = React.useState(false);

  /* ---------------- Validation ---------------- */

  const validateStep1 = (): boolean => {
    const next: Errors = {};
    if (values.name.trim().length < 2) {
      next.name = "Donnez un nom court à ce logement.";
    }
    if (values.address.trim().length < 4) next.address = "Adresse requise.";
    if (!/^\d{5}$/.test(values.postalCode.trim())) {
      next.postalCode = "Code postal à 5 chiffres.";
    }
    if (values.city.trim().length < 2) next.city = "Ville requise.";
    const surface = parseAmount(values.surface);
    if (surface === null || surface <= 0) {
      next.surface = "Indiquez la surface en m².";
    }
    if (needsRoomCount(values.type)) {
      const rooms = parseAmount(values.rooms);
      if (rooms === null || rooms < 1) next.rooms = "Au moins 1 pièce.";
    }
    if (values.purchasePrice.trim() !== "") {
      const price = parseAmount(values.purchasePrice);
      if (price === null || price < 0) next.purchasePrice = "Montant invalide.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateStep2 = (): boolean => {
    if (values.status === "vacant") return true;
    const next: Errors = {};
    if (values.tenantMode === "existing") {
      if (!values.tenantId) next.tenantId = "Choisissez un locataire.";
    } else {
      if (values.firstName.trim().length < 2) next.firstName = "Prénom requis.";
      if (values.lastName.trim().length < 2) next.lastName = "Nom requis.";
      if (
        values.email.trim() !== "" &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
      ) {
        next.email = "Adresse e-mail invalide.";
      }
    }
    const rent = parseAmount(values.rent);
    if (rent === null || rent < 0) next.rent = "Indiquez le loyer mensuel.";
    if (values.charges.trim() !== "") {
      const charges = parseAmount(values.charges);
      if (charges === null || charges < 0) next.charges = "Montant invalide.";
    }
    if (values.deposit.trim() !== "") {
      const deposit = parseAmount(values.deposit);
      if (deposit === null || deposit < 0) next.deposit = "Montant invalide.";
    }
    if (!values.entryDate) next.entryDate = "Date d'entrée requise.";
    // Une entrée dans le futur lointain est presque toujours une faute de saisie.
    else if (values.entryDate > todayISO()) {
      const inOneYear = new Date();
      inOneYear.setFullYear(inOneYear.getFullYear() + 1);
      if (values.entryDate > inOneYear.toISOString().slice(0, 10)) {
        next.entryDate = "Cette date est à plus d'un an : vérifiez l'année.";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  /* ---------------- Écriture ---------------- */

  /** Crée le logement puis, s'il est loué, son bail. Idempotent en cas de reprise. */
  const createProperty = async () => {
    if (busy) return;
    if (!validateStep2()) return;

    // Deuxième contrôle du quota, juste avant l'écriture (le compte a pu
    // changer entre-temps, dans un autre onglet par exemple).
    if (createdId === null && !quota.allowed) {
      toast.error(quota.reason ?? "Limite de logements atteinte.");
      return;
    }

    setBusy(true);
    try {
      const surface = parseAmount(values.surface) ?? 0;
      const rooms = needsRoomCount(values.type)
        ? (parseAmount(values.rooms) ?? 1)
        : (ROOMS_BY_TYPE[values.type] as number);
      const rent = values.status === "loue" ? (parseAmount(values.rent) ?? 0) : 0;
      const charges =
        values.status === "loue" ? (parseAmount(values.charges) ?? 0) : 0;

      let propertyId = createdId;
      if (propertyId === null) {
        const property = await addProperty({
          name: values.name.trim(),
          address: values.address.trim(),
          postalCode: values.postalCode.trim(),
          city: values.city.trim(),
          type: values.type,
          surface,
          rooms,
          // Non demandés à l'étape 1 : 0 signifie « pas encore renseigné »,
          // et la fiche du logement permet de les compléter.
          purchasePrice: parseAmount(values.purchasePrice) ?? 0,
          purchaseDate: values.purchaseDate || todayISO(),
          rent,
          charges,
          // Le statut n'est « loué » qu'une fois le bail réellement créé :
          // sinon un échec laisserait un logement « loué » sans locataire.
          status: "vacant",
          photo: "",
        });
        propertyId = property.id;
        setCreatedId(property.id);
      }

      if (values.status === "loue" && !leaseDone) {
        const deposit = parseAmount(values.deposit) ?? 0;
        if (values.tenantMode === "existing") {
          await addLeaseForExistingTenant({
            propertyId,
            tenantId: values.tenantId,
            entryDate: values.entryDate,
            rent,
            charges,
            deposit,
          });
        } else {
          await addTenant({
            propertyId,
            firstName: values.firstName.trim(),
            lastName: values.lastName.trim(),
            email: values.email.trim(),
            phone: values.phone.trim(),
            entryDate: values.entryDate,
            rent,
            charges,
            deposit,
          });
        }
        setLeaseDone(true);
      }

      if (isFirstProperty) {
        trackFunnel("first_property_created", { plan: planLabel });
      }
      draft.clear();
      setStep(3);
    } catch (e) {
      toast.error(toUserMessage(e, "Création impossible. Réessayez."));
    } finally {
      setBusy(false);
    }
  };

  /** Étape 3 : le document, rattaché au logement déjà créé. */
  const uploadDocument = async () => {
    if (!file || !createdId || busy) return;
    setBusy(true);
    // La progression est une estimation honnête : le SDK Supabase Storage
    // n'expose pas d'événement de téléversement. On avance jusqu'à 90 % puis
    // on attend la VRAIE fin de l'appel — jamais 100 % avant l'accusé.
    setUploadProgress(8);
    const ticker = window.setInterval(() => {
      setUploadProgress((p) => (p === null ? null : Math.min(90, p + 7)));
    }, 220);
    try {
      await addDocument(
        {
          propertyId: createdId,
          name: docName.trim() || file.name.replace(/\.[^.]+$/, ""),
          category: docCategory,
        },
        file
      );
      setUploadProgress(100);
      setDocAdded(true);
      setStep(4);
    } catch (e) {
      toast.error(toUserMessage(e, "Import du document impossible."));
      setUploadProgress(null);
    } finally {
      window.clearInterval(ticker);
      setBusy(false);
    }
  };

  const exit = () => {
    if (createdId) {
      router.push(`/logements/${createdId}`);
      return;
    }
    if (confirmLeave()) router.push("/logements");
  };

  /* ---------------- Écran de quota atteint ---------------- */

  if (blocked) {
    return (
      <FormShell>
        <FormTopBar backHref="/logements" exitHref="/logements" />
        <FormBody>
          <FormHeading
            title="Votre plan est complet."
            description={quota.reason ?? undefined}
          />
          <div className="space-y-4 rounded-xl bg-primary-soft px-4 py-4">
            <p className="flex items-start gap-2.5 text-sm text-foreground">
              <Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              Votre plan {plan.name} inclut{" "}
              {plan.limits.maxProperties === null
                ? "un nombre illimité de logements"
                : `${plan.limits.maxProperties} logement${plan.limits.maxProperties > 1 ? "s" : ""}`}
              . Vos données saisies ne sont pas perdues : elles vous attendront
              ici après le changement de plan.
            </p>
          </div>
        </FormBody>
        <FormActions
          secondary={
            <Link
              href="/logements"
              className="min-h-11 px-3 text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
            >
              Revenir à mes logements
            </Link>
          }
        >
          <Link
            href="/abonnement"
            className="flex min-h-12 w-full items-center justify-center rounded-[0.625rem] bg-primary px-4 text-[0.95rem] font-semibold text-primary-foreground transition-opacity hover:opacity-95"
          >
            Voir les plans
          </Link>
        </FormActions>
      </FormShell>
    );
  }

  /* ---------------- Étape 1 — Le bien ---------------- */

  if (step === 1) {
    return (
      <FormShell>
        <FormTopBar backHref="/logements" onExit={exit} />
        <FormBody>
          <div className="pt-2">
            <FormProgress step={1} total={3} />
          </div>
          <FormHeading
            title="Parlez-nous de ce logement."
            description="Quelques informations suffisent pour créer son espace."
          />

          <div className="space-y-5 pb-6">
            <TextField
              id="p-name"
              label="Nom du logement"
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="T2 Part-Dieu"
              autoComplete="off"
              enterKeyHint="next"
              hint="Le repère que vous utilisez pour ce bien."
              error={errors.name}
            />

            <TextField
              id="p-address"
              label="Adresse"
              value={values.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="12 avenue Félix Faure"
              autoComplete="street-address"
              enterKeyHint="next"
              error={errors.address}
            />

            <div className="grid grid-cols-2 gap-4">
              <TextField
                id="p-postal"
                label="Code postal"
                value={values.postalCode}
                onChange={(e) => set("postalCode", e.target.value)}
                placeholder="69003"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={5}
                error={errors.postalCode}
              />
              <TextField
                id="p-city"
                label="Ville"
                value={values.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="Lyon"
                autoComplete="address-level2"
                error={errors.city}
              />
            </div>

            <SegmentedField
              name="p-status"
              label="Statut actuel"
              value={values.status}
              onChange={(next) => set("status", next)}
              options={[
                { value: "loue", label: "Loué" },
                { value: "vacant", label: "Vacant" },
              ]}
            />

            <div className="grid grid-cols-2 gap-4">
              <SelectField
                id="p-type"
                label="Type"
                value={values.type}
                onChange={(e) => set("type", e.target.value as PropertyType)}
                options={PROPERTY_TYPES.map((t) => ({ value: t, label: t }))}
              />
              <NumberField
                id="p-surface"
                label="Surface"
                unit="m²"
                value={values.surface}
                onChange={(e) => set("surface", e.target.value)}
                placeholder="42"
                error={errors.surface}
              />
            </div>

            {needsRoomCount(values.type) ? (
              <NumberField
                id="p-rooms"
                label="Nombre de pièces"
                value={values.rooms}
                onChange={(e) => set("rooms", e.target.value)}
                placeholder="4"
                hint="Déduit automatiquement pour un studio ou un T1 à T5."
                error={errors.rooms}
              />
            ) : null}

            <MoreDetails>
              <AmountField
                id="p-price"
                label="Prix d'acquisition"
                optional
                value={values.purchasePrice}
                onChange={(e) => set("purchasePrice", e.target.value)}
                placeholder="189 000"
                hint="Sert au calcul de la rentabilité. Modifiable plus tard."
                error={errors.purchasePrice}
              />
              <DateField
                id="p-purchase-date"
                label="Date d'acquisition"
                optional
                value={values.purchaseDate}
                onChange={(e) => set("purchaseDate", e.target.value)}
                max={todayISO()}
              />
            </MoreDetails>
          </div>
        </FormBody>

        <FormActions
          note={
            // Affiché UNIQUEMENT si le brouillon fonctionne réellement sur cet
            // appareil (le test d'écriture est fait par `useFormDraft`).
            draft.ready ? (
              <FormNote icon={Lock}>
                Votre progression est enregistrée automatiquement.
              </FormNote>
            ) : null
          }
          secondary={
            <FormSecondaryAction onClick={exit}>
              Je terminerai plus tard
            </FormSecondaryAction>
          }
        >
          <SubmitButton
            type="button"
            onClick={() => {
              if (validateStep1()) setStep(2);
            }}
          >
            Continuer vers la location
            <ArrowRight className="size-4" aria-hidden />
          </SubmitButton>
        </FormActions>
      </FormShell>
    );
  }

  /* ---------------- Étape 2 — La location ---------------- */

  if (step === 2) {
    const vacant = values.status === "vacant";
    return (
      <FormShell>
        <FormTopBar onBack={() => setStep(1)} onExit={exit} />
        <FormBody>
          <div className="pt-2">
            <FormProgress step={2} total={3} />
          </div>
          <FormHeading
            title={vacant ? "Ce logement est vacant." : "Qui l'occupe aujourd'hui ?"}
            description={
              vacant
                ? "Rien à renseigner : vous ajouterez un locataire le jour où il entrera."
                : "Le bail et les échéances de loyer seront créés à partir de ces informations."
            }
          />

          {vacant ? (
            <div className="space-y-4 pb-6">
              <div className="rounded-xl bg-primary-soft px-4 py-4">
                <p className="text-sm text-foreground">
                  {values.name.trim() || "Ce logement"} sera créé sans bail. Il
                  apparaîtra dans vos logements avec le statut « Vacant », et
                  aucune échéance de loyer ne sera générée.
                </p>
              </div>
              <button
                type="button"
                onClick={() => set("status", "loue")}
                className="min-h-11 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Finalement, il est loué
              </button>
            </div>
          ) : (
            <div className="space-y-5 pb-6">
              {people.length > 0 ? (
                <SegmentedField
                  name="p-tenant-mode"
                  label="Le locataire"
                  value={values.tenantMode}
                  onChange={(next) => set("tenantMode", next)}
                  options={[
                    { value: "existing", label: "Déjà enregistré" },
                    { value: "new", label: "Nouveau" },
                  ]}
                />
              ) : null}

              {values.tenantMode === "existing" && people.length > 0 ? (
                <SelectField
                  id="p-tenant"
                  label="Locataire"
                  value={values.tenantId}
                  onChange={(e) => set("tenantId", e.target.value)}
                  placeholder="Choisir un locataire"
                  options={people.map((p) => ({
                    value: p.id,
                    label:
                      `${p.firstName} ${p.lastName}`.trim() || p.email || "Locataire",
                  }))}
                  hint="Sa fiche ne sera pas dupliquée : un nouveau bail y sera rattaché."
                  error={errors.tenantId}
                />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <TextField
                      id="p-first"
                      label="Prénom"
                      value={values.firstName}
                      onChange={(e) => set("firstName", e.target.value)}
                      autoComplete="given-name"
                      error={errors.firstName}
                    />
                    <TextField
                      id="p-last"
                      label="Nom"
                      value={values.lastName}
                      onChange={(e) => set("lastName", e.target.value)}
                      autoComplete="family-name"
                      error={errors.lastName}
                    />
                  </div>
                  <TextField
                    id="p-email"
                    label="Adresse e-mail"
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    optional
                    value={values.email}
                    onChange={(e) => set("email", e.target.value)}
                    hint="Nécessaire pour lui envoyer une relance de loyer."
                    error={errors.email}
                  />
                  <TextField
                    id="p-phone"
                    label="Téléphone"
                    type="tel"
                    inputMode="tel"
                    optional
                    value={values.phone}
                    onChange={(e) => set("phone", e.target.value)}
                  />
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <AmountField
                  id="p-rent"
                  label="Loyer"
                  value={values.rent}
                  onChange={(e) => set("rent", e.target.value)}
                  placeholder="780"
                  error={errors.rent}
                />
                <AmountField
                  id="p-charges"
                  label="Charges"
                  optional
                  value={values.charges}
                  onChange={(e) => set("charges", e.target.value)}
                  placeholder="60"
                  error={errors.charges}
                />
              </div>

              <DateField
                id="p-entry"
                label="Date d'entrée"
                value={values.entryDate}
                onChange={(e) => set("entryDate", e.target.value)}
                hint="Les échéances mensuelles seront générées depuis cette date."
                error={errors.entryDate}
              />

              <MoreDetails>
                <AmountField
                  id="p-deposit"
                  label="Dépôt de garantie"
                  optional
                  value={values.deposit}
                  onChange={(e) => set("deposit", e.target.value)}
                  placeholder="780"
                  error={errors.deposit}
                />
              </MoreDetails>
            </div>
          )}
        </FormBody>

        <FormActions
          secondary={
            <FormSecondaryAction onClick={exit} disabled={busy}>
              Je terminerai plus tard
            </FormSecondaryAction>
          }
        >
          <SubmitButton
            type="button"
            pending={busy}
            pendingLabel="Création…"
            onClick={() => void createProperty()}
          >
            Continuer vers les documents
            <ArrowRight className="size-4" aria-hidden />
          </SubmitButton>
        </FormActions>
      </FormShell>
    );
  }

  /* ---------------- Étape 3 — Les documents ---------------- */

  if (step === 3) {
    return (
      <FormShell>
        {/* Le logement EXISTE déjà : revenir en arrière n'aurait aucun sens
            (rien à modifier ici ne changerait ce qui est enregistré). */}
        <FormTopBar onExit={() => setStep(4)} exitLabel="Passer" />
        <FormBody>
          <div className="pt-2">
            <FormProgress step={3} total={3} />
          </div>
          <FormHeading
            title="Ajoutez le bail."
            description="Ou tout autre document : assurance, diagnostic, état des lieux. Il restera privé, seul votre compte y accède."
          />

          <div className="space-y-5 pb-6">
            <FileField
              id="p-doc"
              label="Fichier"
              file={file}
              onFile={(next) => {
                setFile(next);
                if (next && !docName) {
                  setDocName(next.name.replace(/\.[^.]+$/, ""));
                }
              }}
              progress={uploadProgress}
            />

            {file ? (
              <>
                <SelectField
                  id="p-doc-category"
                  label="Catégorie"
                  value={docCategory}
                  onChange={(e) =>
                    setDocCategory(e.target.value as DocumentCategory)
                  }
                  options={toOptions(DOCUMENT_CATEGORY_LABELS)}
                />
                <TextField
                  id="p-doc-name"
                  label="Nom du document"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  hint="Repris du nom du fichier, modifiable."
                />
              </>
            ) : null}
          </div>
        </FormBody>

        <FormActions
          secondary={
            <FormSecondaryAction onClick={() => setStep(4)} disabled={busy}>
              Je l&apos;ajouterai plus tard
            </FormSecondaryAction>
          }
        >
          <SubmitButton
            type="button"
            pending={busy}
            pendingLabel="Import…"
            disabled={!file}
            onClick={() => void uploadDocument()}
          >
            Ajouter ce document
          </SubmitButton>
        </FormActions>
      </FormShell>
    );
  }

  /* ---------------- Résumé ---------------- */

  const created = data.properties.find((p) => p.id === createdId) ?? null;
  const lease = createdId
    ? (data.tenants.find((t) => t.propertyId === createdId && !t.exitDate) ?? null)
    : null;

  return (
    <FormShell>
      <FormTopBar />
      <FormBody>
        <div className="flex justify-center pt-8 pb-6">
          <span className="grid size-14 place-items-center rounded-full bg-success-soft text-success">
            <Check className="size-7" aria-hidden />
          </span>
        </div>
        <FormHeading
          title={`${created?.name ?? values.name.trim()} est créé.`}
          description="Voici ce qui est enregistré. Tout reste modifiable depuis sa fiche."
        />

        <dl className="divide-y divide-border pb-6">
          <SummaryRow
            label="Adresse"
            value={`${values.address.trim()}, ${values.postalCode.trim()} ${values.city.trim()}`}
          />
          <SummaryRow
            label="Bien"
            value={`${values.type} · ${formatSurface(parseAmount(values.surface) ?? 0)}`}
          />
          <SummaryRow
            label="Statut"
            value={lease ? "Loué" : "Vacant"}
            tone={lease ? "success" : "default"}
          />
          {lease ? (
            <>
              <SummaryRow
                label="Locataire"
                value={`${lease.firstName} ${lease.lastName}`.trim() || "—"}
              />
              <SummaryRow
                label="Loyer mensuel"
                value={`${formatCurrency(lease.rent + lease.charges)}${
                  lease.charges > 0
                    ? ` dont ${formatCurrency(lease.charges)} de charges`
                    : ""
                }`}
              />
            </>
          ) : null}
          <SummaryRow
            label="Document"
            value={docAdded ? (docName || "Ajouté") : "Aucun pour l'instant"}
            tone={docAdded ? "success" : "default"}
          />
        </dl>
      </FormBody>

      <FormActions
        secondary={
          <Link
            href="/"
            className="min-h-11 px-3 text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
          >
            Aller au tableau de bord
          </Link>
        }
      >
        <Link
          href={createdId ? `/logements/${createdId}` : "/logements"}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.625rem] bg-primary px-4 text-[0.95rem] font-semibold text-primary-foreground transition-opacity hover:opacity-95"
        >
          Ouvrir la fiche du logement
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </FormActions>
    </FormShell>
  );
}

function SummaryRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={
          tone === "success"
            ? "text-right text-sm font-medium text-success"
            : "text-right text-sm font-medium text-foreground"
        }
      >
        {value}
      </dd>
    </div>
  );
}
