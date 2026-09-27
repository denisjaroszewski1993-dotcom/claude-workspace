import type { GeoPoint } from "../types";

export interface PhotoMetadata {
  takenAt?: number;
  dateSource?: "exif" | "dateiname" | "datei";
  gps?: GeoPoint;
  camera?: string;
  hasCameraExif: boolean;
}

function validDate(y: number, mo: number, d: number, h = 12, mi = 0, s = 0): number | undefined {
  if (y < 1990 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  if (h > 23 || mi > 59 || s > 59) return undefined;
  const date = new Date(y, mo - 1, d, h, mi, s);
  // 31.02. o. ä. ablehnen
  if (date.getMonth() !== mo - 1) return undefined;
  return date.getTime();
}

/**
 * Viele Kameras und Apps schreiben das Aufnahmedatum in den Dateinamen:
 * IMG_20240714_153012.jpg, PXL_20240714_153012345.jpg,
 * WhatsApp Image 2024-07-14 at 15.30.12.jpeg, IMG-20240714-WA0012.jpg,
 * Bildschirmfoto 2024-07-14 um 15.30.12.png, 2024-07-14 15.30.12.jpg
 */
export function dateFromFilename(name: string): number | undefined {
  const base = name.replace(/\.[^.]+$/, "");
  let m = base.match(/(?:^|\D)(\d{4})(\d{2})(\d{2})[_\-T ]?(\d{2})(\d{2})(\d{2})/);
  if (m) {
    const t = validDate(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6]);
    if (t !== undefined) return t;
  }
  m = base.match(/(\d{4})-(\d{2})-(\d{2})(?:[ _T]|\sat\s|\sum\s)+(\d{1,2})[.\-:](\d{2})[.\-:](\d{2})/);
  if (m) {
    const t = validDate(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6]);
    if (t !== undefined) return t;
  }
  m = base.match(/(?:^|\D)(\d{4})-?(\d{2})-?(\d{2})(?:\D|$)/);
  if (m) {
    const t = validDate(+m[1], +m[2], +m[3]);
    if (t !== undefined) return t;
  }
  return undefined;
}

type ExifrModule = typeof import("exifr");
let exifrPromise: Promise<ExifrModule> | undefined;

/** Liest Datum, GPS und Kamera aus den EXIF-Daten; fällt auf Dateiname und Änderungsdatum zurück. */
export async function readMetadata(file: File): Promise<PhotoMetadata> {
  let exif: Record<string, unknown> | undefined;
  try {
    exifrPromise ??= import("exifr");
    const exifr = await exifrPromise;
    exif = await (exifr.default ?? exifr).parse(file, {
      tiff: true,
      exif: true,
      gps: true,
      ifd1: false,
      interop: false,
      xmp: false,
      icc: false,
      iptc: false,
      translateValues: false,
    });
  } catch {
    exif = undefined;
  }

  const meta: PhotoMetadata = { hasCameraExif: false };
  if (exif) {
    const make = typeof exif.Make === "string" ? exif.Make.trim() : "";
    const model = typeof exif.Model === "string" ? exif.Model.trim() : "";
    if (make || model) {
      meta.hasCameraExif = true;
      meta.camera = model.toLowerCase().startsWith(make.toLowerCase()) ? model : `${make} ${model}`.trim();
    }
    const date = exif.DateTimeOriginal ?? exif.CreateDate ?? exif.DateTime;
    if (date instanceof Date && !Number.isNaN(date.getTime()) && date.getFullYear() > 1990) {
      meta.takenAt = date.getTime();
      meta.dateSource = "exif";
    }
    const lat = exif.latitude;
    const lon = exif.longitude;
    if (typeof lat === "number" && typeof lon === "number" && Number.isFinite(lat) && Number.isFinite(lon)) {
      if (!(lat === 0 && lon === 0)) meta.gps = { lat, lon };
    }
  }
  if (meta.takenAt === undefined) {
    const fromName = dateFromFilename(file.name);
    if (fromName !== undefined) {
      meta.takenAt = fromName;
      meta.dateSource = "dateiname";
    } else if (file.lastModified && file.lastModified < Date.now() - 10 * 60 * 1000) {
      // Ein Änderungsdatum von "gerade eben" stammt meist vom Kopieren/Hochladen
      // (z. B. auf dem iPhone) und sagt nichts über die Aufnahme.
      meta.takenAt = file.lastModified;
      meta.dateSource = "datei";
    }
  }
  return meta;
}
