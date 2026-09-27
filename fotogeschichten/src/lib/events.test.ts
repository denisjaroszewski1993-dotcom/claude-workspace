import { describe, expect, it } from "vitest";
import { buildEvents, formatRange } from "./events";
import { at, fakePhoto } from "./testing";

const coast = { lat: 54.51, lon: 13.64 };
const alps = { lat: 47.42, lon: 11.06 };

describe("buildEvents", () => {
  it("trennt bei langen Pausen und fasst mehrtägige Aufenthalte zusammen", () => {
    const photos = [
      fakePhoto({ takenAt: at(2025, 7, 12, 10), gps: coast, cats: ["strand"] }),
      fakePhoto({ takenAt: at(2025, 7, 12, 16), gps: coast, cats: ["strand"] }),
      fakePhoto({ takenAt: at(2025, 7, 13, 9), gps: coast, cats: ["essen"] }),
      fakePhoto({ takenAt: at(2025, 8, 9, 9), gps: alps, cats: ["berge"] }),
      fakePhoto({ takenAt: at(2025, 8, 9, 12), gps: alps, cats: ["berge"] }),
    ];
    const events = buildEvents(photos, { gapHours: 8 });
    expect(events).toHaveLength(2);
    const [berge, meer] = events; // neueste zuerst
    expect(berge.title).toBe("In den Bergen");
    expect(meer.kind).toBe("reise");
    expect(meer.days).toBe(2);
    expect(meer.photoIds).toHaveLength(3);
    expect(meer.topCategories[0].id).toBe("strand");
  });

  it("trennt ohne GPS nur nach Zeit und sammelt Fotos ohne Datum", () => {
    const photos = [
      fakePhoto({ takenAt: at(2025, 1, 1, 10) }),
      fakePhoto({ takenAt: at(2025, 1, 1, 11) }),
      fakePhoto({ takenAt: at(2025, 1, 2, 10) }),
      fakePhoto({}),
    ];
    const events = buildEvents(photos, { gapHours: 8 });
    expect(events.map((e) => e.photoIds.length)).toEqual([1, 2, 1]);
    expect(events[2].kind).toBe("ohne-datum");
  });

  it("lässt aussortierte Fotos weg", () => {
    const events = buildEvents([fakePhoto({ takenAt: at(2025, 1, 1), excluded: true })], { gapHours: 8 });
    expect(events).toHaveLength(0);
  });
});

describe("formatRange", () => {
  it("formatiert Zeiträume lesbar", () => {
    expect(formatRange(at(2025, 7, 12), at(2025, 7, 13))).toBe("12.–13. Juli 2025");
    expect(formatRange(at(2025, 7, 30), at(2025, 8, 2))).toBe("30. Juli – 2. August 2025");
    expect(formatRange(at(2025, 7, 12, 9), at(2025, 7, 12, 20))).toBe("Samstag, 12. Juli 2025");
  });
});
