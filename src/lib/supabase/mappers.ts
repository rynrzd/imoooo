import { DEFAULT_PROPERTY_PHOTO } from "@/lib/constants";
import type {
  Expense,
  Property,
  PropertyDocument,
  PropertyPhoto,
  RentPayment,
  Tenant,
  Work,
} from "@/lib/types";

/**
 * Mappers lignes Supabase → types métier.
 * Convention : un « locataire » côté interface correspond à un bail
 * (lease) joint à son locataire — l'id métier d'un Tenant est l'id du bail.
 */

export interface PropertyRow {
  id: string;
  name: string;
  address: string;
  postal_code: string;
  city: string;
  type: string;
  surface: number | string;
  rooms: number;
  photo_url: string | null;
  purchase_price: number | string;
  purchase_date: string;
  rent: number | string;
  charges: number | string;
  status: string;
}

export interface LeaseRow {
  id: string;
  property_id: string;
  entry_date: string;
  exit_date: string | null;
  rent: number | string;
  charges: number | string;
  deposit: number | string;
  tenants: {
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  } | null;
}

export interface RentPaymentRow {
  id: string;
  lease_id: string;
  month: string;
  expected: number | string;
  received: number | string;
  paid_at: string | null;
  status: string;
  comment: string;
}

export interface ExpenseRow {
  id: string;
  property_id: string;
  label: string;
  category: string;
  amount: number | string;
  date: string;
  supplier: string | null;
  receipt_path: string | null;
  maintenance_record_id: string | null;
}

export interface DocumentRow {
  id: string;
  property_id: string;
  name: string;
  category: string;
  file_path: string | null;
  file_type: string;
  size_bytes: number | null;
  maintenance_record_id: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface PhotoRow {
  id: string;
  property_id: string;
  file_path: string;
  caption: string;
  category: string;
  taken_at: string;
}

export interface MaintenanceRow {
  id: string;
  property_id: string;
  title: string;
  company: string;
  amount: number | string;
  date: string;
  status: string;
  actual_cost: number | string | null;
  progress: number | null;
  end_date: string | null;
}

export interface ProfileRow {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  plan: string | null;
  company_name: string | null;
  onboarding_completed: boolean | null;
}

function toNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

export function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

export function mapProperty(row: PropertyRow, activeLeaseId: string | null): Property {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    postalCode: row.postal_code,
    city: row.city,
    type: row.type as Property["type"],
    surface: toNumber(row.surface),
    rooms: row.rooms,
    photo: row.photo_url || DEFAULT_PROPERTY_PHOTO,
    purchasePrice: toNumber(row.purchase_price),
    purchaseDate: row.purchase_date,
    rent: toNumber(row.rent),
    charges: toNumber(row.charges),
    status: row.status as Property["status"],
    currentTenantId: activeLeaseId,
  };
}

export function mapLeaseToTenant(row: LeaseRow): Tenant {
  return {
    id: row.id,
    propertyId: row.property_id,
    firstName: row.tenants?.first_name ?? "",
    lastName: row.tenants?.last_name ?? "",
    email: row.tenants?.email ?? "",
    phone: row.tenants?.phone ?? "",
    entryDate: row.entry_date,
    exitDate: row.exit_date,
    rent: toNumber(row.rent),
    charges: toNumber(row.charges),
    deposit: toNumber(row.deposit),
  };
}

export function mapRentPayment(
  row: RentPaymentRow,
  leasePropertyById: Map<string, string>
): RentPayment {
  return {
    id: row.id,
    propertyId: leasePropertyById.get(row.lease_id) ?? "",
    tenantId: row.lease_id,
    month: row.month.slice(0, 7),
    expected: toNumber(row.expected),
    received: toNumber(row.received),
    paidAt: row.paid_at,
    status: row.status as RentPayment["status"],
    comment: row.comment,
  };
}

export function mapExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    propertyId: row.property_id,
    label: row.label,
    category: row.category as Expense["category"],
    amount: toNumber(row.amount),
    date: row.date,
    supplier: row.supplier ?? "",
    receiptPath: row.receipt_path,
    maintenanceRecordId: row.maintenance_record_id,
  };
}

export function mapDocument(row: DocumentRow): PropertyDocument {
  return {
    id: row.id,
    propertyId: row.property_id,
    name: row.name,
    category: row.category as PropertyDocument["category"],
    addedAt: row.created_at.slice(0, 10),
    size: formatBytes(row.size_bytes),
    fileType: row.file_type as PropertyDocument["fileType"],
    filePath: row.file_path,
    expiresAt: row.expires_at,
  };
}

export function mapPhoto(
  row: PhotoRow,
  signedUrls?: Map<string, string>
): PropertyPhoto {
  const isExternal = row.file_path.startsWith("http");
  return {
    id: row.id,
    propertyId: row.property_id,
    url: isExternal
      ? row.file_path
      : (signedUrls?.get(row.file_path) ?? DEFAULT_PROPERTY_PHOTO),
    caption: row.caption,
    category: row.category as PropertyPhoto["category"],
    takenAt: row.taken_at,
    storagePath: isExternal ? null : row.file_path,
  };
}

export function mapWork(row: MaintenanceRow, docRows: DocumentRow[]): Work {
  const invoice = docRows.find((d) => d.maintenance_record_id === row.id);
  return {
    id: row.id,
    propertyId: row.property_id,
    title: row.title,
    company: row.company,
    amount: toNumber(row.amount),
    date: row.date,
    status: row.status as Work["status"],
    invoiceDocumentId: invoice ? invoice.id : null,
    photoIds: [],
    actualCost: row.actual_cost === null ? null : toNumber(row.actual_cost),
    progress: row.progress,
    endDate: row.end_date,
  };
}
