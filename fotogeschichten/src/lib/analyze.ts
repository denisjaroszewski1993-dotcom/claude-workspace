import { del, get, set, createStore, clear } from "idb-keyval";
import type { ColorInfo, QualityInfo, Recognition } from "../types";
import { canvasToBlob, decodeImage, drawScaled, pixelsOf, releaseImage, sizeOf } from "./image";
import { readMetadata, type PhotoMetadata } from "./metadata";
import { analyzeColors, assessQuality, dHash, laplacianVariance, toGray } from "./pixels";
import { recognize } from "./recognition";

export interface AnalysisResult {
  version: number;
  width: number;
  height: number;
  thumb: Blob;
  colors: ColorInfo;
  quality: QualityInfo;
  hash: string;
  recognition?: Recognition;
  meta: PhotoMetadata;
}

const VERSION = 3;

/**
 * Stabile ID aus Dateigröße und den ersten 64 KB. Dadurch erkennt die App
 * dieselben Fotos beim nächsten Öffnen wieder – auch auf dem iPhone, wo sich
 * Name und Änderungsdatum bei jedem Hochladen ändern.
 */
export async function fileId(file: Blob): Promise<string> {
  const head = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
  let h = 0x811c9dc5;
  for (let i = 0; i < head.length; i++) {
    h ^= head[i];
    h = Math.imul(h, 0x01000193);
  }
  return `f${file.size.toString(36)}-${(h >>> 0).toString(36)}`;
}

// ---------------------------------------------------------------------------
// Zwischenspeicher (IndexedDB) – nur auf diesem Gerät

let store: ReturnType<typeof createStore> | undefined | null;

function cacheStore() {
  if (store === undefined) {
    try {
      store = typeof indexedDB === "undefined" ? null : createStore("fotogeschichten", "analysen");
    } catch {
      store = null;
    }
  }
  return store;
}

export async function readCache(id: string): Promise<AnalysisResult | undefined> {
  const s = cacheStore();
  if (!s) return undefined;
  try {
    const value = (await get(id, s)) as AnalysisResult | undefined;
    return value?.version === VERSION ? value : undefined;
  } catch {
    return undefined;
  }
}

async function writeCache(id: string, value: AnalysisResult) {
  const s = cacheStore();
  if (!s) return;
  try {
    await set(id, value, s);
  } catch {
    // voll oder gesperrt – dann eben ohne Zwischenspeicher
  }
}

export async function forgetCache(id?: string) {
  const s = cacheStore();
  if (!s) return;
  try {
    if (id) await del(id, s);
    else await clear(s);
  } catch {
    // egal
  }
}

// ---------------------------------------------------------------------------

export interface AnalyzeOptions {
  id: string;
  recognition: boolean;
}

/** Analysiert ein Foto vollständig oder holt das Ergebnis aus dem Zwischenspeicher. */
export async function analyzeFile(file: File, options: AnalyzeOptions): Promise<AnalysisResult> {
  const cached = await readCache(options.id);
  if (cached && (!options.recognition || cached.recognition)) return cached;

  const [meta, src] = await Promise.all([readMetadata(file), decodeImage(file)]);
  try {
    const { width, height } = sizeOf(src);
    // Eine mittelgroße Fassung für Schärfe und Erkennung, daraus alles Weitere.
    const work = drawScaled(src, width, height, 512);
    const small = drawScaled(work, work.width, work.height, 128);
    const thumbCanvas = drawScaled(src, width, height, 480);

    const colors = analyzeColors(pixelsOf(small));
    const workPixels = pixelsOf(work);
    const sharpness = laplacianVariance(toGray(workPixels), work.width, work.height);
    const quality = assessQuality(sharpness, colors);
    const smallGray = toGray(pixelsOf(small));
    const hash = dHash(smallGray, small.width, small.height);
    const thumb = await canvasToBlob(thumbCanvas, "image/jpeg", 0.8);

    let recognition: Recognition | undefined = cached?.recognition;
    if (options.recognition && !recognition) {
      try {
        recognition = await recognize(work);
      } catch (err) {
        console.warn("Erkennung fehlgeschlagen", err);
      }
    }

    const result: AnalysisResult = { version: VERSION, width, height, thumb, colors, quality, hash, recognition, meta };
    await writeCache(options.id, result);
    return result;
  } finally {
    releaseImage(src);
  }
}
