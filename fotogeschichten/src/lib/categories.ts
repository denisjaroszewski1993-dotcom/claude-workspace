import type { CategoryId, Photo } from "../types";

export interface CategoryDef {
  id: CategoryId;
  label: string;
  /** kurze Beschreibung, was darunter fällt */
  hint: string;
  /** Farbton (HSL-Hue) für Chips und Markierungen */
  hue: number;
  /** Ordnername beim Export */
  folder: string;
}

export const CATEGORIES: CategoryDef[] = [
  { id: "menschen", label: "Menschen", hint: "Porträts und Gruppen", hue: 12, folder: "Menschen" },
  { id: "tiere", label: "Tiere", hint: "Haustiere und Wildtiere", hue: 34, folder: "Tiere" },
  { id: "essen", label: "Essen & Trinken", hint: "Gerichte, Kaffee, Obst", hue: 48, folder: "Essen und Trinken" },
  { id: "strand", label: "Strand & Meer", hint: "Küste, Wasser, Stege", hue: 196, folder: "Strand und Meer" },
  { id: "berge", label: "Berge", hint: "Gipfel, Täler, Klippen", hue: 158, folder: "Berge" },
  { id: "natur", label: "Natur", hint: "Wald, Wiesen, Seen, Blumen", hue: 110, folder: "Natur" },
  { id: "stadt", label: "Stadt & Bauwerke", hint: "Straßen, Kirchen, Brücken", hue: 228, folder: "Stadt und Bauwerke" },
  { id: "unterwegs", label: "Unterwegs", hint: "Autos, Bahn, Boote, Flugzeuge", hue: 262, folder: "Unterwegs" },
  { id: "sport", label: "Sport & Freizeit", hint: "Ball, Ski, Baden, Zelten", hue: 140, folder: "Sport und Freizeit" },
  { id: "feier", label: "Feste & Abende", hint: "Feiern, Konzerte, Bars", hue: 318, folder: "Feste und Abende" },
  { id: "zuhause", label: "Zuhause", hint: "Innenräume und Möbel", hue: 24, folder: "Zuhause" },
  { id: "himmel", label: "Himmel & Abendrot", hint: "Sonnenauf- und -untergänge", hue: 8, folder: "Himmel und Abendrot" },
  { id: "nacht", label: "Nacht & Lichter", hint: "Dunkle Aufnahmen mit Lichtern", hue: 244, folder: "Nacht und Lichter" },
  { id: "winter", label: "Schnee & Winter", hint: "Schnee, Eis, Skifahren", hue: 204, folder: "Schnee und Winter" },
  { id: "dokumente", label: "Screenshots & Dokumente", hint: "Bildschirmfotos, Zettel, Bücher", hue: 210, folder: "Screenshots und Dokumente" },
  { id: "sonstiges", label: "Sonstiges", hint: "Nichts Eindeutiges erkannt", hue: 215, folder: "Sonstiges" },
];

export const CATEGORY_BY_ID: Record<CategoryId, CategoryDef> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, CategoryDef>;

export function categoryLabel(id: CategoryId): string {
  return CATEGORY_BY_ID[id]?.label ?? id;
}

/** Kategorien eines Fotos: manuelle Korrektur schlägt Automatik. */
export function effectiveCategories(photo: Photo): CategoryId[] {
  if (photo.manualCategories && photo.manualCategories.length > 0) return photo.manualCategories;
  if (photo.categories.length === 0) return photo.status === "fertig" ? ["sonstiges"] : [];
  return photo.categories.map((c) => c.id);
}

export function primaryCategory(photo: Photo): CategoryId {
  return effectiveCategories(photo)[0] ?? "sonstiges";
}
