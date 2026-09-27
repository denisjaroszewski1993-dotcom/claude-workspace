import { describe, expect, it } from "vitest";
import { zipSync } from "fflate";
import { imagesFromZip, isZipFile, readZipEntries, ZipError } from "./zip";

const bytes = (n: number, seed: number) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed) % 251);

describe("imagesFromZip", () => {
  it("holt gespeicherte und komprimierte Fotos heraus und lässt Beiwerk weg", async () => {
    const jpeg = bytes(5000, 1);
    const png = bytes(3000, 2);
    const archive = zipSync({
      "iCloud Photos/IMG_0001.JPG": [jpeg, { level: 0 }],
      "iCloud Photos/Unterordner/Bild.png": [png, { level: 6 }],
      "iCloud Photos/liesmich.txt": [new TextEncoder().encode("hallo"), { level: 6 }],
      "__MACOSX/iCloud Photos/._IMG_0001.JPG": [bytes(10, 3), { level: 0 }],
      "iCloud Photos/leer/": [new Uint8Array(0), {}],
    });
    const { files, skipped } = await imagesFromZip(new Blob([archive as BlobPart]));
    expect(files.map((f) => [f.name, f.type])).toEqual([
      ["IMG_0001.JPG", "image/jpeg"],
      ["Bild.png", "image/png"],
    ]);
    expect(new Uint8Array(await files[0].arrayBuffer())).toEqual(jpeg);
    expect(new Uint8Array(await files[1].arrayBuffer())).toEqual(png);
    expect(skipped).toBe(1); // nur die Textdatei – das __MACOSX-Anhängsel ist kein Inhalt
  });

  it("meldet kaputte Dateien verständlich", async () => {
    await expect(readZipEntries(new Blob(["kein zip"]))).rejects.toBeInstanceOf(ZipError);
  });

  it("erkennt ZIP-Dateien an Endung und Typ", () => {
    expect(isZipFile(new File([], "iCloud Photos.zip"))).toBe(true);
    expect(isZipFile(new File([], "download", { type: "application/zip" }))).toBe(true);
    expect(isZipFile(new File([], "IMG_1.jpg", { type: "image/jpeg" }))).toBe(false);
  });

  it("liest ZIP64-Archive (über 4 GB)", async () => {
    const data = bytes(1234, 7);
    const archive = buildZip64("Fotos/IMG_9999.HEIC", data);
    const entries = await readZipEntries(new Blob([archive as BlobPart]));
    expect(entries).toHaveLength(1);
    expect(entries[0].size).toBe(1234);
    const { files } = await imagesFromZip(new Blob([archive as BlobPart]));
    expect(files[0].name).toBe("IMG_9999.HEIC");
    expect(files[0].type).toBe("image/heic");
    expect(new Uint8Array(await files[0].arrayBuffer())).toEqual(data);
  });
});

/** Minimales ZIP64-Archiv mit einem gespeicherten Eintrag, wie es große Downloads erzeugen. */
function buildZip64(name: string, data: Uint8Array): Uint8Array {
  const nameBytes = new TextEncoder().encode(name);
  const parts: number[] = [];
  const u16 = (v: number) => parts.push(v & 0xff, (v >> 8) & 0xff);
  const u32 = (v: number) => parts.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
  const u64 = (v: number) => {
    u32(v % 2 ** 32);
    u32(Math.floor(v / 2 ** 32));
  };

  // Lokaler Kopf mit ZIP64-Zusatzfeld (Größe, komprimierte Größe)
  u32(0x04034b50); u16(45); u16(0x0800); u16(0); u16(0); u16(0x5b21);
  u32(0); u32(0xffffffff); u32(0xffffffff); u16(nameBytes.length); u16(20);
  parts.push(...nameBytes);
  u16(0x0001); u16(16); u64(data.length); u64(data.length);
  parts.push(...data);

  // Zentralverzeichnis mit ZIP64-Feld (Größe, komprimierte Größe, Offset)
  const cdOffset = parts.length;
  u32(0x02014b50); u16(45); u16(45); u16(0x0800); u16(0); u16(0); u16(0x5b21);
  u32(0); u32(0xffffffff); u32(0xffffffff); u16(nameBytes.length); u16(28); u16(0);
  u16(0); u16(0); u32(0); u32(0xffffffff);
  parts.push(...nameBytes);
  u16(0x0001); u16(24); u64(data.length); u64(data.length); u64(0);
  const cdSize = parts.length - cdOffset;

  // ZIP64-Endeintrag, Verweis darauf und klassischer Endeintrag mit Platzhaltern
  const zip64Eocd = parts.length;
  u32(0x06064b50); u64(44); u16(45); u16(45); u32(0); u32(0); u64(1); u64(1); u64(cdSize); u64(cdOffset);
  u32(0x07064b50); u32(0); u64(zip64Eocd); u32(1);
  u32(0x06054b50); u16(0); u16(0); u16(0xffff); u16(0xffff); u32(0xffffffff); u32(0xffffffff); u16(0);
  return Uint8Array.from(parts);
}
