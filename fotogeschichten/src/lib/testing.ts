import type { CategoryId, Photo } from "../types";

// Hilfen für die Tests: künstliche Fotos und Pixeldaten.

let counter = 0;

export function fakePhoto(overrides: Partial<Photo> & { cats?: CategoryId[] } = {}): Photo {
  counter++;
  const { cats, ...rest } = overrides;
  return {
    id: `p${counter}`,
    file: undefined as unknown as File,
    name: `IMG_${counter}.jpg`,
    size: 1000 + counter,
    type: "image/jpeg",
    lastModified: 0,
    source: "eigene",
    status: "fertig",
    categories: (cats ?? ["sonstiges"]).map((id, i) => ({ id, score: 0.9 - i * 0.2, reasons: [] })),
    quality: { sharpness: 300, blurry: false, exposure: "ok", score: 0.7 },
    hash: counter.toString(16).padStart(16, "0"),
    ...rest,
  };
}

export function solidImage(width: number, height: number, rgb: [number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
    data[i + 3] = 255;
  }
  return { data, width, height };
}

export function imageFrom(width: number, height: number, fn: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fn(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

export const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
