import type { Photo } from "../types";
import { PhotoLibrary } from "./nativeLibrary";

// Bilddaten eines Fotos – egal, ob es als Datei gewählt wurde oder (in der
// iPhone-App) direkt aus der Mediathek kommt. Mediathek-Fotos liegen nicht im
// Arbeitsspeicher; das Swift-Modul legt bei Bedarf eine passende Fassung ab.

async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Das Foto ließ sich nicht lesen.");
  return res.blob();
}

/** Bild in höchstens `maxSize` Pixeln Kantenlänge (Dateien werden unverändert geliefert). */
export async function photoBlob(photo: Photo, maxSize = 2048): Promise<Blob> {
  if (photo.file) return photo.file;
  if (photo.native) {
    const { webPath } = await PhotoLibrary.getImage({ id: photo.native.id, maxSize });
    return fetchBlob(webPath);
  }
  throw new Error("Für dieses Foto liegen keine Bilddaten vor.");
}

/** Adresse zum Anzeigen; `release` gibt sie wieder frei. */
export async function photoDisplayUrl(photo: Photo, maxSize = 2048): Promise<{ url: string; release(): void }> {
  if (photo.file) {
    const url = URL.createObjectURL(photo.file);
    return { url, release: () => URL.revokeObjectURL(url) };
  }
  if (photo.native) {
    const { webPath } = await PhotoLibrary.getImage({ id: photo.native.id, maxSize });
    return { url: webPath, release: () => undefined };
  }
  return { url: photo.thumbUrl ?? "", release: () => undefined };
}

/** Originaldatei in voller Qualität (bei Mediathek-Fotos z. B. HEIC). */
export async function originalBlob(photo: Photo): Promise<Blob> {
  if (photo.file) return photo.file;
  if (photo.native) {
    const { webPath } = await PhotoLibrary.getOriginal({ id: photo.native.id });
    return fetchBlob(webPath);
  }
  throw new Error("Für dieses Foto liegen keine Bilddaten vor.");
}

/** Kleines Vorschaubild als Blob, z. B. für Claude. */
export async function thumbBlob(photo: Photo): Promise<Blob | undefined> {
  if (photo.thumb) return photo.thumb;
  if (!photo.thumbUrl) return undefined;
  try {
    return await fetchBlob(photo.thumbUrl);
  } catch {
    return undefined;
  }
}
