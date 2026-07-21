import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityItem, AppData } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { resolvePlan, type SubscriptionRow } from "@/lib/stripe/subscription";
import { ensureRentSchedule } from "./mutations";
import { createSignedUrlMap } from "./storage";
import {
  mapDocument,
  mapExpense,
  mapLeaseToTenant,
  mapPhoto,
  mapProperty,
  mapRentPayment,
  mapWork,
  type DocumentRow,
  type ExpenseRow,
  type LeaseRow,
  type MaintenanceRow,
  type PhotoRow,
  type ProfileRow,
  type PropertyRow,
  type RentPaymentRow,
} from "./mappers";

export interface UserProfile {
  fullName: string;
  phone: string;
  /**
   * Plan EFFECTIF, calculé côté serveur depuis la table `subscriptions`
   * (source de vérité unique via resolvePlan) — jamais la valeur brute
   * de `profiles.plan`, qui n'est qu'un cache secondaire.
   */
  plan: string;
  /** true si accès à vie Fondateur (affichage « Offre Fondateur » cohérent). */
  isFounder: boolean;
  companyName: string;
  /** Chemin Storage de l'avatar (bucket profile-avatars), null si absent. */
  avatarPath: string | null;
  /** false tant que l'assistant de bienvenue n'a pas été terminé. */
  onboardingCompleted: boolean;
}

export interface FetchResult {
  data: AppData;
  profile: UserProfile | null;
}

/** L'activité récente est dérivée des données (pas de table dédiée). */
function deriveActivity(data: AppData): ActivityItem[] {
  const items: ActivityItem[] = [];
  const propertyName = (id: string) =>
    data.properties.find((p) => p.id === id)?.name ?? "Logement";

  for (const payment of data.rentPayments) {
    if (payment.status === "retard") {
      items.push({
        id: `act-late-${payment.id}`,
        type: "retard",
        message: `Loyer de ${propertyName(payment.propertyId)} en retard`,
        date: `${payment.month}-28`,
        propertyId: payment.propertyId,
      });
    } else if (payment.paidAt && payment.received > 0) {
      items.push({
        id: `act-pay-${payment.id}`,
        type: "paiement",
        message: `Loyer de ${propertyName(payment.propertyId)} encaissé (${formatCurrency(payment.received)})`,
        date: payment.paidAt,
        propertyId: payment.propertyId,
      });
    }
  }
  for (const work of data.works) {
    items.push({
      id: `act-work-${work.id}`,
      type: "travaux",
      message: `Travaux — ${propertyName(work.propertyId)} : ${work.title}`,
      date: work.date,
      propertyId: work.propertyId,
    });
  }
  for (const document of data.documents) {
    items.push({
      id: `act-doc-${document.id}`,
      type: "document",
      message: `Document ajouté : ${document.name}`,
      date: document.addedAt,
      propertyId: document.propertyId,
    });
  }
  for (const tenant of data.tenants) {
    items.push({
      id: `act-tenant-${tenant.id}`,
      type: "locataire",
      message: `${tenant.firstName} ${tenant.lastName} — entrée dans ${propertyName(tenant.propertyId)}`,
      date: tenant.entryDate,
      propertyId: tenant.propertyId,
    });
    if (tenant.exitDate) {
      items.push({
        id: `act-tenant-exit-${tenant.id}`,
        type: "locataire",
        message: `${tenant.firstName} ${tenant.lastName} — fin de bail (${propertyName(tenant.propertyId)})`,
        date: tenant.exitDate,
        propertyId: tenant.propertyId,
      });
    }
  }
  for (const expense of data.expenses) {
    items.push({
      id: `act-exp-${expense.id}`,
      type: "depense",
      message: `Dépense : ${expense.label} (${formatCurrency(expense.amount)})`,
      date: expense.date,
      propertyId: expense.propertyId,
    });
  }
  for (const photo of data.photos) {
    items.push({
      id: `act-photo-${photo.id}`,
      type: "photo",
      message: `Photo ajoutée — ${propertyName(photo.propertyId)}`,
      date: photo.takenAt,
      propertyId: photo.propertyId,
    });
  }

  // Rien dans le futur (baux à venir…) : la timeline reste chronologique.
  const todayIso = new Date().toISOString().slice(0, 10);
  return items
    .filter((item) => item.date <= todayIso)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);
}

/**
 * Charge toutes les données de l'utilisateur connecté.
 * La RLS garantit côté serveur que seules ses lignes sont retournées.
 */
export async function fetchAppData(
  supabase: SupabaseClient,
  userId: string
): Promise<FetchResult> {
  // Les baux d'abord : les échéances manquantes (nouveau mois, nouveau bail)
  // sont générées avant la lecture des paiements.
  const leases = await supabase
    .from("leases")
    .select(
      "id, property_id, entry_date, exit_date, rent, charges, deposit, tenants (first_name, last_name, email, phone)"
    )
    .order("entry_date", { ascending: false });
  if (leases.error) {
    throw new Error(`Chargement des baux impossible : ${leases.error.message}`);
  }
  await ensureRentSchedule(
    supabase,
    userId,
    ((leases.data ?? []) as unknown as LeaseRow[]).map((l) => ({
      id: l.id,
      entryDate: l.entry_date,
      exitDate: l.exit_date,
      rent: typeof l.rent === "number" ? l.rent : Number(l.rent),
      charges: typeof l.charges === "number" ? l.charges : Number(l.charges),
    }))
  );

  // Colonnes explicites (alignées sur les interfaces *Row des mappers) :
  // réduit la taille des réponses et fige le contrat avec le schéma.
  const [properties, payments, expenses, documents, photos, works, profile, subscription] =
    await Promise.all([
      supabase
        .from("properties")
        .select(
          "id, name, address, postal_code, city, type, surface, rooms, photo_url, purchase_price, purchase_date, rent, charges, status"
        )
        .order("created_at"),
      supabase
        .from("rent_payments")
        .select("id, lease_id, month, expected, received, paid_at, status, comment")
        .order("month", { ascending: false }),
      supabase
        .from("expenses")
        .select(
          "id, property_id, label, category, amount, date, supplier, receipt_path, maintenance_record_id"
        )
        .order("date", { ascending: false }),
      supabase
        .from("documents")
        .select(
          "id, property_id, name, category, file_path, file_type, size_bytes, maintenance_record_id, expires_at, created_at"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("property_photos")
        .select("id, property_id, file_path, caption, category, taken_at")
        .order("taken_at", { ascending: false }),
      supabase
        .from("maintenance_records")
        .select(
          "id, property_id, title, company, amount, date, status, actual_cost, progress, end_date"
        )
        .order("date", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name, phone, avatar_url, plan, company_name, onboarding_completed")
        .eq("id", userId)
        .maybeSingle(),
      // Source de vérité de l'abonnement : la table `subscriptions` (RLS :
      // lecture de sa propre ligne). Le plan effectif en est dérivé.
      supabase
        .from("subscriptions")
        .select(
          "user_id, plan, status, provider, lifetime_access, founder_tier, founder_purchase_number, current_period_start, current_period_end, stripe_customer_id, stripe_subscription_id, stripe_price_id, cancel_at_period_end, created_at, updated_at"
        )
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

  const failed = [properties, payments, expenses, documents, photos, works, profile]
    .map((r) => r.error)
    .find(Boolean);
  if (failed) throw new Error(`Chargement des données impossible : ${failed.message}`);

  const leaseRows = (leases.data ?? []) as unknown as LeaseRow[];
  const docRows = (documents.data ?? []) as DocumentRow[];
  const photoRows = (photos.data ?? []) as PhotoRow[];

  // URL signées pour les photos stockées dans le bucket privé.
  const photoSignedUrls = await createSignedUrlMap(
    supabase,
    "property-photos",
    photoRows.map((p) => p.file_path).filter((p) => !p.startsWith("http"))
  );

  const leasePropertyById = new Map(leaseRows.map((l) => [l.id, l.property_id]));
  const activeLeaseByProperty = new Map(
    leaseRows.filter((l) => l.exit_date === null).map((l) => [l.property_id, l.id])
  );

  const mappedDocuments = docRows.map(mapDocument);
  const data: AppData = {
    properties: ((properties.data ?? []) as PropertyRow[]).map((row) =>
      mapProperty(row, activeLeaseByProperty.get(row.id) ?? null)
    ),
    tenants: leaseRows.map(mapLeaseToTenant),
    rentPayments: ((payments.data ?? []) as RentPaymentRow[]).map((row) =>
      mapRentPayment(row, leasePropertyById)
    ),
    expenses: ((expenses.data ?? []) as ExpenseRow[]).map(mapExpense),
    documents: mappedDocuments,
    photos: photoRows.map((row) => mapPhoto(row, photoSignedUrls)),
    works: ((works.data ?? []) as MaintenanceRow[]).map((row) => mapWork(row, docRows)),
    activity: [],
  };
  data.activity = deriveActivity(data);

  const profileRow = profile.data as ProfileRow | null;

  // Plan EFFECTIF depuis la table subscriptions (source de vérité unique) :
  // résout Fondateur (à vie) > abonnement actif > Gratuit. `profiles.plan`
  // n'est plus lu comme autorité — client et serveur utilisent resolvePlan.
  const subscriptionRow = (subscription.data as SubscriptionRow | null) ?? null;
  const effectivePlan = resolvePlan(subscriptionRow);
  const isFounder = Boolean(
    subscriptionRow?.lifetime_access && subscriptionRow.provider === "founder"
  );

  return {
    data,
    profile: profileRow
      ? {
          fullName: profileRow.full_name,
          phone: profileRow.phone ?? "",
          plan: effectivePlan.id,
          isFounder,
          companyName: profileRow.company_name ?? "",
          avatarPath: profileRow.avatar_url,
          onboardingCompleted: profileRow.onboarding_completed ?? true,
        }
      : null,
  };
}
