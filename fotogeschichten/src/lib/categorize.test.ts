import { describe, expect, it } from "vitest";
import { categorize, looksLikeScreenshot } from "./categorize";
import { analyzeColors } from "./pixels";
import { imageFrom } from "./testing";

const base = { name: "IMG_1.jpg", type: "image/jpeg", hasCameraExif: true };

describe("categorize", () => {
  it("ordnet eine erkannte Küste dem Strand zu und nennt den Grund", () => {
    const result = categorize({
      ...base,
      recognition: { labels: [{ index: 978, name: "seashore", prob: 0.8 }], objects: [] },
    });
    expect(result[0].id).toBe("strand");
    expect(result[0].reasons[0]).toContain("Küste");
  });

  it("erkennt Hunde über die Rasse und Menschen über die Objekterkennung", () => {
    const result = categorize({
      ...base,
      recognition: {
        labels: [{ index: 207, name: "golden retriever", prob: 0.7 }],
        objects: [
          { name: "person", score: 0.9, area: 0.2 },
          { name: "dog", score: 0.8, area: 0.15 },
        ],
      },
    });
    const ids = result.map((r) => r.id);
    expect(ids).toContain("tiere");
    expect(ids).toContain("menschen");
  });

  it("ignoriert winzige Passanten im Hintergrund", () => {
    const result = categorize({
      ...base,
      recognition: { labels: [{ index: 497, name: "church", prob: 0.6 }], objects: [{ name: "person", score: 0.7, area: 0.005 }] },
    });
    expect(result.map((r) => r.id)).not.toContain("menschen");
    expect(result[0].id).toBe("stadt");
  });

  it("findet Abendrot allein über die Farben", () => {
    const colors = analyzeColors(imageFrom(40, 40, (_x, y) => (y < 14 ? [250, 110, 40] : [60, 40, 50])));
    expect(categorize({ ...base, colors })[0].id).toBe("himmel");
  });

  it("fällt auf 'Sonstiges' zurück, wenn nichts eindeutig ist", () => {
    expect(categorize(base)).toEqual([{ id: "sonstiges", score: 1, reasons: ["Kein eindeutiges Motiv erkannt"] }]);
  });

  it("erkennt Bildschirmfotos", () => {
    const input = { name: "IMG_0001.PNG", type: "image/png", width: 1170, height: 2532, hasCameraExif: false };
    expect(looksLikeScreenshot(input)).toBe(true);
    expect(categorize(input)[0].id).toBe("dokumente");
    expect(looksLikeScreenshot({ ...input, hasCameraExif: true })).toBe(false);
  });
});
