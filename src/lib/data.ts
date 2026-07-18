import type {
  ActivityItem,
  AppData,
  Expense,
  Property,
  PropertyDocument,
  PropertyPhoto,
  RentPayment,
  Tenant,
  Work,
} from "./types";
import {
  addMonths,
  currentMonthKey,
  endOfMonth,
  isoDate,
  lastMonths,
  monthRange,
} from "./dates";

/**
 * Données de démonstration réalistes, ancrées sur le mois courant.
 * Toute la génération est déterministe (pas de Math.random) pour garantir
 * un rendu identique entre le serveur et le client.
 */

const CURRENT = currentMonthKey();

/** Petit hash déterministe pour faire varier les jours de paiement. */
function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const unsplash = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=75`;

/* ------------------------------------------------------------------ */
/* Logements                                                           */
/* ------------------------------------------------------------------ */

export const seedProperties: Property[] = [
  {
    id: "p1",
    name: "Studio Croix-Rousse",
    address: "18 rue Burdeau",
    postalCode: "69001",
    city: "Lyon",
    type: "Studio",
    surface: 24,
    rooms: 1,
    photo: unsplash("photo-1522708323590-d24dbb6b0267"),
    purchasePrice: 118000,
    purchaseDate: "2019-05-14",
    rent: 495,
    charges: 35,
    status: "loue",
    currentTenantId: "t1",
  },
  {
    id: "p2",
    name: "T2 Part-Dieu",
    address: "12 avenue Félix Faure",
    postalCode: "69003",
    city: "Lyon",
    type: "T2",
    surface: 42,
    rooms: 2,
    photo: unsplash("photo-1502672260266-1c1ef2d93688"),
    purchasePrice: 189000,
    purchaseDate: "2020-09-01",
    rent: 780,
    charges: 60,
    status: "loue",
    currentTenantId: "t2",
  },
  {
    id: "p3",
    name: "T3 Tête d'Or",
    address: "5 rue de Sèze",
    postalCode: "69006",
    city: "Lyon",
    type: "T3",
    surface: 68,
    rooms: 3,
    photo: unsplash("photo-1560448204-e02f11c3d0e2"),
    purchasePrice: 285000,
    purchaseDate: "2021-03-20",
    rent: 1150,
    charges: 90,
    status: "loue",
    currentTenantId: "t3",
  },
  {
    id: "p4",
    name: "Studio Guillotière",
    address: "33 rue de Marseille",
    postalCode: "69007",
    city: "Lyon",
    type: "T1",
    surface: 21,
    rooms: 1,
    photo: unsplash("photo-1554995207-c18c203602cb"),
    purchasePrice: 102000,
    purchaseDate: "2018-11-05",
    rent: 460,
    charges: 30,
    status: "vacant",
    currentTenantId: null,
  },
  {
    id: "p5",
    name: "T4 Villeurbanne",
    address: "8 rue Anatole France",
    postalCode: "69100",
    city: "Villeurbanne",
    type: "T4",
    surface: 82,
    rooms: 4,
    photo: unsplash("photo-1600585154340-be6161a56a0c"),
    purchasePrice: 320000,
    purchaseDate: "2022-06-15",
    rent: 1320,
    charges: 110,
    status: "loue",
    currentTenantId: "t5",
  },
  {
    id: "p6",
    name: "T2 Monplaisir",
    address: "27 avenue des Frères Lumière",
    postalCode: "69008",
    city: "Lyon",
    type: "T2",
    surface: 45,
    rooms: 2,
    photo: unsplash("photo-1493809842364-78817add7ffb"),
    purchasePrice: 198000,
    purchaseDate: "2023-01-10",
    rent: 820,
    charges: 65,
    status: "travaux",
    currentTenantId: null,
  },
];

/* ------------------------------------------------------------------ */
/* Locataires                                                          */
/* ------------------------------------------------------------------ */

export const seedTenants: Tenant[] = [
  {
    id: "t1",
    propertyId: "p1",
    firstName: "Camille",
    lastName: "Roux",
    email: "camille.roux@gmail.com",
    phone: "06 12 45 78 90",
    entryDate: "2023-09-01",
    exitDate: null,
    rent: 495,
    charges: 35,
    deposit: 495,
  },
  {
    id: "t2",
    propertyId: "p2",
    firstName: "Julien",
    lastName: "Mercier",
    email: "julien.mercier@outlook.fr",
    phone: "07 68 32 14 55",
    entryDate: "2024-02-15",
    exitDate: null,
    rent: 780,
    charges: 60,
    deposit: 780,
  },
  {
    id: "t3",
    propertyId: "p3",
    firstName: "Sophie",
    lastName: "Lambert",
    email: "sophie.lambert@protonmail.com",
    phone: "06 44 21 09 87",
    entryDate: "2022-07-01",
    exitDate: null,
    rent: 1150,
    charges: 90,
    deposit: 1150,
  },
  {
    id: "t4",
    propertyId: "p4",
    firstName: "Léa",
    lastName: "Fontaine",
    email: "lea.fontaine@gmail.com",
    phone: "06 98 77 41 23",
    entryDate: "2023-04-01",
    // Sortie à la fin du mois dernier : le studio est vacant depuis.
    exitDate: endOfMonth(addMonths(CURRENT, -1)),
    rent: 460,
    charges: 30,
    deposit: 460,
  },
  {
    id: "t5",
    propertyId: "p5",
    firstName: "Thomas",
    lastName: "Nguyen",
    email: "thomas.nguyen@icloud.com",
    phone: "07 12 88 34 76",
    entryDate: "2023-11-01",
    exitDate: null,
    rent: 1320,
    charges: 110,
    deposit: 1320,
  },
];

/* ------------------------------------------------------------------ */
/* Loyers — générés sur les 18 derniers mois                           */
/* ------------------------------------------------------------------ */

type RentOverride = Partial<Pick<RentPayment, "received" | "paidAt" | "status" | "comment">>;

/** Cas particuliers (retards, paiements partiels) exprimés en mois relatifs. */
function rentOverrides(): Record<string, RentOverride> {
  return {
    // Mois courant : le locataire du T2 Part-Dieu n'a pas encore payé.
    [`t2:${CURRENT}`]: {
      received: 0,
      paidAt: null,
      status: "retard",
      comment: "Relance envoyée par e-mail",
    },
    // Mois courant : paiement du T4 attendu (prélèvement le 15).
    [`t5:${CURRENT}`]: {
      received: 0,
      paidAt: null,
      status: "attente",
      comment: "Virement programmé le 15",
    },
    // Paiement partiel il y a 4 mois, régularisé le mois suivant.
    [`t2:${addMonths(CURRENT, -4)}`]: {
      received: 400,
      status: "partiel",
      comment: "Solde régularisé le mois suivant",
    },
    // Un paiement en retard historique.
    [`t1:${addMonths(CURRENT, -7)}`]: {
      paidAt: isoDate(addMonths(CURRENT, -7), 18),
      status: "paye",
      comment: "Payé avec 15 jours de retard",
    },
  };
}

function generateRentPayments(): RentPayment[] {
  const windowStart = addMonths(CURRENT, -17);
  const overrides = rentOverrides();
  const payments: RentPayment[] = [];

  for (const tenant of seedTenants) {
    const entryMonth = tenant.entryDate.slice(0, 7);
    const exitMonth = tenant.exitDate ? tenant.exitDate.slice(0, 7) : CURRENT;
    const from = entryMonth > windowStart ? entryMonth : windowStart;
    if (from > exitMonth) continue;

    for (const month of monthRange(from, exitMonth)) {
      const expected = tenant.rent + tenant.charges;
      const payDay = 2 + (hash(`${tenant.id}:${month}`) % 5);
      const base: RentPayment = {
        id: `rp-${tenant.id}-${month}`,
        propertyId: tenant.propertyId,
        tenantId: tenant.id,
        month,
        expected,
        received: expected,
        paidAt: isoDate(month, payDay),
        status: "paye",
        comment: "",
      };
      payments.push({ ...base, ...overrides[`${tenant.id}:${month}`] });
    }
  }

  return payments.sort((a, b) => b.month.localeCompare(a.month));
}

export const seedRentPayments: RentPayment[] = generateRentPayments();

/* ------------------------------------------------------------------ */
/* Travaux                                                             */
/* ------------------------------------------------------------------ */

export const seedWorks: Work[] = [
  {
    id: "w1",
    propertyId: "p6",
    title: "Rénovation complète — cuisine et salle de bain",
    company: "BâtiRhône",
    amount: 18400,
    date: isoDate(addMonths(CURRENT, -1), 1),
    status: "en_cours",
    invoiceDocumentId: "d-w1",
    photoIds: ["ph-p6-1", "ph-p6-2"],
  },
  {
    id: "w2",
    propertyId: "p4",
    title: "Rafraîchissement peinture avant relocation",
    company: "Peintures Morel",
    amount: 2300,
    date: isoDate(addMonths(CURRENT, -1), 20),
    status: "termine",
    invoiceDocumentId: "d-w2",
    photoIds: ["ph-p4-2"],
  },
  {
    id: "w3",
    propertyId: "p1",
    title: "Remplacement de la chaudière gaz",
    company: "Ets Girard Chauffage",
    amount: 1850,
    date: isoDate(addMonths(CURRENT, -8), 12),
    status: "termine",
    invoiceDocumentId: "d-w3",
    photoIds: [],
  },
  {
    id: "w4",
    propertyId: "p3",
    title: "Réfection de la salle de bain",
    company: "SARL Habitat Plus",
    amount: 4900,
    date: isoDate(addMonths(CURRENT, -15), 8),
    status: "termine",
    invoiceDocumentId: "d-w4",
    photoIds: ["ph-p3-3"],
  },
  {
    id: "w5",
    propertyId: "p5",
    title: "Remplacement du lave-vaisselle encastrable",
    company: "Darty Pro",
    amount: 649,
    date: isoDate(addMonths(CURRENT, -5), 14),
    status: "termine",
    invoiceDocumentId: null,
    photoIds: [],
  },
  {
    id: "w6",
    propertyId: "p2",
    title: "Réparation du volet roulant du séjour",
    company: "Alu Store 69",
    amount: 380,
    date: isoDate(addMonths(CURRENT, -3), 3),
    status: "termine",
    invoiceDocumentId: null,
    photoIds: [],
  },
  {
    id: "w7",
    propertyId: "p6",
    title: "Mise aux normes du tableau électrique",
    company: "Élec'Lyon",
    amount: 2150,
    date: isoDate(addMonths(CURRENT, -2), 10),
    status: "termine",
    invoiceDocumentId: null,
    photoIds: [],
  },
];

/* ------------------------------------------------------------------ */
/* Dépenses — charges récurrentes + travaux                            */
/* ------------------------------------------------------------------ */

const RECURRING: Record<
  string,
  { assurance: number; taxeFonciere: number; copropriete: number }
> = {
  p1: { assurance: 96, taxeFonciere: 620, copropriete: 180 },
  p2: { assurance: 132, taxeFonciere: 980, copropriete: 260 },
  p3: { assurance: 168, taxeFonciere: 1450, copropriete: 310 },
  p4: { assurance: 90, taxeFonciere: 540, copropriete: 150 },
  p5: { assurance: 189, taxeFonciere: 1680, copropriete: 290 },
  p6: { assurance: 138, taxeFonciere: 1020, copropriete: 240 },
};

function generateExpenses(): Expense[] {
  const expenses: Expense[] = [];
  const months = lastMonths(18);

  for (const property of seedProperties) {
    const config = RECURRING[property.id];
    for (const month of months) {
      const mm = month.slice(5);
      if (mm === "01") {
        expenses.push({
          id: `e-${property.id}-${month}-pno`,
          propertyId: property.id,
          label: "Assurance PNO (annuelle)",
          category: "assurance",
          amount: config.assurance,
          date: isoDate(month, 8),
        });
      }
      if (mm === "10") {
        expenses.push({
          id: `e-${property.id}-${month}-tf`,
          propertyId: property.id,
          label: "Taxe foncière",
          category: "taxe_fonciere",
          amount: config.taxeFonciere,
          date: isoDate(month, 15),
        });
      }
      if (["01", "04", "07", "10"].includes(mm)) {
        expenses.push({
          id: `e-${property.id}-${month}-copro`,
          propertyId: property.id,
          label: "Charges de copropriété (trimestre)",
          category: "copropriete",
          amount: config.copropriete,
          date: isoDate(month, 5),
        });
      }
    }
  }

  // Les travaux sont aussi des dépenses.
  for (const work of seedWorks) {
    expenses.push({
      id: `e-${work.id}`,
      propertyId: work.propertyId,
      label: work.title,
      category: "travaux",
      amount: work.amount,
      date: work.date,
    });
  }

  return expenses.sort((a, b) => b.date.localeCompare(a.date));
}

export const seedExpenses: Expense[] = generateExpenses();

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

function doc(
  id: string,
  propertyId: string,
  name: string,
  category: PropertyDocument["category"],
  addedAt: string,
  size: string,
  fileType: PropertyDocument["fileType"] = "pdf"
): PropertyDocument {
  return { id, propertyId, name, category, addedAt, size, fileType, filePath: null };
}

export const seedDocuments: PropertyDocument[] = [
  // Studio Croix-Rousse
  doc("d-p1-bail", "p1", "Bail de location — Camille Roux", "bail", "2023-08-28", "1,2 Mo"),
  doc("d-p1-edl", "p1", "État des lieux d'entrée", "etat_des_lieux", "2023-09-01", "3,4 Mo"),
  doc("d-p1-dpe", "p1", "Diagnostic de performance énergétique (DPE)", "diagnostics", "2023-06-12", "860 Ko"),
  doc("d-p1-pno", "p1", "Attestation assurance PNO 2026", "assurance", isoDate(addMonths(CURRENT, -6), 9), "420 Ko"),
  doc("d-w3", "p1", "Facture — remplacement chaudière", "factures", isoDate(addMonths(CURRENT, -8), 15), "310 Ko"),
  doc("d-p1-gar", "p1", "Garantie chaudière Saunier Duval (5 ans)", "garanties", isoDate(addMonths(CURRENT, -8), 15), "180 Ko"),
  // T2 Part-Dieu
  doc("d-p2-bail", "p2", "Bail de location — Julien Mercier", "bail", "2024-02-10", "1,1 Mo"),
  doc("d-p2-edl", "p2", "État des lieux d'entrée", "etat_des_lieux", "2024-02-15", "2,9 Mo"),
  doc("d-p2-diag", "p2", "Dossier de diagnostics techniques", "diagnostics", "2024-01-22", "2,1 Mo"),
  doc("d-p2-gli", "p2", "Contrat garantie loyers impayés", "assurance", "2024-02-12", "640 Ko"),
  // T3 Tête d'Or
  doc("d-p3-bail", "p3", "Bail de location — Sophie Lambert", "bail", "2022-06-25", "1,3 Mo"),
  doc("d-p3-edl", "p3", "État des lieux d'entrée", "etat_des_lieux", "2022-07-01", "3,8 Mo"),
  doc("d-w4", "p3", "Facture — réfection salle de bain", "factures", isoDate(addMonths(CURRENT, -15), 20), "540 Ko"),
  doc("d-p3-dpe", "p3", "DPE (classe C)", "diagnostics", "2022-05-30", "790 Ko"),
  // Studio Guillotière
  doc("d-p4-edl-sortie", "p4", "État des lieux de sortie — Léa Fontaine", "etat_des_lieux", endOfMonth(addMonths(CURRENT, -1)), "3,1 Mo"),
  doc("d-w2", "p4", "Facture — peinture complète", "factures", isoDate(addMonths(CURRENT, -1), 25), "290 Ko"),
  doc("d-p4-dpe", "p4", "DPE (classe D)", "diagnostics", "2024-03-18", "820 Ko"),
  // T4 Villeurbanne
  doc("d-p5-bail", "p5", "Bail de location — Thomas Nguyen", "bail", "2023-10-25", "1,2 Mo"),
  doc("d-p5-edl", "p5", "État des lieux d'entrée", "etat_des_lieux", "2023-11-01", "4,2 Mo"),
  doc("d-p5-caf", "p5", "Attestation CAF du locataire", "autres", "2023-11-06", "150 Ko"),
  // T2 Monplaisir
  doc("d-w1", "p6", "Devis signé — rénovation BâtiRhône", "factures", isoDate(addMonths(CURRENT, -2), 18), "980 Ko"),
  doc("d-p6-amiante", "p6", "Diagnostic amiante avant travaux", "diagnostics", isoDate(addMonths(CURRENT, -3), 6), "1,4 Mo"),
];

/* ------------------------------------------------------------------ */
/* Photos                                                              */
/* ------------------------------------------------------------------ */

function photo(
  id: string,
  propertyId: string,
  unsplashId: string,
  caption: string,
  category: PropertyPhoto["category"],
  takenAt: string
): PropertyPhoto {
  return {
    id,
    propertyId,
    url: unsplash(unsplashId),
    caption,
    category,
    takenAt,
    storagePath: null,
  };
}

export const seedPhotos: PropertyPhoto[] = [
  photo("ph-p1-1", "p1", "photo-1522708323590-d24dbb6b0267", "Pièce principale", "avant_location", "2023-08-20"),
  photo("ph-p1-2", "p1", "photo-1484154218962-a197022b5858", "Coin cuisine équipé", "avant_location", "2023-08-20"),
  photo("ph-p1-3", "p1", "photo-1556911220-bff31c812dba", "Cuisine — état des lieux d'entrée", "entree", "2023-09-01"),
  photo("ph-p2-1", "p2", "photo-1502672260266-1c1ef2d93688", "Séjour lumineux", "avant_location", "2024-01-30"),
  photo("ph-p2-2", "p2", "photo-1586023492125-27b2c045efd7", "Chambre", "entree", "2024-02-15"),
  photo("ph-p3-1", "p3", "photo-1560448204-e02f11c3d0e2", "Séjour avec parquet", "avant_location", "2022-06-18"),
  photo("ph-p3-2", "p3", "photo-1598928506311-c55ded91a20c", "Salon côté cheminée", "entree", "2022-07-01"),
  photo("ph-p3-3", "p3", "photo-1600566753190-17f0baa2a6c3", "Salle de bain rénovée", "apres_travaux", isoDate(addMonths(CURRENT, -15), 22)),
  photo("ph-p4-1", "p4", "photo-1554995207-c18c203602cb", "Vue générale du studio", "sortie", endOfMonth(addMonths(CURRENT, -1))),
  photo("ph-p4-2", "p4", "photo-1513694203232-719a280e022f", "Murs repeints en blanc", "apres_travaux", isoDate(addMonths(CURRENT, -1), 24)),
  photo("ph-p4-3", "p4", "photo-1560185007-cde436f6a4d0", "Trace d'humidité sous la fenêtre", "dommages", endOfMonth(addMonths(CURRENT, -1))),
  photo("ph-p5-1", "p5", "photo-1600585154340-be6161a56a0c", "Façade de la résidence", "avant_location", "2023-10-15"),
  photo("ph-p5-2", "p5", "photo-1600607687939-ce8a6c25118c", "Pièce de vie", "entree", "2023-11-01"),
  photo("ph-p5-3", "p5", "photo-1600566752355-35792bedcfea", "Salle de bain familiale", "entree", "2023-11-01"),
  photo("ph-p6-1", "p6", "photo-1493809842364-78817add7ffb", "Séjour avant rénovation", "avant_location", isoDate(addMonths(CURRENT, -2), 5)),
  photo("ph-p6-2", "p6", "photo-1581858726788-75bc0f6a952d", "Chantier cuisine en cours", "apres_travaux", isoDate(addMonths(CURRENT, 0), 2)),
];

/* ------------------------------------------------------------------ */
/* Activité récente                                                    */
/* ------------------------------------------------------------------ */

export const seedActivity: ActivityItem[] = [
  {
    id: "a1",
    type: "retard",
    message: "Loyer du T2 Part-Dieu en retard — relance envoyée à Julien Mercier",
    date: isoDate(CURRENT, 10),
    propertyId: "p2",
  },
  {
    id: "a2",
    type: "paiement",
    message: "Loyer du T3 Tête d'Or encaissé (1 240 €)",
    date: isoDate(CURRENT, 5),
    propertyId: "p3",
  },
  {
    id: "a3",
    type: "paiement",
    message: "Loyer du Studio Croix-Rousse encaissé (530 €)",
    date: isoDate(CURRENT, 3),
    propertyId: "p1",
  },
  {
    id: "a4",
    type: "travaux",
    message: "Chantier BâtiRhône : cuisine posée au T2 Monplaisir",
    date: isoDate(CURRENT, 2),
    propertyId: "p6",
  },
  {
    id: "a5",
    type: "document",
    message: "État des lieux de sortie ajouté au Studio Guillotière",
    date: endOfMonth(addMonths(CURRENT, -1)),
    propertyId: "p4",
  },
  {
    id: "a6",
    type: "locataire",
    message: "Départ de Léa Fontaine — Studio Guillotière désormais vacant",
    date: endOfMonth(addMonths(CURRENT, -1)),
    propertyId: "p4",
  },
  {
    id: "a7",
    type: "travaux",
    message: "Peinture terminée au Studio Guillotière (2 300 €)",
    date: isoDate(addMonths(CURRENT, -1), 26),
    propertyId: "p4",
  },
  {
    id: "a8",
    type: "paiement",
    message: "Loyer du T4 Villeurbanne encaissé (1 430 €)",
    date: isoDate(addMonths(CURRENT, -1), 4),
    propertyId: "p5",
  },
];

/* ------------------------------------------------------------------ */

export const seedData: AppData = {
  properties: seedProperties,
  tenants: seedTenants,
  rentPayments: seedRentPayments,
  documents: seedDocuments,
  photos: seedPhotos,
  works: seedWorks,
  expenses: seedExpenses,
  activity: seedActivity,
};
