import type { ColorInfo, PaletteColor, QualityInfo } from "../types";

// Reine Rechenfunktionen auf Pixeldaten (RGBA, wie ImageData). Sie kennen
// weder DOM noch Canvas und lassen sich deshalb direkt testen.

export interface PixelData {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

export function rgbToHsv(r: number, g: number, b: number): [h: number, s: number, v: number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

export function toHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function luma(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

interface Bin {
  n: number;
  r: number;
  g: number;
  b: number;
}

/** Helligkeit, Sättigung, Farbtemperatur, Farbanteile und dominante Farben. */
export function analyzeColors(img: PixelData): ColorInfo {
  const { data, width, height } = img;
  const skyRows = Math.max(1, Math.floor(height / 3));
  const bins = new Map<number, Bin>();
  let n = 0;
  let sumL = 0;
  let sumL2 = 0;
  let sumS = 0;
  let sumWarm = 0;
  const count = { green: 0, blue: 0, white: 0, warm: 0, dark: 0, bright: 0 };
  let skyN = 0;
  let skyWarm = 0;
  let skyBlue = 0;
  let skyL = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const [h, s, v] = rgbToHsv(r, g, b);
      const l = luma(r, g, b);
      n++;
      sumL += l;
      sumL2 += l * l;
      sumS += s;
      sumWarm += (r - b) / 255;

      const isGreen = h >= 65 && h <= 170 && s > 0.2 && v > 0.18;
      const isBlue = h >= 180 && h <= 255 && s > 0.18 && v > 0.25;
      const isWhite = s < 0.12 && v > 0.82;
      const isWarm = (h < 50 || h > 320) && s > 0.35 && v > 0.3;
      if (isGreen) count.green++;
      if (isBlue) count.blue++;
      if (isWhite) count.white++;
      if (isWarm) count.warm++;
      if (v < 0.15) count.dark++;
      if (v > 0.92 && s < 0.35) count.bright++;

      if (y < skyRows) {
        skyN++;
        skyL += l;
        if (isWarm) skyWarm++;
        if (isBlue) skyBlue++;
      }

      // 4 Bit pro Kanal -> 4096 Farbfächer
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const bin = bins.get(key);
      if (bin) {
        bin.n++;
        bin.r += r;
        bin.g += g;
        bin.b += b;
      } else {
        bins.set(key, { n: 1, r, g, b });
      }
    }
  }

  if (n === 0) {
    return {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      warmth: 0,
      palette: [],
      shares: { green: 0, blue: 0, white: 0, warm: 0, dark: 0, bright: 0 },
      sky: { warm: 0, blue: 0, brightness: 0 },
    };
  }

  const mean = sumL / n;
  const variance = Math.max(0, sumL2 / n - mean * mean);
  return {
    brightness: mean,
    contrast: Math.sqrt(variance),
    saturation: sumS / n,
    warmth: Math.max(-1, Math.min(1, (sumWarm / n) * 2.5)),
    palette: buildPalette([...bins.values()], n),
    shares: {
      green: count.green / n,
      blue: count.blue / n,
      white: count.white / n,
      warm: count.warm / n,
      dark: count.dark / n,
      bright: count.bright / n,
    },
    sky: {
      warm: skyN ? skyWarm / skyN : 0,
      blue: skyN ? skyBlue / skyN : 0,
      brightness: skyN ? skyL / skyN : 0,
    },
  };
}

function buildPalette(bins: Bin[], total: number): PaletteColor[] {
  const sorted = bins
    .map((b) => ({ n: b.n, r: b.r / b.n, g: b.g / b.n, b: b.b / b.n }))
    .sort((a, b) => b.n - a.n);
  const merged: { n: number; r: number; g: number; b: number }[] = [];
  for (const c of sorted) {
    const near = merged.find((m) => Math.hypot(m.r - c.r, m.g - c.g, m.b - c.b) < 48);
    if (near) {
      const w = near.n + c.n;
      near.r = (near.r * near.n + c.r * c.n) / w;
      near.g = (near.g * near.n + c.g * c.n) / w;
      near.b = (near.b * near.n + c.b * c.n) / w;
      near.n = w;
    } else if (merged.length < 24) {
      merged.push({ ...c });
    }
  }
  return merged
    .sort((a, b) => b.n - a.n)
    .filter((c) => c.n / total >= 0.03)
    .slice(0, 5)
    .map((c) => ({ hex: toHex(c.r, c.g, c.b), share: c.n / total }));
}

/** Graustufen (0..255) als Float32Array. */
export function toGray(img: PixelData): Float32Array {
  const { data, width, height } = img;
  const out = new Float32Array(width * height);
  for (let p = 0, i = 0; p < out.length; p++, i += 4) {
    out[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }
  return out;
}

/**
 * Varianz des Laplace-Operators – ein etabliertes Maß für Schärfe. Unscharfe
 * Bilder haben kaum harte Kanten, die Varianz ist dann niedrig.
 */
export function laplacianVariance(gray: Float32Array, width: number, height: number): number {
  if (width < 3 || height < 3) return 0;
  let sum = 0;
  let sum2 = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const v = gray[i - width] + gray[i + width] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      sum += v;
      sum2 += v * v;
      n++;
    }
  }
  const mean = sum / n;
  return sum2 / n - mean * mean;
}

/** Schärfeschwelle für ein auf 512 px (lange Seite) verkleinertes Bild. */
export const BLUR_THRESHOLD = 60;

export function assessQuality(sharpness: number, colors: ColorInfo): QualityInfo {
  let exposure: QualityInfo["exposure"] = "ok";
  if (colors.brightness < 0.16 && colors.shares.dark > 0.55) exposure = "dunkel";
  else if (colors.brightness > 0.86 && colors.shares.bright > 0.5) exposure = "hell";

  const blurry = sharpness < BLUR_THRESHOLD;
  // Schärfe logarithmisch bewerten: 60 -> ~0.35, 250 -> ~0.65, 1000+ -> 1
  const sharpScore = Math.max(0, Math.min(1, Math.log10(Math.max(1, sharpness)) / 3));
  const exposureScore = exposure === "ok" ? 1 : 0.45;
  const contrastScore = Math.max(0, Math.min(1, colors.contrast / 0.22));
  const colorScore = Math.max(0.4, Math.min(1, 0.4 + colors.saturation));
  const score = 0.45 * sharpScore + 0.25 * exposureScore + 0.15 * contrastScore + 0.15 * colorScore;
  return { sharpness, blurry, exposure, score: Math.round(score * 1000) / 1000 };
}

/**
 * Differenz-Hash (dHash): Das Bild wird auf 9×8 Felder gemittelt, dann wird
 * jedes Feld mit seinem rechten Nachbarn verglichen. Ergebnis: 64 Bit als
 * 16 Hex-Zeichen. Nahezu gleiche Bilder haben nahezu gleiche Hashes.
 */
export function dHash(gray: Float32Array, width: number, height: number): string {
  const cols = 9;
  const rows = 8;
  const cells = new Float64Array(cols * rows);
  const counts = new Uint32Array(cols * rows);
  for (let y = 0; y < height; y++) {
    const cy = Math.min(rows - 1, Math.floor((y * rows) / height));
    for (let x = 0; x < width; x++) {
      const cx = Math.min(cols - 1, Math.floor((x * cols) / width));
      cells[cy * cols + cx] += gray[y * width + x];
      counts[cy * cols + cx]++;
    }
  }
  for (let i = 0; i < cells.length; i++) cells[i] /= Math.max(1, counts[i]);
  let hex = "";
  for (let y = 0; y < rows; y++) {
    let byte = 0;
    for (let x = 0; x < cols - 1; x++) {
      byte = (byte << 1) | (cells[y * cols + x] > cells[y * cols + x + 1] ? 1 : 0);
    }
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

const POPCOUNT = Array.from({ length: 16 }, (_, i) => (i & 1) + ((i >> 1) & 1) + ((i >> 2) & 1) + ((i >> 3) & 1));

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    d += POPCOUNT[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
  }
  return d;
}
