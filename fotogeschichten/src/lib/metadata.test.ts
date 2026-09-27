import { describe, expect, it } from "vitest";
import { dateFromFilename } from "./metadata";
import { at } from "./testing";

describe("dateFromFilename", () => {
  it.each([
    ["IMG_20240714_153012.jpg", at(2024, 7, 14, 15, 30) + 12_000],
    ["PXL_20231224_183005123.jpg", at(2023, 12, 24, 18, 30) + 5_000],
    ["WhatsApp Image 2024-07-14 at 15.30.12.jpeg", at(2024, 7, 14, 15, 30) + 12_000],
    ["Bildschirmfoto 2024-03-02 um 09.05.44.png", at(2024, 3, 2, 9, 5) + 44_000],
    ["IMG-20240714-WA0012.jpg", at(2024, 7, 14, 12, 0)],
  ])("liest %s", (name, expected) => {
    expect(dateFromFilename(name)).toBe(expected);
  });

  it("ignoriert Dateinamen ohne Datum und unmögliche Daten", () => {
    expect(dateFromFilename("Urlaub am See.jpg")).toBeUndefined();
    expect(dateFromFilename("IMG_1234.JPG")).toBeUndefined();
    expect(dateFromFilename("IMG_20240231_101010.jpg")).toBeUndefined();
  });
});
