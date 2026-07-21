"use client";

import * as React from "react";
import type {
  AppData,
  Expense,
  Property,
  PropertyDocument,
  PropertyPhoto,
  RentPayment,
  Tenant,
  Work,
} from "./types";
import { seedData } from "./data";
import { todayISO } from "./dates";
import { tenantFullName } from "./finance";
import { DEFAULT_PROPERTY_PHOTO } from "./constants";
import { createClient } from "./supabase/client";
import { isSupabaseConfigured } from "./supabase/config";
import { fetchAppData, type UserProfile } from "./supabase/queries";
import {
  deleteDocumentRow,
  deleteExpenseRow,
  deleteLeaseRow,
  deletePaymentRow,
  deletePhotoRow,
  deletePropertyRow,
  deleteWorkRow,
  endLeaseRow,
  insertDocument,
  insertExpense,
  insertPhoto,
  insertProperty,
  insertTenantWithLease,
  insertWork,
  recordPayment,
  updateDocumentRow,
  updateExpenseRow,
  updatePaymentRow,
  updateProfileRow,
  updatePropertyRow,
  updateTenantLease,
  updateWorkRow,
  type DocumentUpdateInput,
  type ExpenseInput,
  type PaymentUpdateInput,
  type ProfileInput,
  type PropertyInput,
  type TenantInput,
  type TenantUpdateInput,
  type WorkUpdateInput,
} from "./supabase/mutations";
import {
  canAddProperty,
  canCreateTenant,
  canUploadDocument,
  canUploadPhoto,
} from "./stripe/entitlements";
import { formatBytes } from "./supabase/mappers";
import {
  getSignedUrl,
  removeFile,
  uploadPrivateFile,
} from "./supabase/storage";

/**
 * Store applicatif.
 * - Mode « live » : données de l'utilisateur connecté via Supabase (RLS).
 * - Mode « démo » (Supabase non configuré) : jeu de données fictives en mémoire.
 * Les composants consomment la même interface dans les deux cas.
 */

const EMPTY_DATA: AppData = {
  properties: [],
  tenants: [],
  rentPayments: [],
  documents: [],
  photos: [],
  works: [],
  expenses: [],
  activity: [],
};

interface AppStore {
  data: AppData;
  loading: boolean;
  error: string | null;
  /** true si les données viennent de Supabase (mode production). */
  isLive: boolean;
  profile: (UserProfile & { email: string }) | null;
  refresh: () => Promise<void>;
  /** Met à jour le profil (nom, téléphone, entreprise) et le persiste en base. */
  updateProfile: (input: ProfileInput) => Promise<void>;
  /** Synchronise localement le chemin d'avatar après une mutation réelle. */
  setAvatarPath: (path: string | null) => void;
  /** Marque l'assistant de bienvenue comme terminé (persisté). */
  completeOnboarding: () => Promise<void>;
  /** Retourne le logement créé (permet d'enchaîner photos, documents, bail). */
  addProperty: (input: PropertyInput) => Promise<Property>;
  updateProperty: (propertyId: string, input: PropertyInput) => Promise<void>;
  deleteProperty: (propertyId: string) => Promise<void>;
  addTenant: (input: TenantInput) => Promise<void>;
  /** Met à jour un locataire et son bail. */
  updateTenant: (tenantId: string, input: TenantUpdateInput) => Promise<void>;
  /** Résilie un bail : date de sortie + logement vacant. */
  endLease: (tenantId: string, exitDate: string) => Promise<void>;
  /** Supprime un bail et ses échéances. */
  deleteTenant: (tenantId: string) => Promise<void>;
  markRentPaid: (paymentId: string, amount: number) => Promise<void>;
  /** Modifie une échéance (montants, commentaire). */
  updatePayment: (paymentId: string, input: PaymentUpdateInput) => Promise<void>;
  deletePayment: (paymentId: string) => Promise<void>;
  addExpense: (input: ExpenseInput, receiptFile?: File) => Promise<void>;
  updateExpense: (expenseId: string, input: ExpenseInput, receiptFile?: File) => Promise<void>;
  deleteExpense: (expenseId: string) => Promise<void>;
  /** URL signée du justificatif d'une dépense (null si aucun). */
  getReceiptUrl: (expense: Expense) => Promise<string | null>;
  addWork: (input: Omit<Work, "id" | "invoiceDocumentId" | "photoIds">) => Promise<void>;
  updateWork: (workId: string, input: WorkUpdateInput) => Promise<void>;
  deleteWork: (workId: string) => Promise<void>;
  /** Renomme / reclasse un document, gère l'expiration. */
  updateDocument: (documentId: string, input: DocumentUpdateInput) => Promise<void>;
  addDocument: (
    input: {
      propertyId: string;
      name: string;
      category: PropertyDocument["category"];
    },
    file?: File
  ) => Promise<void>;
  /** Retourne la photo créée (URL affichable immédiatement). */
  addPhoto: (
    input: Omit<PropertyPhoto, "id" | "storagePath">,
    file?: File
  ) => Promise<PropertyPhoto>;
  deleteDocument: (documentId: string) => Promise<void>;
  deletePhoto: (photoId: string) => Promise<void>;
  /** URL signée de téléchargement d'un document (null si aucun fichier). */
  getDocumentUrl: (document: PropertyDocument) => Promise<string | null>;
}

const AppStoreContext = React.createContext<AppStore | null>(null);

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-local-${idCounter}`;
}

function activityItem(
  type: AppData["activity"][number]["type"],
  message: string,
  propertyId: string | null
): AppData["activity"][number] {
  return { id: nextId("a"), type, message, date: todayISO(), propertyId };
}

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const isLive = isSupabaseConfigured;
  const [data, setData] = React.useState<AppData>(isLive ? EMPTY_DATA : seedData);
  const [loading, setLoading] = React.useState(isLive);
  const [error, setError] = React.useState<string | null>(null);
  const [profile, setProfile] = React.useState<AppStore["profile"]>(null);
  const userIdRef = React.useRef<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!isLive) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expirée. Reconnectez-vous.");
      userIdRef.current = user.id;
      const result = await fetchAppData(supabase, user.id);
      setData(result.data);
      setProfile({
        fullName: result.profile?.fullName ?? "",
        phone: result.profile?.phone ?? "",
        plan: result.profile?.plan ?? "free",
        isFounder: result.profile?.isFounder ?? false,
        companyName: result.profile?.companyName ?? "",
        avatarPath: result.profile?.avatarPath ?? null,
        onboardingCompleted: result.profile?.onboardingCompleted ?? true,
        email: user.email ?? "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  }, [isLive]);

  React.useEffect(() => {
    // Chargement initial différé d'un tick : évite un setState synchrone dans l'effet.
    const id = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  /** Contexte (client + user id) pour les écritures en mode live. */
  const liveContext = () => {
    const userId = userIdRef.current;
    if (!userId) throw new Error("Session expirée. Reconnectez-vous.");
    return { supabase: createClient(), userId };
  };

  const updateProfile: AppStore["updateProfile"] = async (input) => {
    if (isLive) {
      const { supabase, userId } = liveContext();
      await updateProfileRow(supabase, userId, input);
    }
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            fullName: input.fullName,
            phone: input.phone,
            companyName: input.companyName,
          }
        : prev
    );
  };

  /** Mise à jour locale du chemin d'avatar (après upload/suppression réels). */
  const setAvatarPath = (path: string | null) => {
    setProfile((prev) => (prev ? { ...prev, avatarPath: path } : prev));
  };

  /** Marque l'assistant de bienvenue comme terminé (persisté en base). */
  const completeOnboarding: AppStore["completeOnboarding"] = async () => {
    if (isLive) {
      const { supabase, userId } = liveContext();
      const { error } = await supabase
        .from("profiles")
        .update({
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq("id", userId);
      if (error) throw new Error(error.message);
    }
    setProfile((prev) => (prev ? { ...prev, onboardingCompleted: true } : prev));
  };

  const addProperty: AppStore["addProperty"] = async (input) => {
    let property: Property;
    if (isLive) {
      // Limite du plan (le trigger en base applique la même règle côté serveur).
      const entitlement = canAddProperty(profile?.plan, data.properties.length);
      if (!entitlement.allowed) throw new Error(entitlement.reason ?? "Limite atteinte.");
      const { supabase, userId } = liveContext();
      property = await insertProperty(supabase, userId, input);
    } else {
      property = {
        ...input,
        type: input.type as Property["type"],
        status: input.status as Property["status"],
        id: nextId("p"),
        photo: input.photo || DEFAULT_PROPERTY_PHOTO,
        currentTenantId: null,
      };
    }
    setData((prev) => ({
      ...prev,
      properties: [...prev.properties, property],
      activity: [
        activityItem("logement", `Nouveau logement ajouté : ${property.name}`, property.id),
        ...prev.activity,
      ],
    }));
    return property;
  };

  const updateProperty: AppStore["updateProperty"] = async (propertyId, input) => {
    let updated: Property | null = null;
    if (isLive) {
      const { supabase, userId } = liveContext();
      const current = data.properties.find((p) => p.id === propertyId);
      updated = await updatePropertyRow(
        supabase,
        userId,
        propertyId,
        input,
        current?.currentTenantId ?? null
      );
    }
    setData((prev) => ({
      ...prev,
      properties: prev.properties.map((p) =>
        p.id === propertyId
          ? (updated ?? {
              ...p,
              ...input,
              type: input.type as Property["type"],
              status: input.status as Property["status"],
              photo: input.photo || p.photo,
            })
          : p
      ),
      activity: [
        activityItem("logement", `Logement modifié : ${input.name}`, propertyId),
        ...prev.activity,
      ],
    }));
  };

  const deleteProperty: AppStore["deleteProperty"] = async (propertyId) => {
    if (isLive) {
      const { supabase } = liveContext();
      // Chemins Storage relevés AVANT la suppression (les lignes cascadent).
      const documentPaths = data.documents
        .filter((d) => d.propertyId === propertyId && d.filePath)
        .map((d) => d.filePath as string);
      const photoPaths = data.photos
        .filter((p) => p.propertyId === propertyId && p.storagePath)
        .map((p) => p.storagePath as string);
      const receiptPaths = data.expenses
        .filter((e) => e.propertyId === propertyId && e.receiptPath)
        .map((e) => e.receiptPath as string);
      await deletePropertyRow(supabase, propertyId);
      // Les lignes sont supprimées : un échec Storage laisse au pire un orphelin.
      const results = await Promise.allSettled([
        ...documentPaths.map((p) => removeFile(supabase, "property-documents", p)),
        ...photoPaths.map((p) => removeFile(supabase, "property-photos", p)),
        ...receiptPaths.map((p) => removeFile(supabase, "expense-receipts", p)),
      ]);
      for (const result of results) {
        if (result.status === "rejected") {
          console.warn("Fichier non supprimé :", result.reason);
        }
      }
    }
    // Les suppressions en cascade (baux, loyers, dépenses…) sont répercutées localement.
    setData((prev) => {
      const leaseIds = new Set(
        prev.tenants.filter((t) => t.propertyId === propertyId).map((t) => t.id)
      );
      return {
        ...prev,
        properties: prev.properties.filter((p) => p.id !== propertyId),
        tenants: prev.tenants.filter((t) => t.propertyId !== propertyId),
        rentPayments: prev.rentPayments.filter(
          (p) => p.propertyId !== propertyId && !leaseIds.has(p.tenantId)
        ),
        expenses: prev.expenses.filter((e) => e.propertyId !== propertyId),
        documents: prev.documents.filter((d) => d.propertyId !== propertyId),
        photos: prev.photos.filter((p) => p.propertyId !== propertyId),
        works: prev.works.filter((w) => w.propertyId !== propertyId),
        activity: prev.activity.filter((a) => a.propertyId !== propertyId),
      };
    });
  };

  const addTenant: AppStore["addTenant"] = async (input) => {
    let tenant: Tenant;
    if (isLive) {
      // Limite du plan (le trigger en base applique la même règle côté serveur).
      const activeCount = data.tenants.filter((t) => !t.exitDate).length;
      const entitlement = canCreateTenant(profile?.plan, activeCount);
      if (!entitlement.allowed) throw new Error(entitlement.reason ?? "Limite atteinte.");
      const { supabase, userId } = liveContext();
      tenant = await insertTenantWithLease(supabase, userId, input);
    } else {
      tenant = { ...input, exitDate: null, id: nextId("t") };
    }
    setData((prev) => ({
      ...prev,
      tenants: [...prev.tenants, tenant],
      properties: prev.properties.map((p) =>
        p.id === tenant.propertyId
          ? { ...p, status: "loue" as const, currentTenantId: tenant.id }
          : p
      ),
      activity: [
        activityItem("locataire", `Nouveau locataire : ${tenantFullName(tenant)}`, tenant.propertyId),
        ...prev.activity,
      ],
    }));
  };

  const markRentPaid: AppStore["markRentPaid"] = async (paymentId, amount) => {
    const payment = data.rentPayments.find((p) => p.id === paymentId);
    if (!payment) throw new Error("Paiement introuvable.");

    let patch: Pick<RentPayment, "received" | "paidAt" | "status">;
    if (isLive) {
      const { supabase } = liveContext();
      patch = await recordPayment(supabase, payment, amount);
    } else {
      const received = payment.received + amount;
      patch = {
        received,
        paidAt: todayISO(),
        status: received >= payment.expected ? "paye" : "partiel",
      };
    }
    const property = data.properties.find((p) => p.id === payment.propertyId);
    setData((prev) => ({
      ...prev,
      rentPayments: prev.rentPayments.map((p) =>
        p.id === paymentId ? { ...p, ...patch } : p
      ),
      activity: [
        activityItem(
          "paiement",
          `Paiement enregistré${property ? ` — ${property.name}` : ""}`,
          payment.propertyId
        ),
        ...prev.activity,
      ],
    }));
  };

  const updateTenant: AppStore["updateTenant"] = async (tenantId, input) => {
    let updated: Tenant | null = null;
    if (isLive) {
      const { supabase } = liveContext();
      updated = await updateTenantLease(supabase, tenantId, input);
    }
    const propertyId =
      data.tenants.find((t) => t.id === tenantId)?.propertyId ?? null;
    setData((prev) => ({
      ...prev,
      tenants: prev.tenants.map((t) =>
        t.id === tenantId ? (updated ?? { ...t, ...input }) : t
      ),
      activity: [
        activityItem(
          "locataire",
          `Locataire mis à jour : ${input.firstName} ${input.lastName}`,
          propertyId
        ),
        ...prev.activity,
      ],
    }));
  };

  const endLease: AppStore["endLease"] = async (tenantId, exitDate) => {
    const tenant = data.tenants.find((t) => t.id === tenantId);
    if (!tenant) throw new Error("Bail introuvable.");
    if (isLive) {
      const { supabase } = liveContext();
      await endLeaseRow(supabase, tenantId, exitDate);
    }
    setData((prev) => ({
      ...prev,
      tenants: prev.tenants.map((t) =>
        t.id === tenantId ? { ...t, exitDate } : t
      ),
      properties: prev.properties.map((p) =>
        p.id === tenant.propertyId
          ? {
              ...p,
              status: "vacant" as const,
              currentTenantId:
                p.currentTenantId === tenantId ? null : p.currentTenantId,
            }
          : p
      ),
      activity: [
        activityItem(
          "locataire",
          `Bail terminé : ${tenantFullName(tenant)}`,
          tenant.propertyId
        ),
        ...prev.activity,
      ],
    }));
  };

  const deleteTenant: AppStore["deleteTenant"] = async (tenantId) => {
    const tenant = data.tenants.find((t) => t.id === tenantId);
    if (!tenant) return;
    if (isLive) {
      const { supabase } = liveContext();
      await deleteLeaseRow(supabase, tenantId);
    }
    setData((prev) => ({
      ...prev,
      tenants: prev.tenants.filter((t) => t.id !== tenantId),
      rentPayments: prev.rentPayments.filter((p) => p.tenantId !== tenantId),
      properties: prev.properties.map((p) =>
        p.currentTenantId === tenantId
          ? { ...p, currentTenantId: null, status: "vacant" as const }
          : p
      ),
      activity: [
        activityItem(
          "locataire",
          `Bail supprimé : ${tenantFullName(tenant)}`,
          tenant.propertyId
        ),
        ...prev.activity,
      ],
    }));
  };

  const updatePayment: AppStore["updatePayment"] = async (paymentId, input) => {
    const payment = data.rentPayments.find((p) => p.id === paymentId);
    if (!payment) throw new Error("Paiement introuvable.");

    let patch: Pick<
      RentPayment,
      "expected" | "received" | "paidAt" | "status" | "comment"
    >;
    if (isLive) {
      const { supabase } = liveContext();
      patch = await updatePaymentRow(supabase, payment, input);
    } else {
      const isCurrentOrFuture = payment.month >= todayISO().slice(0, 7);
      const status: RentPayment["status"] =
        input.received >= input.expected && input.expected > 0
          ? "paye"
          : input.received > 0
            ? "partiel"
            : isCurrentOrFuture
              ? "attente"
              : "retard";
      patch = {
        ...input,
        paidAt: input.received > 0 ? (payment.paidAt ?? todayISO()) : null,
        status,
      };
    }
    setData((prev) => ({
      ...prev,
      rentPayments: prev.rentPayments.map((p) =>
        p.id === paymentId ? { ...p, ...patch } : p
      ),
    }));
  };

  const deletePayment: AppStore["deletePayment"] = async (paymentId) => {
    if (isLive) {
      const { supabase } = liveContext();
      await deletePaymentRow(supabase, paymentId);
    }
    setData((prev) => ({
      ...prev,
      rentPayments: prev.rentPayments.filter((p) => p.id !== paymentId),
    }));
  };

  const addExpense: AppStore["addExpense"] = async (input, receiptFile) => {
    let expense: Expense;
    if (isLive) {
      const { supabase, userId } = liveContext();
      let receiptPath: string | null = null;
      if (receiptFile) {
        const uploaded = await uploadPrivateFile(
          supabase,
          "expense-receipts",
          userId,
          input.propertyId,
          receiptFile
        );
        receiptPath = uploaded.path;
      }
      expense = await insertExpense(supabase, userId, { ...input, receiptPath });
    } else {
      expense = {
        ...input,
        category: input.category as Expense["category"],
        id: nextId("e"),
        receiptPath: null,
        maintenanceRecordId: null,
      };
    }
    const property = data.properties.find((p) => p.id === input.propertyId);
    setData((prev) => ({
      ...prev,
      expenses: [expense, ...prev.expenses],
      activity: [
        activityItem(
          "travaux",
          `Dépense ajoutée${property ? ` — ${property.name}` : ""} : ${expense.label}`,
          expense.propertyId
        ),
        ...prev.activity,
      ],
    }));
  };

  const updateExpense: AppStore["updateExpense"] = async (
    expenseId,
    input,
    receiptFile
  ) => {
    const current = data.expenses.find((e) => e.id === expenseId);
    let expense: Expense | null = null;
    if (isLive) {
      const { supabase, userId } = liveContext();
      let receiptPath: string | null | undefined;
      if (receiptFile) {
        const uploaded = await uploadPrivateFile(
          supabase,
          "expense-receipts",
          userId,
          input.propertyId,
          receiptFile
        );
        receiptPath = uploaded.path;
        if (current?.receiptPath) {
          await removeFile(supabase, "expense-receipts", current.receiptPath).catch(
            (e) => console.warn("Justificatif non supprimé :", e)
          );
        }
      }
      expense = await updateExpenseRow(supabase, expenseId, {
        ...input,
        receiptPath,
      });
    }
    setData((prev) => ({
      ...prev,
      expenses: prev.expenses.map((e) =>
        e.id === expenseId
          ? (expense ?? {
              ...e,
              ...input,
              category: input.category as Expense["category"],
            })
          : e
      ),
    }));
  };

  const deleteExpense: AppStore["deleteExpense"] = async (expenseId) => {
    const expense = data.expenses.find((e) => e.id === expenseId);
    if (!expense) return;
    if (isLive) {
      const { supabase } = liveContext();
      await deleteExpenseRow(supabase, expenseId);
      if (expense.receiptPath) {
        await removeFile(supabase, "expense-receipts", expense.receiptPath).catch(
          (e) => console.warn("Justificatif non supprimé :", e)
        );
      }
    }
    setData((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((e) => e.id !== expenseId),
    }));
  };

  const getReceiptUrl: AppStore["getReceiptUrl"] = async (expense) => {
    if (!isLive || !expense.receiptPath) return null;
    const { supabase } = liveContext();
    return getSignedUrl(supabase, "expense-receipts", expense.receiptPath);
  };

  const updateWork: AppStore["updateWork"] = async (workId, input) => {
    const current = data.works.find((w) => w.id === workId);
    let updated: Work | null = null;
    if (isLive) {
      const { supabase } = liveContext();
      updated = await updateWorkRow(supabase, workId, input);
    }
    setData((prev) => ({
      ...prev,
      works: prev.works.map((w) =>
        w.id === workId
          ? {
              ...w,
              ...(updated ?? {
                ...input,
                status: input.status as Work["status"],
              }),
              // Liens conservés (facture, photos).
              invoiceDocumentId: w.invoiceDocumentId,
              photoIds: w.photoIds,
            }
          : w
      ),
      // La dépense liée au chantier reste synchronisée.
      expenses: prev.expenses.map((e) =>
        e.maintenanceRecordId === workId
          ? {
              ...e,
              label: input.title,
              amount: input.actualCost ?? input.amount,
              date: input.date,
            }
          : e
      ),
      activity: [
        activityItem(
          "travaux",
          `Travaux mis à jour : ${input.title}`,
          current?.propertyId ?? null
        ),
        ...prev.activity,
      ],
    }));
  };

  const deleteWork: AppStore["deleteWork"] = async (workId) => {
    if (isLive) {
      const { supabase } = liveContext();
      // Justificatifs des dépenses liées (supprimées avec le chantier).
      const receiptPaths = data.expenses
        .filter((e) => e.maintenanceRecordId === workId && e.receiptPath)
        .map((e) => e.receiptPath as string);
      await deleteWorkRow(supabase, workId);
      for (const path of receiptPaths) {
        await removeFile(supabase, "expense-receipts", path).catch((e) =>
          console.warn("Justificatif non supprimé :", e)
        );
      }
    }
    setData((prev) => ({
      ...prev,
      works: prev.works.filter((w) => w.id !== workId),
      expenses: prev.expenses.filter((e) => e.maintenanceRecordId !== workId),
    }));
  };

  const updateDocument: AppStore["updateDocument"] = async (documentId, input) => {
    let updated: PropertyDocument | null = null;
    if (isLive) {
      const { supabase } = liveContext();
      updated = await updateDocumentRow(supabase, documentId, input);
    }
    setData((prev) => ({
      ...prev,
      documents: prev.documents.map((d) =>
        d.id === documentId
          ? (updated ?? {
              ...d,
              name: input.name,
              category: input.category as PropertyDocument["category"],
              expiresAt: input.expiresAt,
            })
          : d
      ),
    }));
  };

  const addWork: AppStore["addWork"] = async (input) => {
    let work: Work;
    let expense: AppData["expenses"][number];
    if (isLive) {
      const { supabase, userId } = liveContext();
      ({ work, expense } = await insertWork(supabase, userId, input));
    } else {
      work = { ...input, id: nextId("w"), invoiceDocumentId: null, photoIds: [] };
      expense = {
        id: nextId("e"),
        propertyId: input.propertyId,
        label: input.title,
        category: "travaux",
        amount: input.amount,
        date: input.date,
      };
    }
    const property = data.properties.find((p) => p.id === input.propertyId);
    setData((prev) => ({
      ...prev,
      works: [work, ...prev.works],
      expenses: [expense, ...prev.expenses],
      activity: [
        activityItem(
          "travaux",
          `Travaux ajoutés${property ? ` — ${property.name}` : ""} : ${work.title}`,
          work.propertyId
        ),
        ...prev.activity,
      ],
    }));
  };

  const fileTypeOf = (ext: string): PropertyDocument["fileType"] =>
    (["pdf", "jpg", "png", "docx"] as const).find((t) => t === ext) ?? "pdf";

  const addDocument: AppStore["addDocument"] = async (input, file) => {
    let document: PropertyDocument;
    if (isLive) {
      // Vérifié AVANT l'upload (le trigger en base bloque aussi l'insertion).
      const entitlement = canUploadDocument(profile?.plan, data.documents.length);
      if (!entitlement.allowed) throw new Error(entitlement.reason ?? "Limite atteinte.");
      const { supabase, userId } = liveContext();
      let fileMeta: Partial<Parameters<typeof insertDocument>[2]> = {};
      if (file) {
        const uploaded = await uploadPrivateFile(
          supabase,
          "property-documents",
          userId,
          input.propertyId,
          file
        );
        fileMeta = {
          filePath: uploaded.path,
          sizeBytes: uploaded.sizeBytes,
          fileType: fileTypeOf(uploaded.ext),
        };
      }
      document = await insertDocument(supabase, userId, { ...input, ...fileMeta });
    } else {
      document = {
        ...input,
        id: nextId("d"),
        addedAt: todayISO(),
        size: file ? formatBytes(file.size) : "—",
        fileType: file ? fileTypeOf(file.name.split(".").pop() ?? "") : "pdf",
        filePath: null,
      };
    }
    setData((prev) => ({
      ...prev,
      documents: [document, ...prev.documents],
      activity: [
        activityItem("document", `Document ajouté : ${document.name}`, document.propertyId),
        ...prev.activity,
      ],
    }));
  };

  const addPhoto: AppStore["addPhoto"] = async (input, file) => {
    let photo: PropertyPhoto;
    if (isLive) {
      // Vérifié AVANT l'upload (le trigger en base bloque aussi l'insertion).
      const entitlement = canUploadPhoto(profile?.plan, data.photos.length);
      if (!entitlement.allowed) throw new Error(entitlement.reason ?? "Limite atteinte.");
      const { supabase, userId } = liveContext();
      if (file) {
        const uploaded = await uploadPrivateFile(
          supabase,
          "property-photos",
          userId,
          input.propertyId,
          file
        );
        const inserted = await insertPhoto(supabase, userId, {
          ...input,
          filePath: uploaded.path,
        });
        // URL signée immédiate pour l'affichage sans rechargement.
        const signedUrl = await getSignedUrl(supabase, "property-photos", uploaded.path);
        photo = { ...inserted, url: signedUrl };
      } else {
        photo = await insertPhoto(supabase, userId, { ...input, filePath: input.url });
      }
    } else {
      photo = {
        ...input,
        // En démo, un fichier local est affiché via une URL objet (non persistée).
        url: file ? URL.createObjectURL(file) : input.url,
        id: nextId("ph"),
        storagePath: null,
      };
    }
    setData((prev) => ({ ...prev, photos: [photo, ...prev.photos] }));
    return photo;
  };

  const deleteDocument: AppStore["deleteDocument"] = async (documentId) => {
    const document = data.documents.find((d) => d.id === documentId);
    if (!document) return;
    if (isLive) {
      const { supabase } = liveContext();
      await deleteDocumentRow(supabase, documentId);
      if (document.filePath) {
        // La ligne est supprimée : un échec Storage laisse au pire un orphelin.
        await removeFile(supabase, "property-documents", document.filePath).catch(
          (e) => console.warn("Fichier non supprimé :", e)
        );
      }
    }
    setData((prev) => ({
      ...prev,
      documents: prev.documents.filter((d) => d.id !== documentId),
    }));
  };

  const deletePhoto: AppStore["deletePhoto"] = async (photoId) => {
    const photo = data.photos.find((p) => p.id === photoId);
    if (!photo) return;
    if (isLive) {
      const { supabase } = liveContext();
      await deletePhotoRow(supabase, photoId);
      if (photo.storagePath) {
        await removeFile(supabase, "property-photos", photo.storagePath).catch((e) =>
          console.warn("Fichier non supprimé :", e)
        );
      }
    }
    setData((prev) => ({
      ...prev,
      photos: prev.photos.filter((p) => p.id !== photoId),
    }));
  };

  const getDocumentUrl: AppStore["getDocumentUrl"] = async (document) => {
    if (!isLive || !document.filePath) return null;
    const { supabase } = liveContext();
    return getSignedUrl(supabase, "property-documents", document.filePath);
  };

  const store: AppStore = {
    data,
    loading,
    error,
    isLive,
    profile,
    refresh,
    updateProfile,
    setAvatarPath,
    completeOnboarding,
    addProperty,
    updateProperty,
    deleteProperty,
    addTenant,
    updateTenant,
    endLease,
    deleteTenant,
    markRentPaid,
    updatePayment,
    deletePayment,
    addExpense,
    updateExpense,
    deleteExpense,
    getReceiptUrl,
    addWork,
    updateWork,
    deleteWork,
    updateDocument,
    addDocument,
    addPhoto,
    deleteDocument,
    deletePhoto,
    getDocumentUrl,
  };

  return (
    <AppStoreContext.Provider value={store}>{children}</AppStoreContext.Provider>
  );
}

export function useAppStore(): AppStore {
  const store = React.useContext(AppStoreContext);
  if (!store) {
    throw new Error("useAppStore doit être utilisé dans <AppStoreProvider>.");
  }
  return store;
}
