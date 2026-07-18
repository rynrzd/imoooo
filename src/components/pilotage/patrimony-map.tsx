"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Map as LeafletMap } from "leaflet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { logger } from "@/lib/logger";
import { useAppStore } from "@/lib/store";
import type { AppData, Property } from "@/lib/types";

/**
 * Carte interactive du patrimoine (Business+) — vraie carte Leaflet sur fond
 * OpenStreetMap. Chaque logement est géocodé depuis son adresse RÉELLE via
 * Nominatim (résultats mis en cache localStorage : une seule requête par
 * adresse, requêtes espacées conformément à la politique d'usage).
 * Couleur du marqueur = état réel du logement ; clic = ouvre la fiche.
 * Aucune coordonnée inventée : une adresse introuvable est listée sous la carte.
 */

type Health = "ok" | "attention" | "probleme";

const HEALTH_COLORS: Record<Health, string> = {
  ok: "#059669", // emerald-600
  attention: "#d97706", // amber-600
  probleme: "#dc2626", // red-600
};

const HEALTH_LABELS: Record<Health, string> = {
  ok: "Sans problème",
  attention: "Attention",
  probleme: "Loyer impayé / problème",
};

/** État réel d'un logement, dérivé des données (jamais inventé). */
function propertyHealth(data: AppData, property: Property): Health {
  const late = data.rentPayments.some(
    (p) => p.propertyId === property.id && p.status === "retard"
  );
  if (late) return "probleme";
  const partial = data.rentPayments.some(
    (p) => p.propertyId === property.id && p.status === "partiel"
  );
  const todayIso = new Date().toISOString().slice(0, 10);
  const expiredDoc = data.documents.some(
    (d) => d.propertyId === property.id && d.expiresAt && d.expiresAt < todayIso
  );
  const workInProgress = data.works.some(
    (w) => w.propertyId === property.id && w.status === "en_cours"
  );
  if (property.status === "vacant" || partial || expiredDoc || workInProgress) {
    return "attention";
  }
  return "ok";
}

interface GeoPoint {
  lat: number;
  lon: number;
}

const GEO_CACHE_KEY = "immopilot:geocache:v1";

function readGeoCache(): Record<string, GeoPoint | null> {
  try {
    return JSON.parse(window.localStorage.getItem(GEO_CACHE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeGeoCache(cache: Record<string, GeoPoint | null>): void {
  try {
    window.localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Stockage plein : la carte fonctionne quand même (re-géocodage au prochain passage).
  }
}

/** Géocode une adresse via Nominatim (null si introuvable — jamais inventé). */
async function geocode(address: string): Promise<GeoPoint | null> {
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=fr&q=" +
    encodeURIComponent(address);
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Nominatim HTTP ${response.status}`);
  const results = (await response.json()) as { lat: string; lon: string }[];
  const first = results[0];
  if (!first) return null;
  const lat = Number(first.lat);
  const lon = Number(first.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

export function PatrimonyMap() {
  const { data } = useAppStore();
  const router = useRouter();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<LeafletMap | null>(null);
  const properties = data.properties;
  const [status, setStatus] = React.useState<"chargement" | "pret" | "erreur">(
    () => (properties.length === 0 ? "pret" : "chargement")
  );
  const [unlocated, setUnlocated] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (properties.length === 0) return;
    let cancelled = false;

    const run = async () => {
      try {
        // Leaflet manipule window : import dynamique côté client uniquement.
        const L = (await import("leaflet")).default;
        if (cancelled || !containerRef.current) return;

        if (!mapRef.current) {
          mapRef.current = L.map(containerRef.current, {
            scrollWheelZoom: false,
          }).setView([46.6, 2.4], 5); // France entière par défaut
          L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          }).addTo(mapRef.current);
        }
        const map = mapRef.current;
        setStatus("pret");

        const cache = readGeoCache();
        const bounds: [number, number][] = [];
        const missing: string[] = [];

        for (const property of properties) {
          const address = `${property.address}, ${property.postalCode} ${property.city}`;
          let point = cache[address];

          if (point === undefined) {
            try {
              point = await geocode(address);
            } catch (e) {
              logger.error("pilotage/geocode", e);
              continue; // adresse retentée au prochain affichage
            }
            cache[address] = point; // null aussi mis en cache (adresse introuvable)
            writeGeoCache(cache);
            // Politique Nominatim : au plus ~1 requête/seconde.
            await new Promise((resolve) => window.setTimeout(resolve, 1100));
          }
          if (cancelled) return;
          if (point === null) {
            missing.push(property.name);
            continue;
          }

          const health = propertyHealth(data, property);
          const marker = L.circleMarker([point.lat, point.lon], {
            radius: 9,
            color: "#ffffff",
            weight: 2,
            fillColor: HEALTH_COLORS[health],
            fillOpacity: 1,
          }).addTo(map);
          marker.bindTooltip(
            `${property.name} — ${HEALTH_LABELS[health]}`,
            { direction: "top", offset: [0, -6] }
          );
          marker.on("click", () => router.push(`/logements/${property.id}`));
          bounds.push([point.lat, point.lon]);

          if (bounds.length > 0) {
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
          }
        }

        if (!cancelled) setUnlocated(missing);
      } catch (e) {
        logger.error("pilotage/carte", e);
        if (!cancelled) setStatus("erreur");
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
    // data volontairement hors dépendances : la carte se construit par visite
    // (les marqueurs reflètent l'état au chargement de la page).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties, router]);

  // Démontage : la carte Leaflet est détruite proprement.
  React.useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Carte du patrimoine</CardTitle>
        <p className="text-xs text-muted-foreground">
          Localisation réelle de vos logements (adresses géocodées). Cliquez sur
          un marqueur pour ouvrir la fiche.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {properties.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Ajoutez votre premier logement pour le voir apparaître sur la carte.
          </p>
        ) : status === "erreur" ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Carte indisponible pour le moment (connexion requise). Réessayez.
          </p>
        ) : (
          <>
            <div className="relative">
              {status === "chargement" ? (
                <Skeleton className="absolute inset-0 z-10 rounded-xl" />
              ) : null}
              <div
                ref={containerRef}
                className="h-[420px] w-full overflow-hidden rounded-xl border border-border"
                aria-label="Carte des logements"
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {(Object.keys(HEALTH_LABELS) as Health[]).map((h) => (
                <span key={h} className="flex items-center gap-1.5">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: HEALTH_COLORS[h] }}
                    aria-hidden
                  />
                  {HEALTH_LABELS[h]}
                </span>
              ))}
            </div>
            {unlocated.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Adresse introuvable pour : {unlocated.join(", ")} — vérifiez
                l&apos;adresse dans la fiche du logement.
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
