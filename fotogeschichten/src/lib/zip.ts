// Liest Fotos aus ZIP-Dateien, z. B. einem Download von iCloud.com.
//
// Statt das ganze Archiv zu entpacken, wird nur das Inhaltsverzeichnis am
// Ende der Datei gelesen. Unkomprimiert gespeicherte Fotos (bei JPEG/HEIC der
// Normalfall) werden als Ausschnitt der ZIP-Datei weitergereicht – ohne sie in
// den Arbeitsspeicher zu kopieren. Das hält auch große Archive auf dem iPhone
// handhabbar. ZIP64 (Archive über 4 GB) wird unterstützt.

export interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  headerOffset: number;
  lastModified: number;
  directory: boolean;
  encrypted: boolean;
}

export class ZipError extends Error {}

const SIG_EOCD = 0x06054b50;
const SIG_ZIP64_LOCATOR = 0x07064b50;
const SIG_ZIP64_EOCD = 0x06064b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;
const MAX32 = 0xffffffff;

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const u64 = (b: Uint8Array, o: number) => u32(b, o) + u32(b, o + 4) * 2 ** 32;

async function read(blob: Blob, start: number, end: number): Promise<Uint8Array> {
  return new Uint8Array(await blob.slice(start, end).arrayBuffer());
}

function dosTime(date: number, time: number): number {
  if (!date) return 0;
  return new Date(((date >> 9) & 0x7f) + 1980, ((date >> 5) & 0xf) - 1, date & 0x1f, time >> 11, (time >> 5) & 0x3f, (time & 0x1f) * 2).getTime();
}

const utf8 = new TextDecoder("utf-8");

/** Liest das Inhaltsverzeichnis eines ZIP-Archivs. */
export async function readZipEntries(zip: Blob): Promise<ZipEntry[]> {
  const tailLength = Math.min(zip.size, 22 + 0xffff);
  const tailStart = zip.size - tailLength;
  const tail = await read(zip, tailStart, zip.size);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (u32(tail, i) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError("Das ist keine gültige ZIP-Datei.");

  let count = u16(tail, eocd + 10);
  let cdSize = u32(tail, eocd + 12);
  let cdOffset = u32(tail, eocd + 16);
  if (count === 0xffff || cdSize === MAX32 || cdOffset === MAX32) {
    const locatorPos = tailStart + eocd - 20;
    const locator = locatorPos >= 0 ? await read(zip, locatorPos, locatorPos + 20) : new Uint8Array(0);
    if (locator.length === 20 && u32(locator, 0) === SIG_ZIP64_LOCATOR) {
      const recordPos = u64(locator, 8);
      const record = await read(zip, recordPos, recordPos + 56);
      if (u32(record, 0) !== SIG_ZIP64_EOCD) throw new ZipError("Das ZIP64-Verzeichnis ist beschädigt.");
      count = u64(record, 32);
      cdSize = u64(record, 40);
      cdOffset = u64(record, 48);
    }
  }

  const cd = await read(zip, cdOffset, cdOffset + cdSize);
  const entries: ZipEntry[] = [];
  let p = 0;
  while (p + 46 <= cd.length && u32(cd, p) === SIG_CENTRAL && entries.length < count) {
    const flags = u16(cd, p + 8);
    const nameLength = u16(cd, p + 28);
    const extraLength = u16(cd, p + 30);
    const commentLength = u16(cd, p + 32);
    let compressedSize = u32(cd, p + 20);
    let size = u32(cd, p + 24);
    let headerOffset = u32(cd, p + 42);
    const name = utf8.decode(cd.subarray(p + 46, p + 46 + nameLength));

    // ZIP64-Zusatzfeld: nur die Werte, die im Hauptfeld "voll" (0xFFFFFFFF) sind
    let x = p + 46 + nameLength;
    const extraEnd = x + extraLength;
    while (x + 4 <= extraEnd) {
      const id = u16(cd, x);
      const length = u16(cd, x + 2);
      if (id === 0x0001) {
        let q = x + 4;
        if (size === MAX32) {
          size = u64(cd, q);
          q += 8;
        }
        if (compressedSize === MAX32) {
          compressedSize = u64(cd, q);
          q += 8;
        }
        if (headerOffset === MAX32) headerOffset = u64(cd, q);
      }
      x += 4 + length;
    }

    entries.push({
      name,
      method: u16(cd, p + 10),
      compressedSize,
      size,
      headerOffset,
      lastModified: dosTime(u16(cd, p + 14), u16(cd, p + 12)),
      directory: name.endsWith("/"),
      encrypted: (flags & 1) === 1,
    });
    p += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** Inhalt eines Eintrags – gespeicherte Einträge als Ausschnitt ohne Kopie. */
export async function extractEntry(zip: Blob, entry: ZipEntry): Promise<Blob> {
  if (entry.encrypted) throw new ZipError("verschlüsselt");
  const local = await read(zip, entry.headerOffset, entry.headerOffset + 30);
  if (u32(local, 0) !== SIG_LOCAL) throw new ZipError("Eintrag beschädigt");
  const start = entry.headerOffset + 30 + u16(local, 26) + u16(local, 28);
  const data = zip.slice(start, start + entry.compressedSize);
  if (entry.method === 0) return data;
  if (entry.method === 8) {
    if (typeof DecompressionStream !== "undefined") {
      try {
        return await new Response(data.stream().pipeThrough(new DecompressionStream("deflate-raw"))).blob();
      } catch {
        // ältere Browser kennen "deflate-raw" nicht – dann mit fflate
      }
    }
    const { inflateSync } = await import("fflate");
    return new Blob([inflateSync(new Uint8Array(await data.arrayBuffer())) as BlobPart]);
  }
  throw new ZipError(`Kompressionsverfahren ${entry.method} wird nicht unterstützt`);
}

const IMAGE_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  heif: "image/heif",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  tif: "image/tiff",
  tiff: "image/tiff",
  bmp: "image/bmp",
};

export function isZipFile(file: File): boolean {
  return /\.zip$/i.test(file.name) || file.type === "application/zip" || file.type === "application/x-zip-compressed";
}

export interface ZipImport {
  files: File[];
  skipped: number;
}

/** Alle Fotos aus einem ZIP-Archiv als eigenständige Dateien. */
export async function imagesFromZip(zip: Blob, onProgress?: (done: number, total: number) => void): Promise<ZipImport> {
  const entries = await readZipEntries(zip);
  // Verzeichnisse und unsichtbare Systemdateien (__MACOSX, ._Datei, .DS_Store) sind kein Inhalt.
  const content = entries.filter((e) => {
    const base = e.name.split("/").pop() ?? "";
    return !e.directory && !e.name.includes("__MACOSX/") && !base.startsWith(".");
  });
  const images = content.filter((e) => (e.name.split(".").pop()?.toLowerCase() ?? "") in IMAGE_TYPES);
  const files: File[] = [];
  let skipped = content.length - images.length;
  for (const entry of images) {
    try {
      const blob = await extractEntry(zip, entry);
      const base = entry.name.split("/").pop()!;
      const ext = base.split(".").pop()!.toLowerCase();
      files.push(new File([blob], base, { type: IMAGE_TYPES[ext], lastModified: entry.lastModified || undefined }));
    } catch {
      skipped++;
    }
    onProgress?.(files.length, images.length);
  }
  return { files, skipped };
}
