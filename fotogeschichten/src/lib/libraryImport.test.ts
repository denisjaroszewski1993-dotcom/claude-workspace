import { describe, expect, it } from "vitest";
import { albumScope, assetToPhoto, catchUpScope, mergeScopes, rangeScope, rememberScope, savedScopes } from "./libraryImport";

describe("assetToPhoto", () => {
  it("übernimmt Datum, Ort und Kennzeichen aus der Mediathek", () => {
    const photo = assetToPhoto({
      id: "ABC/L0/001",
      fileName: "IMG_4711.HEIC",
      width: 4032,
      height: 3024,
      isFavorite: true,
      isScreenshot: false,
      creationDate: 1_752_300_000_000,
      latitude: 54.5,
      longitude: 13.6,
    });
    expect(photo).toMatchObject({
      id: "n-ABC/L0/001",
      name: "IMG_4711.HEIC",
      takenAt: 1_752_300_000_000,
      dateSource: "mediathek",
      gps: { lat: 54.5, lon: 13.6 },
      native: { id: "ABC/L0/001", favorite: true, screenshot: false },
      status: "wartet",
    });
    expect(photo.file).toBeUndefined();
  });

  it("benennt Fotos ohne Dateinamen nach dem Aufnahmedatum", () => {
    const at = new Date(2025, 6, 12, 10, 14).getTime();
    expect(assetToPhoto({ id: "Y", width: 1, height: 1, isFavorite: false, isScreenshot: false, creationDate: at }).name).toBe("Foto vom 12.07.2025, 10:14");
    expect(assetToPhoto({ id: "Z", width: 1, height: 1, isFavorite: false, isScreenshot: false }).name).toBe("Foto ohne Datum");
  });

  it("lässt fehlende Angaben leer", () => {
    const photo = assetToPhoto({ id: "X", fileName: "a.png", width: 1, height: 1, isFavorite: false, isScreenshot: true });
    expect(photo.takenAt).toBeUndefined();
    expect(photo.gps).toBeUndefined();
    expect(photo.native?.screenshot).toBe(true);
  });
});

describe("Zeiträume", () => {
  it("rechnet Zeiträume und das spätere Nachladen", () => {
    const now = Date.UTC(2026, 8, 27);
    expect(rangeScope("30-tage", now).since).toBe(now - 30 * 24 * 3600_000);
    expect(rangeScope("alles", now).since).toBeUndefined();
    const photos = [assetToPhoto({ id: "1", fileName: "a", width: 1, height: 1, isFavorite: false, isScreenshot: false, creationDate: now - 5000 })];
    expect(catchUpScope(rangeScope("alles", now), photos).since).toBe(now - 5000 - 60_000);
  });
});

describe("gemerkte Bereiche", () => {
  const now = Date.UTC(2026, 8, 27);
  const alles = rangeScope("alles", now);
  const monat = rangeScope("30-tage", now);
  const jahr = rangeScope("12-monate", now);
  const ostsee = albumScope("A1", "Ostsee");

  it("„Alle Fotos“ schließt alles andere ein", () => {
    expect(mergeScopes([monat, ostsee], alles)).toEqual([alles]);
    expect(mergeScopes([alles], ostsee)).toEqual([alles]);
    expect(mergeScopes([alles], monat)).toEqual([alles]);
  });

  it("ein längerer Zeitraum ersetzt einen kürzeren, Alben kommen dazu", () => {
    expect(mergeScopes([monat], jahr)).toEqual([jahr]);
    expect(mergeScopes([jahr], monat)).toEqual([jahr]);
    expect(mergeScopes([jahr], ostsee)).toEqual([jahr, ostsee]);
    expect(mergeScopes([jahr, ostsee], ostsee)).toEqual([jahr, ostsee]);
  });

  it("Alben werden beim Nachladen ganz gelesen", () => {
    const photos = [assetToPhoto({ id: "1", fileName: "a", width: 1, height: 1, isFavorite: false, isScreenshot: false, creationDate: now })];
    expect(catchUpScope(ostsee, photos)).toEqual(ostsee);
  });

  it("liest auch den früheren Einzelwert", () => {
    const store = new Map<string, string>();
    const fake = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", { value: fake, configurable: true });
    try {
      store.set("fotogeschichten.mediathek.v1", JSON.stringify(monat));
      expect(savedScopes()).toEqual([monat]);
      rememberScope(ostsee);
      expect(savedScopes()).toEqual([monat, ostsee]);
    } finally {
      Object.defineProperty(globalThis, "localStorage", { value: original, configurable: true });
    }
  });
});
