import type { GeoPoint } from "../types";

const EARTH_KM = 6371;

export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function centroid(points: GeoPoint[]): GeoPoint | undefined {
  if (points.length === 0) return undefined;
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lon = points.reduce((s, p) => s + p.lon, 0) / points.length;
  return { lat, lon };
}

/**
 * "Zuhause" = die Rasterzelle (~5 km), in der die meisten Fotos entstanden
 * sind. Reisen erkennt die App daran, dass Fotos weit davon entfernt liegen.
 */
export function homeLocation(points: GeoPoint[]): GeoPoint | undefined {
  if (points.length < 5) return undefined;
  const cells = new Map<string, GeoPoint[]>();
  for (const p of points) {
    const key = `${Math.round(p.lat * 20)}:${Math.round(p.lon * 20)}`;
    const list = cells.get(key) ?? [];
    list.push(p);
    cells.set(key, list);
  }
  const best = [...cells.values()].sort((a, b) => b.length - a.length)[0];
  // Nur ein echtes Zuhause, wenn es einen klaren Schwerpunkt gibt.
  if (!best || best.length < points.length * 0.25) return undefined;
  return centroid(best);
}

// ---------------------------------------------------------------------------
// Ortsnamen über OpenStreetMap (Nominatim). Nur wenn in den Einstellungen
// eingeschaltet – dabei werden ausschließlich Koordinaten gesendet, keine Fotos.

const CACHE_KEY = "fotogeschichten.orte.v1";
let cache: Record<string, string> | undefined;
let queue: Promise<unknown> = Promise.resolve();

function loadCache(): Record<string, string> {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
  } catch {
    cache = {};
  }
  return cache!;
}

function saveCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache ?? {}));
  } catch {
    // Speicher nicht verfügbar – dann eben ohne Zwischenspeicher.
  }
}

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  country?: string;
  island?: string;
  natural?: string;
}

export function placeFromAddress(address: NominatimAddress): string | undefined {
  const local = address.city ?? address.town ?? address.village ?? address.municipality ?? address.island ?? address.natural;
  const region = address.county ?? address.state;
  if (local) return local;
  if (region) return region;
  return address.country;
}

/** Fragt höchstens eine Adresse pro Sekunde ab (Nutzungsregeln von Nominatim). */
export function reverseGeocode(point: GeoPoint): Promise<string | undefined> {
  const key = `${point.lat.toFixed(2)},${point.lon.toFixed(2)}`;
  const known = loadCache()[key];
  if (known !== undefined) return Promise.resolve(known || undefined);

  const task = queue.then(async () => {
    const again = loadCache()[key];
    if (again !== undefined) return again || undefined;
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=12&accept-language=de` +
      `&lat=${point.lat.toFixed(4)}&lon=${point.lon.toFixed(4)}`;
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return undefined;
      const json = (await res.json()) as { address?: NominatimAddress };
      const name = json.address ? placeFromAddress(json.address) : undefined;
      loadCache()[key] = name ?? "";
      saveCache();
      return name;
    } catch {
      return undefined;
    } finally {
      await new Promise((r) => setTimeout(r, 1100));
    }
  });
  queue = task.catch(() => undefined);
  return task;
}
