import { describe, expect, it } from "vitest";
import { buildEvents } from "./events";
import { planAlbums, planExport } from "./exporter";
import { at, fakePhoto } from "./testing";

const native = (id: string) => ({ id, screenshot: false, favorite: false });

describe("planExport", () => {
  it("legt Kopien nach Kategorie ab und trennt Aussortiertes", () => {
    const a = fakePhoto({ name: "IMG_1.jpg", takenAt: at(2025, 7, 12, 10, 14), cats: ["strand"] });
    const b = fakePhoto({ name: "IMG_1.jpg", takenAt: at(2025, 7, 12, 10, 14), cats: ["strand"] });
    const c = fakePhoto({ name: "IMG_2.jpg", takenAt: at(2025, 7, 12, 11), cats: ["essen"], duplicateOf: a.id });
    const entries = planExport([a, b, c], [], { structure: "kategorie", datePrefix: true, includeSorted: true });
    expect(entries.map((e) => e.path)).toEqual([
      "Strand und Meer/2025-07-12 10.14.00 IMG_1.jpg",
      "Strand und Meer/2025-07-12 10.14.00 IMG_1 (2).jpg",
      "_Aussortiert/Doppelte/2025-07-12 11.00.00 IMG_2.jpg",
    ]);
  });
});

describe("planAlbums", () => {
  it("fasst Mediathek-Fotos zu Alben zusammen und lässt Dateien weg", () => {
    const photos = [
      fakePhoto({ takenAt: at(2025, 7, 12, 10), cats: ["strand"], native: native("A") }),
      fakePhoto({ takenAt: at(2025, 7, 12, 11), cats: ["strand"], native: native("B") }),
      fakePhoto({ takenAt: at(2025, 8, 9, 9), cats: ["berge"], native: native("C") }),
      fakePhoto({ takenAt: at(2025, 8, 9, 10), cats: ["berge"], native: native("D"), excluded: true }),
      fakePhoto({ takenAt: at(2025, 8, 9, 11), cats: ["berge"] }), // Datei, nicht aus der Mediathek
    ];
    const prefix = "Fotogeschichten · ";
    expect(planAlbums(photos, [], { structure: "kategorie", includeSorted: true }, prefix)).toEqual([
      { title: "Fotogeschichten · Aussortiert", ids: ["D"] },
      { title: "Fotogeschichten · Berge", ids: ["C"] },
      { title: "Fotogeschichten · Strand und Meer", ids: ["A", "B"] },
    ]);
    const byEvent = planAlbums(photos, buildEvents(photos, { gapHours: 8 }), { structure: "erlebnis", includeSorted: false }, prefix);
    expect(byEvent.map((a) => a.title)).toEqual(["Fotogeschichten · 2025-07-12 Am Meer", "Fotogeschichten · 2025-08-09 In den Bergen"]);
    expect(planAlbums(photos, [], { structure: "datum", includeSorted: false }, prefix).map((a) => a.title)).toEqual([
      "Fotogeschichten · 2025 › 07 Juli",
      "Fotogeschichten · 2025 › 08 August",
    ]);
  });
});
