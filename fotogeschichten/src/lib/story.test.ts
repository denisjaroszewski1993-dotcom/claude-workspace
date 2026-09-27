import { describe, expect, it } from "vitest";
import type { StoryStyle } from "../types";
import { findDuplicateGroups, groupsFromMarks } from "./duplicates";
import { createRandom } from "./random";
import { buildStory, selectPhotos } from "./story";
import { colorName, joinGerman } from "./storyText";
import { at, fakePhoto } from "./testing";

function tripPhotos() {
  return [
    fakePhoto({ takenAt: at(2025, 7, 12, 9, 30), cats: ["strand"], recognition: { labels: [{ index: 978, name: "seashore", prob: 0.9 }], objects: [] } }),
    fakePhoto({ takenAt: at(2025, 7, 12, 10, 0), cats: ["tiere", "strand"], recognition: { labels: [{ index: 207, name: "golden retriever", prob: 0.8 }], objects: [] } }),
    fakePhoto({ takenAt: at(2025, 7, 12, 15, 0), cats: ["essen"], recognition: { labels: [{ index: 963, name: "pizza", prob: 0.8 }], objects: [] } }),
    fakePhoto({
      takenAt: at(2025, 7, 12, 20, 45),
      cats: ["himmel"],
      recognition: { labels: [], objects: [{ name: "person", score: 0.9, area: 0.1 }, { name: "person", score: 0.8, area: 0.1 }, { name: "person", score: 0.8, area: 0.05 }] },
    }),
    fakePhoto({ takenAt: at(2025, 7, 13, 10, 0), cats: ["strand"] }),
  ];
}

describe("buildStory", () => {
  it.each<StoryStyle>(["erzaehlung", "maerchen", "tagebuch"])("schreibt eine vollständige Geschichte im Stil %s", (style) => {
    const story = buildStory({
      photos: tripPhotos(),
      source: { kind: "erlebnis", ref: "ev-1", label: "Am Meer" },
      style,
      length: "mittel",
      seed: 42,
    });
    // Vormittag, Nachmittag, Abend am ersten Tag, dann der zweite Tag
    expect(story.chapters.length).toBe(4);
    expect(story.title.length).toBeGreaterThan(3);
    expect(story.subtitle).toContain("5 Fotos");
    for (const chapter of story.chapters) {
      expect(chapter.text).toMatch(/[.!]$/);
      expect(chapter.text).not.toMatch(/undefined|\{|\}/);
      expect(chapter.photoIds.length).toBeGreaterThan(0);
    }
    const allText = story.chapters.map((c) => c.text).join(" ");
    expect(allText).toMatch(/Hund/);
  });

  it("fasst bei kurzen Geschichten Abschnitte desselben Tages zusammen", () => {
    const story = buildStory({
      photos: tripPhotos(),
      source: { kind: "erlebnis", ref: "ev-1", label: "Am Meer" },
      style: "erzaehlung",
      length: "kurz",
      seed: 3,
    });
    expect(story.chapters.length).toBe(3);
    // Der zweite Tag bleibt ein eigenes Kapitel.
    expect(story.chapters[2].photoIds).toHaveLength(1);
  });

  it("ist bei gleichem Startwert reproduzierbar", () => {
    const photos = tripPhotos();
    const opts = { photos, source: { kind: "erlebnis" as const, ref: "x", label: "x" }, style: "erzaehlung" as const, length: "lang" as const };
    const a = buildStory({ ...opts, seed: 7 });
    const b = buildStory({ ...opts, seed: 7 });
    expect(a.chapters.map((c) => c.text)).toEqual(b.chapters.map((c) => c.text));
    expect(a.title).toBe(b.title);
  });

  it("gliedert einen Jahresrückblick nach Monaten", () => {
    const photos = [1, 1, 3, 7, 7, 12].map((m, i) => fakePhoto({ takenAt: at(2024, m, 5 + i), cats: ["natur"] }));
    const story = buildStory({ photos, source: { kind: "jahr", ref: "2024", label: "2024" }, style: "erzaehlung", length: "lang", seed: 1 });
    expect(story.chapters.map((c) => c.heading)).toEqual(["Januar", "März", "Juli", "Dezember"]);
    expect(story.title).toBe("Unser Jahr 2024");
  });
});

describe("selectPhotos", () => {
  it("überspringt Duplikate und unscharfe Bilder, wenn es Alternativen gibt", () => {
    const good = fakePhoto({ takenAt: at(2025, 1, 1, 10), cats: ["natur"] });
    const blurry = fakePhoto({ takenAt: at(2025, 1, 1, 11), quality: { sharpness: 10, blurry: true, exposure: "ok", score: 0.2 } });
    const dup = fakePhoto({ takenAt: at(2025, 1, 1, 12), duplicateOf: good.id });
    const other = fakePhoto({ takenAt: at(2025, 1, 1, 13), cats: ["stadt"] });
    const chosen = selectPhotos([good, blurry, dup, other], 2, ["natur"]);
    expect(chosen.map((p) => p.id)).toEqual([good.id, other.id]);
  });
});

describe("findDuplicateGroups", () => {
  it("behält das beste Bild einer Gruppe", () => {
    const a = fakePhoto({ hash: "ffff0000ffff0000", quality: { sharpness: 400, blurry: false, exposure: "ok", score: 0.8 } });
    const b = fakePhoto({ hash: "ffff0000ffff0001", quality: { sharpness: 40, blurry: true, exposure: "ok", score: 0.3 } });
    const c = fakePhoto({ hash: "0000ffff0000ffff" });
    const groups = findDuplicateGroups([a, b, c]);
    expect(groups).toEqual([{ keepId: a.id, photoIds: [a.id, b.id] }]);
    // Aus den gespeicherten Markierungen ergibt sich dieselbe Gruppe
    expect(groupsFromMarks([a, { ...b, duplicateOf: a.id }, c])).toEqual(groups);
  });
});

describe("Duplikatsuche bei großen Mediatheken", () => {
  it("bleibt bei 20.000 Fotos schnell und findet Kopien und Serien", () => {
    const rnd = createRandom(1).next;
    const hex = () => Array.from({ length: 16 }, () => Math.floor(rnd() * 16).toString(16)).join("");
    const photos = Array.from({ length: 20_000 }, (_, i) => fakePhoto({ hash: hex(), takenAt: at(2020, 1, 1) + i * 3_600_000 }));
    // eine Kopie (1 Bit anders, anderes Datum) und eine Serie (8 Bit anders, 5 Sekunden später)
    const copy = fakePhoto({ hash: photos[100].hash!.slice(0, 15) + ((parseInt(photos[100].hash!.slice(15), 16) ^ 1).toString(16)), takenAt: at(2024, 1, 1) });
    const burst = fakePhoto({ hash: (BigInt("0x" + photos[500].hash!) ^ 0xffn).toString(16).padStart(16, "0"), takenAt: photos[500].takenAt! + 5000 });
    const started = performance.now();
    const groups = findDuplicateGroups([...photos, copy, burst]);
    const ms = performance.now() - started;
    const ids = groups.map((g) => [...g.photoIds].sort());
    expect(ids).toContainEqual([photos[100].id, copy.id].sort());
    expect(ids).toContainEqual([photos[500].id, burst.id].sort());
    expect(ms).toBeLessThan(5000);
  });
});

describe("Sprache", () => {
  it("benennt Farben und verbindet Aufzählungen", () => {
    expect(colorName("#2f6fd6")).toBe("Blau");
    expect(colorName("#f5f5f2")).toBe("Weiß");
    expect(colorName("#e08a2c")).toBe("Orange");
    expect(joinGerman(["Blau", "Grün", "Sand"])).toBe("Blau, Grün und Sand");
  });
});
