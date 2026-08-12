"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isPlanId, type PlanId } from "@/config/plans";
import { todayISO } from "@/lib/dates";
import { formatCurrency, formatMonth } from "@/lib/format";
import { trackFunnel } from "@/lib/funnel";
import { logger } from "@/lib/logger";
import { ONBOARDING_TOTAL_STEPS } from "@/lib/onboarding";
import { useAppStore } from "@/lib/store";
import type { Property, PropertyType } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * GUIDE DE DÉMARRAGE — il ne raconte rien, il fait.
 *
 * L'ancienne visite (bulles, surbrillances, « cliquez ici ») a disparu : elle
 * visait la sidebar, donc rien du tout sous 1024 px, et ne créait aucune
 * donnée. Ici chaque étape écrit RÉELLEMENT dans Supabase, par les mêmes
 * fonctions que le reste de l'application (store → mutations → RLS) : le
 * logement, le bail et le document du guide sont les vrais objets du compte.
 *
 * Cinq écrans : accueil, logement, location, bail, résumé.
 *
 * Ouverture automatique — uniquement si TOUT est vrai :
 *   - le profil est chargé (session confirmée, garantie par le proxy) ;
 *   - le guide n'est ni terminé ni ignoré ;
 *   - l'espace ne contient encore aucun logement.
 * La dernière condition évite d'ouvrir « ajoutez votre premier logement »
 * devant quelqu'un qui en gère déjà trois (par exemple après une montée de
 * version du guide). Le composant n'est monté que dans le layout applicatif
 * protégé : jamais sur la landing, l'authentification, Stripe ou l'admin.
 *
 * Reprise : l'étape courante est persistée côté serveur à chaque avancée
 * (POST /api/onboarding, écriture ciblée sur la ligne de l'utilisateur
 * authentifié). Se reconnecter ailleurs reprend donc à la bonne étape, et le
 * logement en cours est retrouvé même sans état local (dernier logement créé).
 *
 * Fermeture : « Je terminerai plus tard » enregistre l'étape et marque le
 * guide comme ignoré — il ne se rouvre plus tout seul. Le relais est pris par
 * la checklist discrète du tableau de bord, et par Paramètres → Aide.
 */

/* ------------------------------------------------------------------ */
/*  Constantes                                                        */
/* ------------------------------------------------------------------ */

const PROPERTY_TYPES: PropertyType[] = ["Studio", "T1", "T2", "T3", "T4", "T5", "Maison"];

/**
 * Nombre de pièces déduit du type — ce n'est pas une invention : « T3 » veut
 * dire trois pièces. Seule la maison, qui n'encode rien, est demandée.
 * (La colonne `rooms` est `not null check (rooms >= 1)` en base.)
 */
const ROOMS_BY_TYPE: Record<PropertyType, number | null> = {
  Studio: 1,
  T1: 1,
  T2: 2,
  T3: 3,
  T4: 4,
  T5: 5,
  Maison: null,
};

/** Index des écrans. 0 = accueil, 1…4 = les quatre étapes. */
const WELCOME = 0;
const STEP_PROPERTY = 1;
const STEP_LEASE = 2;
const STEP_DOCUMENT = 3;
const STEP_SUMMARY = 4;

/* ------------------------------------------------------------------ */
/*  Petits éléments partagés                                          */
/* ------------------------------------------------------------------ */

function StepProgress({ step }: { step: number }) {
  const total = ONBOARDING_TOTAL_STEPS - 1; // l'accueil n'est pas une étape
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Étape {step} sur {total}
      </p>
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Étape ${step} sur ${total}`}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200"
          style={{ width: `${(step * 100) / total}%` }}
        />
      </div>
    </div>
  );
}

/** Choix binaire tactile (loué / vacant, occupé / libre). */
function Choice<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string; hint?: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex min-h-14 flex-col items-start justify-center gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors duration-200",
              active
                ? "border-primary bg-primary/5 text-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-accent/60"
            )}
          >
            <span className={cn("text-sm", active && "font-medium text-foreground")}>
              {option.label}
            </span>
            {option.hint ? (
              <span className="text-[11px] text-muted-foreground">{option.hint}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Pied d'écran : action principale pleine largeur + report discret. */
function StepFooter({
  onLater,
  children,
}: {
  onLater: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 pt-1">
      {children}
      <button
        type="button"
        onClick={onLater}
        className="mx-auto block min-h-11 px-2 text-xs text-muted-foreground underline-offset-4 hover:underline"
      >
        Je terminerai plus tard
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Le guide                                                          */
/* ------------------------------------------------------------------ */

export function OnboardingFlow() {
  const { data, profile, loading, addProperty, updateProperty, addTenant, addDocument, refresh, completeOnboarding, skipOnboarding, saveOnboardingStep } =
    useAppStore();
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState(WELCOME);
  const [propertyId, setPropertyId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const autoOpened = React.useRef(false);

  /** Logement du guide : celui qu'on vient de créer, sinon le dernier connu. */
  const property: Property | null =
    (propertyId ? data.properties.find((p) => p.id === propertyId) : null) ??
    (data.properties.length > 0 ? data.properties[data.properties.length - 1] : null) ??
    null;

  const tenant = property
    ? data.tenants.find((t) => t.propertyId === property.id && !t.exitDate) ?? null
    : null;
  const lease = tenant;
  const bail = property
    ? data.documents.find((d) => d.propertyId === property.id && d.category === "bail") ?? null
    : null;

  /* ---------------- Ouverture ---------------- */

  React.useEffect(() => {
    if (loading || !profile || autoOpened.current) return;
    if (profile.onboardingCompleted || profile.onboardingSkipped) return;
    // Un espace déjà rempli n'a pas besoin d'un guide de premier logement.
    if (data.properties.length > 0) return;
    autoOpened.current = true;
    const resume = Math.min(Math.max(profile.onboardingCurrentStep ?? 0, 0), STEP_SUMMARY);
    // Différé d'un tick : aucun setState synchrone dans le corps de l'effet
    // (cascade de rendus), et l'écran d'accueil a le temps de se peindre.
    const id = window.setTimeout(() => {
      setStep(resume);
      setOpen(true);
    }, 80);
    return () => window.clearTimeout(id);
  }, [loading, profile, data.properties.length]);

  // Relance manuelle : Paramètres → Aide, ou la checklist du tableau de bord.
  React.useEffect(() => {
    const relaunch = () => {
      autoOpened.current = true;
      const saved = Math.min(Math.max(profile?.onboardingCurrentStep ?? 0, 0), STEP_SUMMARY);
      // Sans logement, aucune étape suivante n'a de sens : on repart du début.
      setStep(data.properties.length === 0 ? WELCOME : saved);
      setOpen(true);
    };
    window.addEventListener("immopilot:onboarding", relaunch);
    return () => window.removeEventListener("immopilot:onboarding", relaunch);
  }, [profile, data.properties.length]);

  /* ---------------- Mesure du tunnel ---------------- */

  /**
   * Le guide crée le premier logement SANS passer par `PropertyWizard` :
   * sans ces deux appels, les deux dernières étapes du tunnel resteraient
   * vides pour le chemin le plus fréquent d'un nouveau compte. `trackFunnel`
   * dédoublonne, donc rien n'est compté deux fois si l'assistant complet est
   * ouvert ensuite.
   */
  const planLabel: PlanId =
    profile && isPlanId(profile.plan) ? (profile.plan as PlanId) : "free";

  React.useEffect(() => {
    if (open && step === STEP_PROPERTY) {
      trackFunnel("first_property_started", { plan: planLabel, element: "guide" });
    }
  }, [open, step, planLabel]);

  /* ---------------- Progression ---------------- */

  /** Avance d'un écran et mémorise la position (best-effort, jamais bloquant). */
  const goTo = React.useCallback(
    (next: number) => {
      setStep(next);
      void saveOnboardingStep(next).catch((e) => logger.error("onboarding/step", e));
    },
    [saveOnboardingStep]
  );

  /** « Je terminerai plus tard » : on retient où on en est, puis on ferme. */
  const later = React.useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await skipOnboarding(step);
      setOpen(false);
    } catch (e) {
      logger.error("onboarding/skip", e);
      toast.error("Impossible d'enregistrer votre progression. Réessayez.");
    } finally {
      setBusy(false);
    }
  }, [busy, skipOnboarding, step]);

  /** Fin du guide : marqué terminé, puis retour au tableau de bord réel. */
  const finish = React.useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await completeOnboarding();
      setOpen(false);
      router.push("/");
    } catch (e) {
      logger.error("onboarding/complete", e);
      toast.error("Impossible d'enregistrer la fin du guide. Réessayez.");
    } finally {
      setBusy(false);
    }
  }, [busy, completeOnboarding, router]);

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Toute fermeture (voile, Échap, croix) vaut « plus tard » : la
        // progression est enregistrée, rien n'est perdu.
        if (!next) void later();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-1.5rem)] max-w-lg overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {step === WELCOME ? (
          <WelcomeScreen
            onStart={() => goTo(STEP_PROPERTY)}
            onDiscover={() => void later()}
            busy={busy}
          />
        ) : null}

        {step === STEP_PROPERTY ? (
          <PropertyStep
            busy={busy}
            onLater={() => void later()}
            onDone={async (values) => {
              if (busy) return;
              setBusy(true);
              try {
                const created = await addProperty(values);
                trackFunnel("first_property_created", { plan: planLabel, element: "guide" });
                setPropertyId(created.id);
                goTo(STEP_LEASE);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Création impossible.");
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : null}

        {step === STEP_LEASE ? (
          <LeaseStep
            property={property}
            alreadyLeased={Boolean(lease)}
            busy={busy}
            onLater={() => void later()}
            onSkip={() => goTo(STEP_DOCUMENT)}
            onDone={async (values) => {
              if (busy || !property) return;
              setBusy(true);
              try {
                await addTenant({
                  propertyId: property.id,
                  firstName: values.firstName,
                  lastName: values.lastName,
                  email: values.email,
                  phone: "",
                  entryDate: values.entryDate,
                  rent: values.rent,
                  charges: values.charges,
                  deposit: 0,
                });
                // Le loyer du bail devient celui du logement : la fiche, les
                // statistiques et la rentabilité parlent du même montant.
                await updateProperty(property.id, {
                  name: property.name,
                  address: property.address,
                  postalCode: property.postalCode,
                  city: property.city,
                  type: property.type,
                  surface: property.surface,
                  rooms: property.rooms,
                  purchasePrice: property.purchasePrice,
                  purchaseDate: property.purchaseDate,
                  rent: values.rent,
                  charges: values.charges,
                  status: "loue",
                  photo: property.photo,
                });
                // Les échéances du bail sont générées au chargement suivant :
                // on recharge pour que le résumé montre un vrai prochain loyer.
                await refresh();
                goTo(STEP_DOCUMENT);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : null}

        {step === STEP_DOCUMENT ? (
          <DocumentStep
            property={property}
            busy={busy}
            onLater={() => void later()}
            onSkip={() => goTo(STEP_SUMMARY)}
            onDone={async (file) => {
              if (busy || !property) return;
              setBusy(true);
              try {
                await addDocument(
                  {
                    propertyId: property.id,
                    name: file.name.replace(/\.[^.]+$/, ""),
                    category: "bail",
                  },
                  file
                );
                goTo(STEP_SUMMARY);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Envoi impossible.");
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : null}

        {step === STEP_SUMMARY ? (
          <SummaryScreen
            property={property}
            tenantName={tenant ? `${tenant.firstName} ${tenant.lastName}`.trim() : null}
            nextPayment={
              property
                ? data.rentPayments
                    .filter((p) => p.propertyId === property.id && p.received < p.expected)
                    .sort((a, b) => a.month.localeCompare(b.month))[0] ?? null
                : null
            }
            hasBail={Boolean(bail)}
            busy={busy}
            onFinish={() => void finish()}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Écran d'accueil                                                   */
/* ------------------------------------------------------------------ */

function WelcomeScreen({
  onStart,
  onDiscover,
  busy,
}: {
  onStart: () => void;
  onDiscover: () => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <DialogTitle className="text-xl">Bienvenue dans Nireo.</DialogTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Commençons par organiser votre premier logement.
        </p>
      </div>

      {/* Ce qui va réellement se passer — trois lignes, aucun faux écran. */}
      <ol className="space-y-2 border-l border-border pl-4 text-sm text-muted-foreground">
        <li>Le logement et son adresse.</li>
        <li>Le bail et le loyer, s&apos;il est occupé.</li>
        <li>Le document du bail, si vous l&apos;avez sous la main.</li>
      </ol>

      <div className="space-y-3">
        <Button className="h-11 w-full" onClick={onStart} disabled={busy}>
          Ajouter mon premier logement
        </Button>
        <button
          type="button"
          onClick={onDiscover}
          disabled={busy}
          className="mx-auto block min-h-11 px-2 text-sm text-primary underline-offset-4 hover:underline disabled:opacity-60"
        >
          Découvrir d&apos;abord mon espace
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Étape 1 — le logement                                             */
/* ------------------------------------------------------------------ */

interface PropertyValues {
  name: string;
  address: string;
  postalCode: string;
  city: string;
  type: PropertyType;
  surface: number;
  rooms: number;
  purchasePrice: number;
  purchaseDate: string;
  rent: number;
  charges: number;
  status: string;
}

function PropertyStep({
  busy,
  onDone,
  onLater,
}: {
  busy: boolean;
  onDone: (values: PropertyValues) => void | Promise<void>;
  onLater: () => void;
}) {
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<PropertyType>("T2");
  const [address, setAddress] = React.useState("");
  const [postalCode, setPostalCode] = React.useState("");
  const [city, setCity] = React.useState("");
  const [surface, setSurface] = React.useState("");
  const [rooms, setRooms] = React.useState("");
  const [status, setStatus] = React.useState<"loue" | "vacant">("vacant");
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const needsRooms = ROOMS_BY_TYPE[type] === null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = "Donnez un nom court à ce logement.";
    if (address.trim().length < 4) next.address = "Adresse requise.";
    if (!/^\d{5}$/.test(postalCode.trim())) next.postalCode = "Code postal à 5 chiffres.";
    if (city.trim().length < 2) next.city = "Ville requise.";
    const surfaceValue = Number(surface.replace(",", "."));
    if (!Number.isFinite(surfaceValue) || surfaceValue <= 0) next.surface = "Surface en m².";
    const roomsValue = needsRooms ? Number(rooms) : (ROOMS_BY_TYPE[type] as number);
    if (!Number.isFinite(roomsValue) || roomsValue < 1) next.rooms = "Au moins 1 pièce.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    void onDone({
      name: name.trim(),
      address: address.trim(),
      postalCode: postalCode.trim(),
      city: city.trim(),
      type,
      surface: surfaceValue,
      rooms: roomsValue,
      // Non demandés ici : ils se complètent dans la fiche du logement, et
      // rien ne dépend d'une valeur inventée (0 = « pas encore renseigné »).
      purchasePrice: 0,
      purchaseDate: todayISO(),
      rent: 0,
      charges: 0,
      status,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <StepProgress step={1} />

      <div className="space-y-1">
        <DialogTitle className="text-xl">Votre premier logement</DialogTitle>
        <p className="text-sm text-muted-foreground">
          Le strict nécessaire pour créer le dossier. Tout le reste se complétera
          dans sa fiche.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ob-name">Nom ou repère</Label>
          <Input
            id="ob-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="T2 Part-Dieu"
            autoComplete="off"
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name ? <p className="text-xs text-destructive">{errors.name}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ob-type">Type de bien</Label>
          <Select value={type} onValueChange={(v) => setType(v as PropertyType)}>
            <SelectTrigger id="ob-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROPERTY_TYPES.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ob-address">Adresse</Label>
          <Input
            id="ob-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="12 rue de la République"
            autoComplete="street-address"
            aria-invalid={Boolean(errors.address)}
          />
          {errors.address ? (
            <p className="text-xs text-destructive">{errors.address}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ob-postal">Code postal</Label>
            <Input
              id="ob-postal"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="69003"
              aria-invalid={Boolean(errors.postalCode)}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="ob-city">Ville</Label>
            <Input
              id="ob-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              autoComplete="address-level2"
              placeholder="Lyon"
              aria-invalid={Boolean(errors.city)}
            />
          </div>
        </div>
        {errors.postalCode || errors.city ? (
          <p className="text-xs text-destructive">{errors.postalCode ?? errors.city}</p>
        ) : null}

        <div className={cn("grid gap-3", needsRooms ? "grid-cols-2" : "grid-cols-1")}>
          <div className="space-y-1.5">
            <Label htmlFor="ob-surface">Surface (m²)</Label>
            <Input
              id="ob-surface"
              value={surface}
              onChange={(e) => setSurface(e.target.value)}
              inputMode="decimal"
              placeholder="42"
              aria-invalid={Boolean(errors.surface)}
            />
          </div>
          {needsRooms ? (
            <div className="space-y-1.5">
              <Label htmlFor="ob-rooms">Pièces</Label>
              <Input
                id="ob-rooms"
                value={rooms}
                onChange={(e) => setRooms(e.target.value)}
                inputMode="numeric"
                placeholder="4"
                aria-invalid={Boolean(errors.rooms)}
              />
            </div>
          ) : null}
        </div>
        {errors.surface || errors.rooms ? (
          <p className="text-xs text-destructive">{errors.surface ?? errors.rooms}</p>
        ) : null}

        <div className="space-y-2">
          <Label>Statut</Label>
          <Choice
            label="Statut du logement"
            value={status}
            onChange={setStatus}
            options={[
              { value: "loue", label: "Loué", hint: "un locataire est en place" },
              { value: "vacant", label: "Vacant", hint: "libre pour le moment" },
            ]}
          />
        </div>
      </div>

      <StepFooter onLater={onLater}>
        <Button type="submit" className="h-11 w-full" disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Création…
            </>
          ) : (
            "Continuer"
          )}
        </Button>
      </StepFooter>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Étape 2 — la location                                             */
/* ------------------------------------------------------------------ */

interface LeaseValues {
  firstName: string;
  lastName: string;
  email: string;
  entryDate: string;
  rent: number;
  charges: number;
}

function LeaseStep({
  property,
  alreadyLeased,
  busy,
  onDone,
  onSkip,
  onLater,
}: {
  property: Property | null;
  alreadyLeased: boolean;
  busy: boolean;
  onDone: (values: LeaseValues) => void | Promise<void>;
  onSkip: () => void;
  onLater: () => void;
}) {
  const [occupied, setOccupied] = React.useState<"oui" | "non">(
    property?.status === "loue" ? "oui" : "non"
  );
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [entryDate, setEntryDate] = React.useState(todayISO());
  const [rent, setRent] = React.useState("");
  const [charges, setCharges] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  // Le bail existe déjà (retour en arrière, reprise) : on ne le recrée pas.
  if (alreadyLeased) {
    return (
      <div className="space-y-5">
        <StepProgress step={2} />
        <div className="space-y-1">
          <DialogTitle className="text-xl">Ce logement est-il occupé ?</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Le bail est déjà enregistré pour ce logement. Vous pourrez le modifier
            depuis sa fiche.
          </p>
        </div>
        <StepFooter onLater={onLater}>
          <Button className="h-11 w-full" onClick={onSkip} disabled={busy}>
            Continuer
          </Button>
        </StepFooter>
      </div>
    );
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (occupied === "non") {
      onSkip();
      return;
    }
    const next: Record<string, string> = {};
    if (firstName.trim().length < 2) next.firstName = "Prénom requis.";
    if (lastName.trim().length < 2) next.lastName = "Nom requis.";
    if (!entryDate) next.entryDate = "Date d'entrée requise.";
    const rentValue = Number(rent.replace(",", "."));
    if (!Number.isFinite(rentValue) || rentValue < 0) next.rent = "Montant du loyer.";
    const chargesValue = charges.trim() === "" ? 0 : Number(charges.replace(",", "."));
    if (!Number.isFinite(chargesValue) || chargesValue < 0) next.charges = "Charges invalides.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    void onDone({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      entryDate,
      rent: rentValue,
      charges: chargesValue,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <StepProgress step={2} />

      <div className="space-y-1">
        <DialogTitle className="text-xl">Ce logement est-il occupé ?</DialogTitle>
        <p className="text-sm text-muted-foreground">
          {property ? property.name : "Votre logement"} — vous pourrez toujours
          ajouter un bail plus tard.
        </p>
      </div>

      <Choice
        label="Le logement est-il occupé ?"
        value={occupied}
        onChange={setOccupied}
        options={[
          { value: "oui", label: "Oui, il est loué", hint: "un bail est en cours" },
          { value: "non", label: "Non, il est vacant", hint: "je passe cette étape" },
        ]}
      />

      {occupied === "oui" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ob-first">Prénom</Label>
              <Input
                id="ob-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                aria-invalid={Boolean(errors.firstName)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-last">Nom</Label>
              <Input
                id="ob-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                aria-invalid={Boolean(errors.lastName)}
              />
            </div>
          </div>
          {errors.firstName || errors.lastName ? (
            <p className="-mt-2 text-xs text-destructive">
              {errors.firstName ?? errors.lastName}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="ob-email">E-mail du locataire (facultatif)</Label>
            <Input
              id="ob-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="pour les relances de loyer"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ob-entry">Date d&apos;entrée</Label>
            <Input
              id="ob-entry"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              aria-invalid={Boolean(errors.entryDate)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ob-rent">Loyer (€)</Label>
              <Input
                id="ob-rent"
                value={rent}
                onChange={(e) => setRent(e.target.value)}
                inputMode="decimal"
                placeholder="750"
                aria-invalid={Boolean(errors.rent)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-charges">Charges (€)</Label>
              <Input
                id="ob-charges"
                value={charges}
                onChange={(e) => setCharges(e.target.value)}
                inputMode="decimal"
                placeholder="50"
                aria-invalid={Boolean(errors.charges)}
              />
            </div>
          </div>
          {errors.rent || errors.charges ? (
            <p className="-mt-2 text-xs text-destructive">{errors.rent ?? errors.charges}</p>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Les échéances mensuelles seront générées automatiquement depuis la date
            d&apos;entrée.
          </p>
        </div>
      ) : null}

      <StepFooter onLater={onLater}>
        <Button type="submit" className="h-11 w-full" disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Enregistrement…
            </>
          ) : (
            "Continuer"
          )}
        </Button>
      </StepFooter>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Étape 3 — le bail                                                 */
/* ------------------------------------------------------------------ */

function DocumentStep({
  property,
  busy,
  onDone,
  onSkip,
  onLater,
}: {
  property: Property | null;
  busy: boolean;
  onDone: (file: File) => void | Promise<void>;
  onSkip: () => void;
  onLater: () => void;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-5">
      <StepProgress step={3} />

      <div className="space-y-1">
        <DialogTitle className="text-xl">Ajoutez le bail</DialogTitle>
        <p className="text-sm text-muted-foreground">
          Le document réel, rangé dans le dossier
          {property ? ` de ${property.name}` : ""}. PDF, photo ou Word.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.docx"
        className="sr-only"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex min-h-24 w-full items-center gap-3 rounded-lg border border-dashed border-border bg-card px-4 py-4 text-left transition-colors duration-200 hover:bg-accent/60"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-background text-muted-foreground">
          <FileText className="size-4" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">
            {file ? file.name : "Choisir le fichier du bail"}
          </span>
          <span className="block text-xs text-muted-foreground">
            {file
              ? "Prêt à être envoyé dans votre bibliothèque privée."
              : "Il restera privé : seul votre compte peut y accéder."}
          </span>
        </span>
      </button>

      <StepFooter onLater={onLater}>
        <div className="space-y-2">
          <Button
            className="h-11 w-full"
            disabled={busy || !file}
            onClick={() => file && void onDone(file)}
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Envoi…
              </>
            ) : (
              "Ajouter ce document"
            )}
          </Button>
          <Button
            variant="outline"
            className="h-11 w-full"
            onClick={onSkip}
            disabled={busy}
          >
            Je l&apos;ajouterai plus tard
          </Button>
        </div>
      </StepFooter>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Étape 4 — le résumé                                               */
/* ------------------------------------------------------------------ */

function SummaryScreen({
  property,
  tenantName,
  nextPayment,
  hasBail,
  busy,
  onFinish,
}: {
  property: Property | null;
  tenantName: string | null;
  nextPayment: { month: string; expected: number } | null;
  hasBail: boolean;
  busy: boolean;
  onFinish: () => void;
}) {
  const rows: { label: string; value: string; done: boolean }[] = [
    { label: "Logement", value: property?.name ?? "—", done: Boolean(property) },
    {
      label: "Statut",
      value: property?.status === "loue" ? "Loué" : "Vacant",
      done: true,
    },
    ...(tenantName ? [{ label: "Locataire", value: tenantName, done: true }] : []),
    ...(nextPayment
      ? [
          {
            label: "Prochain loyer",
            value: `${formatMonth(nextPayment.month)} · ${formatCurrency(nextPayment.expected)}`,
            done: true,
          },
        ]
      : []),
    {
      label: "Bail",
      value: hasBail ? "Ajouté" : "À ajouter",
      done: hasBail,
    },
  ];

  return (
    <div className="space-y-5">
      <StepProgress step={4} />

      <div className="space-y-1">
        <DialogTitle className="text-xl">Votre espace est prêt.</DialogTitle>
        <p className="text-sm text-muted-foreground">
          Voici ce qui est enregistré. Tout est modifiable depuis la fiche du
          logement.
        </p>
      </div>

      <dl className="divide-y divide-border rounded-lg border border-border bg-card">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <dt className="text-sm text-muted-foreground">{row.label}</dt>
            <dd className="flex min-w-0 items-center gap-2 text-right text-sm font-medium text-foreground">
              <span className="truncate">{row.value}</span>
              {row.done ? (
                <Check className="size-4 shrink-0 text-emerald-600" aria-hidden />
              ) : null}
            </dd>
          </div>
        ))}
      </dl>

      <Button className="h-11 w-full" onClick={onFinish} disabled={busy}>
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Enregistrement…
          </>
        ) : (
          "Voir mon tableau de bord"
        )}
      </Button>
    </div>
  );
}
