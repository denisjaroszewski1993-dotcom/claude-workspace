import { describe, expect, it } from "vitest";
import { analyzeColors, assessQuality, dHash, hammingDistance, laplacianVariance, toGray } from "./pixels";
import { imageFrom, solidImage } from "./testing";

describe("analyzeColors", () => {
  it("erkennt einen blauen Himmel über grüner Wiese", () => {
    const img = imageFrom(60, 60, (_x, y) => (y < 30 ? [70, 130, 220] : [60, 160, 50]));
    const c = analyzeColors(img);
    expect(c.shares.blue).toBeGreaterThan(0.45);
    expect(c.shares.green).toBeGreaterThan(0.45);
    expect(c.sky.blue).toBe(1);
    expect(c.palette.length).toBe(2);
  });

  it("misst warmes Abendlicht im oberen Drittel", () => {
    const img = imageFrom(60, 60, (_x, y) => (y < 20 ? [240, 120, 40] : [40, 30, 50]));
    const c = analyzeColors(img);
    expect(c.sky.warm).toBe(1);
    expect(c.warmth).toBeGreaterThan(0.2);
  });

  it("behandelt schwarze Bilder als dunkel", () => {
    const c = analyzeColors(solidImage(20, 20, [5, 5, 8]));
    expect(c.brightness).toBeLessThan(0.05);
    expect(c.shares.dark).toBe(1);
    expect(assessQuality(500, c).exposure).toBe("dunkel");
  });
});

describe("Schärfe", () => {
  const checker = imageFrom(64, 64, (x, y) => ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 ? [255, 255, 255] : [0, 0, 0]));
  const gradient = imageFrom(64, 64, (x) => [x * 4, x * 4, x * 4]);

  it("bewertet harte Kanten schärfer als weiche Verläufe", () => {
    const sharp = laplacianVariance(toGray(checker), 64, 64);
    const soft = laplacianVariance(toGray(gradient), 64, 64);
    expect(sharp).toBeGreaterThan(1000);
    expect(soft).toBeLessThan(5);
  });
});

describe("dHash", () => {
  it("ist für gleiche Bilder identisch und für andere verschieden", () => {
    const a = imageFrom(90, 80, (x, y) => [x * 2, y * 3, 100]);
    const b = imageFrom(180, 160, (x, y) => [x, Math.floor(y * 1.5), 100]); // gleiche Szene, doppelte Größe
    const c = imageFrom(90, 80, (x, y) => [255 - x * 2, 255 - y * 3, 100]);
    const ha = dHash(toGray(a), 90, 80);
    const hb = dHash(toGray(b), 180, 160);
    const hc = dHash(toGray(c), 90, 80);
    expect(ha).toHaveLength(16);
    expect(hammingDistance(ha, hb)).toBeLessThanOrEqual(4);
    expect(hammingDistance(ha, hc)).toBeGreaterThan(30);
  });
});
