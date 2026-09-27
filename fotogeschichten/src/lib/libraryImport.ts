import type { Photo } from "../types";
import type { NativeAsset } from "./nativeLibrary";

// Übersetzt Einträge der iPhone-Mediathek in Fotos der App und merkt sich,
// was zuletzt eingelesen wurde, damit die App beim nächsten Start von selbst
// auf dem aktuellen Stand ist.

export interface LibraryScope {
  kind: "alles" | "zeitraum" | "album";
  /** im Dativ, für Sätze wie „12 Fotos aus den letzten 30 Tagen“ */
  label: string;
  /** nur Fotos ab diesem Zeitpunkt (ms) */
  since?: number;
  albumId?: string;
}

/** „Foto vom 12.07.2025, 10:14“ – Mediathek-Fotos kommen ohne Dateinamen. */
export function nativeName(creationDate?: number): string {
  if (creationDate === undefined) return "Foto ohne Datum";
  const d = new Date(creationDate);
  const two = (n: number) => String(n).padStart(2, "0");
  return `Foto vom ${two(d.getDate())}.${two(d.getMonth() + 1)}.${d.getFullYear()}, ${two(d.getHours())}:${two(d.getMinutes())}`;
}

export function assetToPhoto(a: NativeAsset): Photo {
  const hasGps = typeof a.latitude === "number" && typeof a.longitude === "number";
  return {
    id: `n-${a.id}`,
    name: a.fileName ?? nativeName(a.creationDate),
    size: 0,
    type: "image/jpeg",
    lastModified: a.creationDate ?? 0,
    source: "eigene",
    status: "wartet",
    categories: [],
    native: { id: a.id, screenshot: a.isScreenshot, favorite: a.isFavorite },
    width: a.width,
    height: a.height,
    takenAt: a.creationDate,
    dateSource: a.creationDate !== undefined ? "mediathek" : undefined,
    gps: hasGps ? { lat: a.latitude!, lon: a.longitude! } : undefined,
  };
}

const DAY = 24 * 3600_000;

/** Die Auswahl im Import-Dialog. */
export function rangeScope(range: "30-tage" | "12-monate" | "alles", now = Date.now()): LibraryScope {
  if (range === "30-tage") return { kind: "zeitraum", label: "den letzten 30 Tagen", since: now - 30 * DAY };
  if (range === "12-monate") return { kind: "zeitraum", label: "den letzten 12 Monaten", since: now - 365 * DAY };
  return { kind: "alles", label: "der ganzen Mediathek" };
}

/** Beim späteren Aktualisieren genügt es, ab dem neuesten bekannten Foto zu suchen. */
export function catchUpScope(scope: LibraryScope, photos: Photo[]): LibraryScope {
  // Alben ganz lesen: Dort landen oft auch ältere Fotos nachträglich.
  if (scope.kind === "album") return scope;
  // Schleife statt Math.max(...): Safari verträgt nur begrenzt viele Argumente.
  let newest = 0;
  for (const p of photos) if (p.native && p.takenAt !== undefined && p.takenAt > newest) newest = p.takenAt;
  if (!newest) return scope;
  // eine Minute Puffer für Fotos mit gleicher Uhrzeit
  return { ...scope, since: Math.max(scope.since ?? 0, newest - 60_000) };
}

/**
 * Was die App beim nächsten Start wieder einliest. „Alle Fotos“ schließt alles
 * andere ein, ein längerer Zeitraum ersetzt einen kürzeren, Alben kommen dazu.
 */
export function mergeScopes(saved: LibraryScope[], scope: LibraryScope): LibraryScope[] {
  if (scope.kind === "alles") return [scope];
  if (saved.some((s) => s.kind === "alles")) return saved;
  if (scope.kind === "album") return saved.some((s) => s.albumId === scope.albumId) ? saved : [...saved, scope];
  const range = saved.find((s) => s.kind === "zeitraum");
  if (range && (range.since ?? 0) <= (scope.since ?? 0)) return saved;
  return [...saved.filter((s) => s.kind !== "zeitraum"), scope];
}

const KEY = "fotogeschichten.mediathek.v1";

export function savedScopes(): LibraryScope[] {
  try {
    const raw = localStorage.getItem(KEY);
    const value: unknown = raw ? JSON.parse(raw) : [];
    // Anfangs stand hier ein einzelner Bereich statt einer Liste.
    return (Array.isArray(value) ? value : [value]).filter((s): s is LibraryScope => typeof s?.kind === "string");
  } catch {
    return [];
  }
}

export function rememberScope(scope: LibraryScope) {
  try {
    localStorage.setItem(KEY, JSON.stringify(mergeScopes(savedScopes(), scope)));
  } catch {
    // ohne Speicher eben ohne automatische Aktualisierung
  }
}

export function forgetScopes() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // egal
  }
}

export function albumScope(id: string, title: string): LibraryScope {
  return { kind: "album", label: `dem Album „${title}“`, albumId: id };
}
