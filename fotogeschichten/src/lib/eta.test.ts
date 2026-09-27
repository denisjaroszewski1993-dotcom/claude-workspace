import { describe, expect, it } from "vitest";
import { remaining } from "./eta";

describe("remaining", () => {
  it("schweigt, solange zu wenig gemessen wurde", () => {
    expect(remaining({ at: 0, done: 0 }, 2000, 5, 100)).toBeUndefined();
    expect(remaining({ at: 0, done: 4 }, 10_000, 5, 100)).toBeUndefined();
  });

  it("rechnet mit dem Tempo seit dem ersten fertigen Foto", () => {
    // 10 Fotos in 10 s → 1 s pro Foto, 590 übrig → ca. 10 Minuten
    expect(remaining({ at: 0, done: 0 }, 10_000, 10, 600)).toBe("noch ca. 10 Min.");
    expect(remaining({ at: 0, done: 0 }, 10_000, 10, 50)).toBe("gleich fertig");
    // 20.000 Fotos bei 0,5 s pro Foto → ca. 2,8 Stunden
    expect(remaining({ at: 0, done: 0 }, 10_000, 20, 20_000)).toBe("noch ca. 2,8 Std.");
  });
});
