import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Expense,
  Property,
  PropertyDocument,
  PropertyPhoto,
  RentPayment,
  Tenant,
  Work,
} from "@/lib/types";
import {
  mapDocument,
  mapExpense,
  mapLeaseToTenant,
  mapPhoto,
  mapProperty,
  mapWork,
  type DocumentRow,
  type ExpenseRow,
  type LeaseRow,
  type MaintenanceRow,
  type PhotoRow,
  type PropertyRow,
} from "./mappers";

/**
 * Écritures Supabase. Chaque fonction insère/modifie puis retourne
 * l'entité mappée vers le type métier, pour mise à jour locale du store.
 * La RLS vérifie côté serveur que owner_id = utilisateur connecté.
 */

export interface ProfileInput {
  fullName: string;
  phone: string;
  companyName: string;
}

/** Met à jour le profil (nom, téléphone, entreprise) de l'utilisateur connecté. */
export async function updateProfileRow(
  supabase: SupabaseClient,
  ownerId: string,
  input: ProfileInput
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: input.fullName,
      phone: input.phone,
      company_name: input.companyName || null,
    })
    .eq("id", ownerId);
  if (error) throw new Error(error.message);
}

export interface PropertyInput {
  name: string;
  address: string;
  postalCode: string;
  city: string;
  type: string;
  surface: number;
  rooms: number;
  purchasePrice: number;
  purchaseDate: string;
  rent: number;
  charges: number;
  status: string;
  photo?: string;
}

function propertyPayload(input: PropertyInput, ownerId: string) {
  return {
    owner_id: ownerId,
    name: input.name,
    address: input.address,
    postal_code: input.postalCode,
    city: input.city,
    type: input.type,
    surface: input.surface,
    rooms: input.rooms,
    photo_url: input.photo || null,
    purchase_price: input.purchasePrice,
    purchase_date: input.purchaseDate,
    rent: input.rent,
    charges: input.charges,
    status: input.status,
  };
}

export async function insertProperty(
  supabase: SupabaseClient,
  ownerId: string,
  input: PropertyInput
): Promise<Property> {
  const { data, error } = await supabase
    .from("properties")
    .insert(propertyPayload(input, ownerId))
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapProperty(data as PropertyRow, null);
}

export async function updatePropertyRow(
  supabase: SupabaseClient,
  ownerId: string,
  propertyId: string,
  input: PropertyInput,
  activeLeaseId: string | null
): Promise<Property> {
  // owner_id ne change jamais lors d'une mise à jour.
  const payload: Partial<ReturnType<typeof propertyPayload>> = propertyPayload(input, ownerId);
  delete payload.owner_id;
  const { data, error } = await supabase
    .from("properties")
    .update(payload)
    .eq("id", propertyId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapProperty(data as PropertyRow, activeLeaseId);
}

export async function deletePropertyRow(
  supabase: SupabaseClient,
  propertyId: string
): Promise<void> {
  // Locataires du bien relevés AVANT la cascade des baux.
  const { data: leases, error: leasesError } = await supabase
    .from("leases")
    .select("tenant_id")
    .eq("property_id", propertyId);
  if (leasesError) throw new Error(leasesError.message);
  const tenantIds = [...new Set((leases ?? []).map((l) => l.tenant_id as string))];

  const { error } = await supabase.from("properties").delete().eq("id", propertyId);
  if (error) throw new Error(error.message);

  // Fiches locataires sans plus aucun bail : supprimées (pas d'orphelin).
  if (tenantIds.length > 0) {
    const { data: remaining, error: remainingError } = await supabase
      .from("leases")
      .select("tenant_id")
      .in("tenant_id", tenantIds);
    if (remainingError) throw new Error(remainingError.message);
    const kept = new Set((remaining ?? []).map((l) => l.tenant_id as string));
    const orphanIds = tenantIds.filter((id) => !kept.has(id));
    if (orphanIds.length > 0) {
      const { error: tenantsError } = await supabase
        .from("tenants")
        .delete()
        .in("id", orphanIds);
      if (tenantsError) throw new Error(tenantsError.message);
    }
  }
}

export interface TenantInput {
  propertyId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  entryDate: string;
  rent: number;
  charges: number;
  deposit: number;
}

/** Crée le locataire + son bail, et passe le logement en « loué ». */
export async function insertTenantWithLease(
  supabase: SupabaseClient,
  ownerId: string,
  input: TenantInput
): Promise<Tenant> {
  const { data: tenantRow, error: tenantError } = await supabase
    .from("tenants")
    .insert({
      owner_id: ownerId,
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone,
    })
    .select("id")
    .single();
  if (tenantError) throw new Error(tenantError.message);

  const { data: leaseRow, error: leaseError } = await supabase
    .from("leases")
    .insert({
      owner_id: ownerId,
      property_id: input.propertyId,
      tenant_id: tenantRow.id,
      entry_date: input.entryDate,
      rent: input.rent,
      charges: input.charges,
      deposit: input.deposit,
    })
    .select(
      "id, property_id, entry_date, exit_date, rent, charges, deposit, tenants (first_name, last_name, email, phone)"
    )
    .single();
  if (leaseError) throw new Error(leaseError.message);

  const { error: statusError } = await supabase
    .from("properties")
    .update({ status: "loue" })
    .eq("id", input.propertyId);
  if (statusError) throw new Error(statusError.message);

  return mapLeaseToTenant(leaseRow as unknown as LeaseRow);
}

export interface TenantUpdateInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  entryDate: string;
  rent: number;
  charges: number;
  deposit: number;
}

/** Met à jour le locataire et les conditions de son bail. */
export async function updateTenantLease(
  supabase: SupabaseClient,
  leaseId: string,
  input: TenantUpdateInput
): Promise<Tenant> {
  const { data: lease, error: leaseError } = await supabase
    .from("leases")
    .select("tenant_id")
    .eq("id", leaseId)
    .single();
  if (leaseError) throw new Error(leaseError.message);

  const { error: tenantError } = await supabase
    .from("tenants")
    .update({
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone,
    })
    .eq("id", lease.tenant_id);
  if (tenantError) throw new Error(tenantError.message);

  const { data: updated, error: updateError } = await supabase
    .from("leases")
    .update({
      entry_date: input.entryDate,
      rent: input.rent,
      charges: input.charges,
      deposit: input.deposit,
    })
    .eq("id", leaseId)
    .select(
      "id, property_id, entry_date, exit_date, rent, charges, deposit, tenants (first_name, last_name, email, phone)"
    )
    .single();
  if (updateError) throw new Error(updateError.message);
  return mapLeaseToTenant(updated as unknown as LeaseRow);
}

/** Résilie un bail : date de sortie + logement repassé en « vacant ». */
export async function endLeaseRow(
  supabase: SupabaseClient,
  leaseId: string,
  exitDate: string
): Promise<void> {
  const { data: lease, error: leaseError } = await supabase
    .from("leases")
    .update({ exit_date: exitDate })
    .eq("id", leaseId)
    .select("property_id")
    .single();
  if (leaseError) throw new Error(leaseError.message);

  const { error: statusError } = await supabase
    .from("properties")
    .update({ status: "vacant" })
    .eq("id", lease.property_id);
  if (statusError) throw new Error(statusError.message);
}

/** Supprime un bail (et ses échéances, en cascade). */
export async function deleteLeaseRow(
  supabase: SupabaseClient,
  leaseId: string
): Promise<void> {
  const { data: lease, error } = await supabase
    .from("leases")
    .delete()
    .eq("id", leaseId)
    .select("property_id, tenant_id, exit_date")
    .single();
  if (error) throw new Error(error.message);

  // Bail encore actif : le logement redevient vacant en base.
  if (lease.exit_date === null) {
    const { error: statusError } = await supabase
      .from("properties")
      .update({ status: "vacant" })
      .eq("id", lease.property_id);
    if (statusError) throw new Error(statusError.message);
  }

  // Locataire sans plus aucun bail : la fiche est supprimée (pas d'orphelin).
  const { count, error: countError } = await supabase
    .from("leases")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", lease.tenant_id);
  if (countError) throw new Error(countError.message);
  if ((count ?? 0) === 0) {
    const { error: tenantError } = await supabase
      .from("tenants")
      .delete()
      .eq("id", lease.tenant_id);
    if (tenantError) throw new Error(tenantError.message);
  }
}

/**
 * Génère les échéances manquantes des baux actifs (idempotent grâce à la
 * contrainte unique lease_id + month), puis marque en retard les mois
 * passés restés sans paiement.
 */
export async function ensureRentSchedule(
  supabase: SupabaseClient,
  ownerId: string,
  leases: {
    id: string;
    entryDate: string;
    exitDate: string | null;
    rent: number;
    charges: number;
  }[]
): Promise<void> {
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const rows: {
    owner_id: string;
    lease_id: string;
    month: string;
    expected: number;
  }[] = [];

  for (const lease of leases) {
    if (lease.exitDate !== null) continue;
    let cursor = lease.entryDate.slice(0, 7);
    // Garde-fou : jamais plus de 10 ans d'échéances.
    for (let i = 0; i < 120 && cursor <= currentMonth; i += 1) {
      rows.push({
        owner_id: ownerId,
        lease_id: lease.id,
        month: `${cursor}-01`,
        expected: lease.rent + lease.charges,
      });
      const [y, m] = cursor.split("-").map(Number);
      const next = new Date(y, m, 1);
      cursor = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
    }
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from("rent_payments")
      .upsert(rows, { onConflict: "lease_id,month", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  // Mois passés jamais encaissés → retard.
  const { error: lateError } = await supabase
    .from("rent_payments")
    .update({ status: "retard" })
    .eq("status", "attente")
    .eq("received", 0)
    .lt("month", `${currentMonth}-01`);
  if (lateError) throw new Error(lateError.message);
}

export interface PaymentUpdateInput {
  expected: number;
  received: number;
  comment: string;
}

/** Met à jour une échéance (montants, commentaire) et recalcule son statut. */
export async function updatePaymentRow(
  supabase: SupabaseClient,
  payment: RentPayment,
  input: PaymentUpdateInput
): Promise<Pick<RentPayment, "expected" | "received" | "paidAt" | "status" | "comment">> {
  const isCurrentOrFuture =
    payment.month >= new Date().toISOString().slice(0, 7);
  const status =
    input.received >= input.expected && input.expected > 0
      ? "paye"
      : input.received > 0
        ? "partiel"
        : isCurrentOrFuture
          ? "attente"
          : "retard";
  const paidAt =
    input.received > 0
      ? (payment.paidAt ?? new Date().toISOString().slice(0, 10))
      : null;
  const { error } = await supabase
    .from("rent_payments")
    .update({
      expected: input.expected,
      received: input.received,
      comment: input.comment,
      status,
      paid_at: paidAt,
    })
    .eq("id", payment.id);
  if (error) throw new Error(error.message);
  return { ...input, paidAt, status };
}

export async function deletePaymentRow(
  supabase: SupabaseClient,
  paymentId: string
): Promise<void> {
  const { error } = await supabase.from("rent_payments").delete().eq("id", paymentId);
  if (error) throw new Error(error.message);
}

export interface ExpenseInput {
  propertyId: string;
  label: string;
  category: string;
  amount: number;
  date: string;
  supplier: string;
  receiptPath?: string | null;
}

export async function insertExpense(
  supabase: SupabaseClient,
  ownerId: string,
  input: ExpenseInput
): Promise<Expense> {
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      owner_id: ownerId,
      property_id: input.propertyId,
      label: input.label,
      category: input.category,
      amount: input.amount,
      date: input.date,
      supplier: input.supplier,
      receipt_path: input.receiptPath ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapExpense(data as ExpenseRow);
}

export async function updateExpenseRow(
  supabase: SupabaseClient,
  expenseId: string,
  input: ExpenseInput
): Promise<Expense> {
  const payload: Record<string, unknown> = {
    property_id: input.propertyId,
    label: input.label,
    category: input.category,
    amount: input.amount,
    date: input.date,
    supplier: input.supplier,
  };
  if (input.receiptPath !== undefined) payload.receipt_path = input.receiptPath;
  const { data, error } = await supabase
    .from("expenses")
    .update(payload)
    .eq("id", expenseId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapExpense(data as ExpenseRow);
}

export async function deleteExpenseRow(
  supabase: SupabaseClient,
  expenseId: string
): Promise<void> {
  const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
  if (error) throw new Error(error.message);
}

export interface WorkUpdateInput {
  title: string;
  company: string;
  amount: number;
  date: string;
  status: string;
  actualCost: number | null;
  progress: number | null;
  endDate: string | null;
}

/** Met à jour un chantier et synchronise la dépense liée. */
export async function updateWorkRow(
  supabase: SupabaseClient,
  workId: string,
  input: WorkUpdateInput
): Promise<Work> {
  const { data, error } = await supabase
    .from("maintenance_records")
    .update({
      title: input.title,
      company: input.company,
      amount: input.amount,
      date: input.date,
      status: input.status,
      actual_cost: input.actualCost,
      progress: input.progress,
      end_date: input.endDate,
    })
    .eq("id", workId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  // La dépense liée reflète le coût réel s'il est connu, sinon le budget.
  const { error: expenseError } = await supabase
    .from("expenses")
    .update({
      label: input.title,
      amount: input.actualCost ?? input.amount,
      date: input.date,
    })
    .eq("maintenance_record_id", workId);
  if (expenseError) throw new Error(expenseError.message);

  return mapWork(data as MaintenanceRow, []);
}

/** Supprime un chantier et sa dépense associée. */
export async function deleteWorkRow(
  supabase: SupabaseClient,
  workId: string
): Promise<void> {
  const { error: expenseError } = await supabase
    .from("expenses")
    .delete()
    .eq("maintenance_record_id", workId);
  if (expenseError) throw new Error(expenseError.message);
  const { error } = await supabase
    .from("maintenance_records")
    .delete()
    .eq("id", workId);
  if (error) throw new Error(error.message);
}

export interface DocumentUpdateInput {
  name: string;
  category: string;
  expiresAt: string | null;
}

/** Renomme / reclasse un document et gère sa date d'expiration. */
export async function updateDocumentRow(
  supabase: SupabaseClient,
  documentId: string,
  input: DocumentUpdateInput
): Promise<PropertyDocument> {
  const { data, error } = await supabase
    .from("documents")
    .update({
      name: input.name,
      category: input.category,
      expires_at: input.expiresAt,
    })
    .eq("id", documentId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapDocument(data as DocumentRow);
}

/** Enregistre un encaissement (total ou partiel) sur un paiement existant. */
export async function recordPayment(
  supabase: SupabaseClient,
  payment: RentPayment,
  amount: number
): Promise<{ received: number; paidAt: string; status: RentPayment["status"] }> {
  const received = payment.received + amount;
  const paidAt = new Date().toISOString().slice(0, 10);
  const status = received >= payment.expected ? "paye" : "partiel";
  const { error } = await supabase
    .from("rent_payments")
    .update({ received, paid_at: paidAt, status })
    .eq("id", payment.id);
  if (error) throw new Error(error.message);
  return { received, paidAt, status };
}

export interface WorkInput {
  propertyId: string;
  title: string;
  company: string;
  amount: number;
  date: string;
  status: string;
}

/** Crée les travaux + la dépense associée. */
export async function insertWork(
  supabase: SupabaseClient,
  ownerId: string,
  input: WorkInput
): Promise<{ work: Work; expense: Expense }> {
  const { data: workRow, error: workError } = await supabase
    .from("maintenance_records")
    .insert({
      owner_id: ownerId,
      property_id: input.propertyId,
      title: input.title,
      company: input.company,
      amount: input.amount,
      date: input.date,
      status: input.status,
    })
    .select("*")
    .single();
  if (workError) throw new Error(workError.message);

  const { data: expenseRow, error: expenseError } = await supabase
    .from("expenses")
    .insert({
      owner_id: ownerId,
      property_id: input.propertyId,
      label: input.title,
      category: "travaux",
      amount: input.amount,
      date: input.date,
      maintenance_record_id: workRow.id,
    })
    .select("*")
    .single();
  if (expenseError) throw new Error(expenseError.message);

  return {
    work: mapWork(workRow as MaintenanceRow, []),
    expense: mapExpense(expenseRow as ExpenseRow),
  };
}

export interface DocumentInput {
  propertyId: string;
  name: string;
  category: string;
  filePath?: string | null;
  sizeBytes?: number | null;
  fileType?: string;
}

export async function insertDocument(
  supabase: SupabaseClient,
  ownerId: string,
  input: DocumentInput
): Promise<PropertyDocument> {
  const { data, error } = await supabase
    .from("documents")
    .insert({
      owner_id: ownerId,
      property_id: input.propertyId,
      name: input.name,
      category: input.category,
      file_path: input.filePath ?? null,
      size_bytes: input.sizeBytes ?? null,
      file_type: input.fileType ?? "pdf",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapDocument(data as DocumentRow);
}

export async function deleteDocumentRow(
  supabase: SupabaseClient,
  documentId: string
): Promise<void> {
  const { error } = await supabase.from("documents").delete().eq("id", documentId);
  if (error) throw new Error(error.message);
}

export async function deletePhotoRow(
  supabase: SupabaseClient,
  photoId: string
): Promise<void> {
  const { error } = await supabase.from("property_photos").delete().eq("id", photoId);
  if (error) throw new Error(error.message);
}

export interface PhotoInput {
  propertyId: string;
  caption: string;
  category: string;
  /** URL externe ou chemin Storage. */
  filePath: string;
  takenAt: string;
}

export async function insertPhoto(
  supabase: SupabaseClient,
  ownerId: string,
  input: PhotoInput
): Promise<PropertyPhoto> {
  const { data, error } = await supabase
    .from("property_photos")
    .insert({
      owner_id: ownerId,
      property_id: input.propertyId,
      file_path: input.filePath,
      caption: input.caption,
      category: input.category,
      taken_at: input.takenAt,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapPhoto(data as PhotoRow);
}
