import type { CategoryId, GeoPoint, Photo, PhotoEvent } from "../types";
import { effectiveCategories } from "./categories";
import { centroid, distanceKm, homeLocation } from "./geo";

// Gruppiert Fotos zu "Erlebnissen": Fotos, die zeitlich dicht beieinander
// liegen, gehören zusammen. Mehrtägige Aufenthalte am selben Ort (fern von
// zu Hause) werden zu einer Reise zusammengefasst.

export interface EventOptions {
  gapHours: number;
}

const HOUR = 3600_000;

const THEME: Record<CategoryId, string> = {
  strand: "Am Meer",
  berge: "In den Bergen",
  natur: "Draußen im Grünen",
  stadt: "Unterwegs in der Stadt",
  unterwegs: "Auf Achse",
  feier: "Ein Abend voller Leben",
  essen: "Gutes Essen",
  tiere: "Tierische Begegnungen",
  menschen: "Gemeinsame Zeit",
  sport: "In Bewegung",
  zuhause: "Zuhause",
  himmel: "Abendrot",
  nacht: "Lichter der Nacht",
  winter: "Winterzeit",
  dokumente: "Notizen und Bildschirme",
  sonstiges: "Momente",
};

export function themeTitle(id: CategoryId): string {
  return THEME[id];
}

export function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function countCategories(photos: Photo[]): { id: CategoryId; count: number }[] {
  const counts = new Map<CategoryId, number>();
  for (const p of photos) {
    // Hauptkategorie zählt voll, Nebenkategorien halb.
    effectiveCategories(p).forEach((id, i) => counts.set(id, (counts.get(id) ?? 0) + (i === 0 ? 1 : 0.5)));
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count);
}

function mostCommon(values: (string | undefined)[]): string | undefined {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

interface Cluster {
  photos: Photo[];
  center?: GeoPoint;
}

function clusterCenter(photos: Photo[]): GeoPoint | undefined {
  return centroid(photos.map((p) => p.gps).filter((g): g is GeoPoint => !!g));
}

export function buildEvents(allPhotos: Photo[], options: EventOptions): PhotoEvent[] {
  const photos = allPhotos.filter((p) => !p.excluded && p.status === "fertig");
  const dated = photos.filter((p) => p.takenAt !== undefined).sort((a, b) => a.takenAt! - b.takenAt!);
  const undated = photos.filter((p) => p.takenAt === undefined);
  const gap = Math.max(1, options.gapHours) * HOUR;

  // 1. Zeitliche Lücken (und große Ortswechsel) trennen
  const clusters: Cluster[] = [];
  let current: Photo[] = [];
  for (const photo of dated) {
    const prev = current[current.length - 1];
    if (prev) {
      const dt = photo.takenAt! - prev.takenAt!;
      const moved = prev.gps && photo.gps && dt > HOUR && distanceKm(prev.gps, photo.gps) > 30;
      if (dt > gap || moved) {
        clusters.push({ photos: current });
        current = [];
      }
    }
    current.push(photo);
  }
  if (current.length) clusters.push({ photos: current });
  for (const c of clusters) c.center = clusterCenter(c.photos);

  // 2. Aufeinanderfolgende Tage am selben Ort zusammenfassen (Reisen)
  const allPoints = dated.map((p) => p.gps).filter((g): g is GeoPoint => !!g);
  const home = allPoints.length >= 40 ? homeLocation(allPoints) : undefined;
  const merged: Cluster[] = [];
  for (const c of clusters) {
    const last = merged[merged.length - 1];
    if (last && last.center && c.center) {
      const lastEnd = last.photos[last.photos.length - 1].takenAt!;
      const dt = c.photos[0].takenAt! - lastEnd;
      const sameArea = distanceKm(last.center, c.center) < 40;
      const awayFromHome = !home || (distanceKm(home, c.center) > 50 && distanceKm(home, last.center) > 50);
      if (dt < 30 * HOUR && sameArea && awayFromHome) {
        last.photos.push(...c.photos);
        last.center = clusterCenter(last.photos);
        continue;
      }
    }
    merged.push({ ...c, photos: [...c.photos] });
  }

  const events: PhotoEvent[] = merged.map((c) => {
    const start = c.photos[0].takenAt!;
    const end = c.photos[c.photos.length - 1].takenAt!;
    const days = new Set(c.photos.map((p) => dayKey(p.takenAt!))).size;
    const top = countCategories(c.photos);
    const place = mostCommon(c.photos.map((p) => p.place));
    const theme = themeTitle(top[0]?.id ?? "sonstiges");
    return {
      id: `ev-${start}`,
      kind: days >= 2 ? "reise" : "erlebnis",
      photoIds: c.photos.map((p) => p.id),
      start,
      end,
      days,
      center: c.center,
      place,
      title: place ? `${theme} · ${place}` : theme,
      topCategories: top.slice(0, 4),
    };
  });

  if (undated.length) {
    events.push({
      id: "ev-ohne-datum",
      kind: "ohne-datum",
      photoIds: undated.map((p) => p.id),
      days: 0,
      title: "Fotos ohne Datum",
      topCategories: countCategories(undated).slice(0, 4),
    });
  }
  // Neueste zuerst
  return events.sort((a, b) => (b.start ?? 0) - (a.start ?? 0));
}

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

export function monthName(month: number): string {
  return MONTHS[month];
}

export function weekdayName(t: number): string {
  return WEEKDAYS[new Date(t).getDay()];
}

export function formatDate(t: number, withWeekday = false): string {
  const d = new Date(t);
  const base = `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return withWeekday ? `${WEEKDAYS[d.getDay()]}, ${base}` : base;
}

export function formatTime(t: number): string {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} Uhr`;
}

export function formatRange(start?: number, end?: number): string {
  if (start === undefined) return "ohne Datum";
  if (end === undefined || dayKey(start) === dayKey(end)) return formatDate(start, true);
  const a = new Date(start);
  const b = new Date(end);
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    return `${a.getDate()}.–${b.getDate()}. ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  }
  if (a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()}. ${MONTHS[a.getMonth()]} – ${b.getDate()}. ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  }
  return `${formatDate(start)} – ${formatDate(end)}`;
}
