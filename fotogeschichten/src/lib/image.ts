// Bilder im Browser dekodieren und verkleinern.

export type ImageSource = ImageBitmap | HTMLImageElement;

export async function decodeImage(blob: Blob): Promise<ImageSource> {
  if (typeof createImageBitmap === "function") {
    try {
      // Moderne Browser drehen das Bild dabei gemäß EXIF-Ausrichtung.
      return await createImageBitmap(blob);
    } catch {
      // weiter mit <img>
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // Nach decode() darf die URL freigegeben werden; das Bild bleibt gezeichnet.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}

export function sizeOf(src: ImageSource): { width: number; height: number } {
  if ("naturalWidth" in src) return { width: src.naturalWidth, height: src.naturalHeight };
  return { width: src.width, height: src.height };
}

export function releaseImage(src: ImageSource) {
  if ("close" in src) src.close();
}

export function drawScaled(src: CanvasImageSource, width: number, height: number, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function pixelsOf(canvas: HTMLCanvasElement): ImageData {
  return canvas.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height);
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/jpeg", quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Bild konnte nicht gespeichert werden"))), type, quality);
  });
}

/** Verkleinerte JPEG-Fassung eines Fotos (für Export, Claude und Diashow). */
export async function resizedJpeg(blob: Blob, maxSide: number, quality = 0.85): Promise<Blob> {
  const src = await decodeImage(blob);
  try {
    const { width, height } = sizeOf(src);
    return await canvasToBlob(drawScaled(src, width, height, maxSide), "image/jpeg", quality);
  } finally {
    releaseImage(src);
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
