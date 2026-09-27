import type { Photo, PhotoEvent, Story } from "../types";
import { CATEGORY_BY_ID, categoryLabel, effectiveCategories, primaryCategory } from "./categories";
import { formatDate, monthName } from "./events";
import { blobToDataUrl, resizedJpeg } from "./image";

// Sortierte Kopien der Fotos als ZIP oder direkt in einen Ordner schreiben.
// Die Originaldateien bleiben unverändert.

export type ExportStructure = "kategorie" | "datum" | "erlebnis";

export interface ExportOptions {
  structure: ExportStructure;
  datePrefix: boolean;
  includeSorted: boolean;
}

export interface ExportEntry {
  photo: Photo;
  path: string;
}

export function safeName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "Foto";
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function datePrefix(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`;
}

function folderFor(photo: Photo, structure: ExportStructure, eventOf: Map<string, PhotoEvent>): string {
  if (structure === "kategorie") return CATEGORY_BY_ID[primaryCategory(photo)].folder;
  if (photo.takenAt === undefined) return "Ohne Datum";
  const d = new Date(photo.takenAt);
  if (structure === "datum") return `${d.getFullYear()}/${pad(d.getMonth() + 1)} ${monthName(d.getMonth())}`;
  const event = eventOf.get(photo.id);
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (!event || event.start === undefined) return day;
  const s = new Date(event.start);
  return `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())} ${safeName(event.title)}`;
}

export function planExport(photos: Photo[], events: PhotoEvent[], options: ExportOptions): ExportEntry[] {
  const eventOf = new Map<string, PhotoEvent>();
  for (const e of events) for (const id of e.photoIds) eventOf.set(id, e);
  const used = new Set<string>();
  const entries: ExportEntry[] = [];
  const sorted = [...photos].filter((p) => p.status !== "fehler").sort((a, b) => (a.takenAt ?? 0) - (b.takenAt ?? 0));

  for (const photo of sorted) {
    let folder: string;
    if (photo.duplicateOf || photo.excluded) {
      if (!options.includeSorted) continue;
      folder = photo.duplicateOf ? "_Aussortiert/Doppelte" : "_Aussortiert";
    } else {
      folder = folderFor(photo, options.structure, eventOf);
    }
    const base = safeName(photo.name);
    const named = options.datePrefix && photo.takenAt !== undefined ? `${datePrefix(photo.takenAt)} ${base}` : base;
    let path = `${folder}/${named}`;
    let n = 2;
    while (used.has(path.toLowerCase())) {
      const dot = named.lastIndexOf(".");
      path = dot > 0 ? `${folder}/${named.slice(0, dot)} (${n})${named.slice(dot)}` : `${folder}/${named} (${n})`;
      n++;
    }
    used.add(path.toLowerCase());
    entries.push({ photo, path });
  }
  return entries;
}

function csvCell(value: unknown): string {
  const s = value === undefined || value === null ? "" : String(value);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Übersichtstabelle (öffnet sich in Excel/Numbers; Semikolon für deutsche Einstellungen). */
export function catalogCsv(entries: ExportEntry[]): string {
  const header = ["Datei", "Ablage", "Aufnahme", "Kategorien", "Ort", "Breite", "Länge", "Kamera", "Schärfe", "Hinweis"];
  const rows = entries.map(({ photo, path }) => [
    photo.name,
    path,
    photo.takenAt !== undefined ? datePrefix(photo.takenAt) : "",
    effectiveCategories(photo).map(categoryLabel).join(", "),
    photo.place ?? "",
    photo.gps?.lat.toFixed(5) ?? "",
    photo.gps?.lon.toFixed(5) ?? "",
    photo.camera ?? "",
    photo.quality ? Math.round(photo.quality.sharpness) : "",
    photo.duplicateOf ? "Doppelt" : photo.excluded ? "Aussortiert" : photo.quality?.blurry ? "Unscharf" : "",
  ]);
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
}

export async function exportZip(entries: ExportEntry[], onProgress: (done: number, total: number) => void): Promise<Blob> {
  const { Zip, ZipPassThrough, strToU8 } = await import("fflate");
  return new Promise<Blob>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    const zip = new Zip((err, data, final) => {
      if (err) return reject(err);
      chunks.push(data);
      if (final) resolve(new Blob(chunks as BlobPart[], { type: "application/zip" }));
    });
    (async () => {
      let done = 0;
      for (const entry of entries) {
        const file = new ZipPassThrough(entry.path);
        if (entry.photo.takenAt !== undefined) file.mtime = entry.photo.takenAt;
        zip.add(file);
        file.push(new Uint8Array(await entry.photo.file.arrayBuffer()), true);
        onProgress(++done, entries.length);
      }
      const csv = new ZipPassThrough("Übersicht.csv");
      zip.add(csv);
      csv.push(strToU8(catalogCsv(entries)), true);
      zip.end();
    })().catch(reject);
  });
}

interface DirHandle {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<{ createWritable(): Promise<{ write(data: Blob | string): Promise<void>; close(): Promise<void> }> }>;
}

export function canWriteFolders(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window && window.self === window.top;
}

/** Schreibt die sortierten Kopien direkt in einen gewählten Ordner (Chrome/Edge am Computer). */
export async function exportToFolder(entries: ExportEntry[], onProgress: (done: number, total: number) => void): Promise<void> {
  const picker = (window as unknown as { showDirectoryPicker(o?: object): Promise<DirHandle> }).showDirectoryPicker;
  const root = await picker({ mode: "readwrite", id: "fotogeschichten" });
  const dirs = new Map<string, DirHandle>();
  const dirFor = async (path: string): Promise<DirHandle> => {
    if (!path) return root;
    const known = dirs.get(path);
    if (known) return known;
    const parts = path.split("/");
    const parent = await dirFor(parts.slice(0, -1).join("/"));
    const dir = await parent.getDirectoryHandle(parts[parts.length - 1], { create: true });
    dirs.set(path, dir);
    return dir;
  };
  let done = 0;
  for (const entry of entries) {
    const parts = entry.path.split("/");
    const dir = await dirFor(parts.slice(0, -1).join("/"));
    const handle = await dir.getFileHandle(parts[parts.length - 1], { create: true });
    const writable = await handle.createWritable();
    await writable.write(entry.photo.file);
    await writable.close();
    onProgress(++done, entries.length);
  }
  const csvHandle = await root.getFileHandle("Übersicht.csv", { create: true });
  const csv = await csvHandle.createWritable();
  await csv.write(catalogCsv(entries));
  await csv.close();
}

// ---------------------------------------------------------------------------
// Geschichte als eigenständige HTML-Datei (zum Verschicken, Archivieren, Drucken)

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function storyHtml(story: Story, photos: Record<string, Photo>, onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const ids = [...new Set(story.chapters.flatMap((c) => c.photoIds))].filter((id) => photos[id]);
  const images = new Map<string, string>();
  let done = 0;
  for (const id of ids) {
    const photo = photos[id];
    images.set(id, await blobToDataUrl(await resizedJpeg(photo.file, 1600, 0.84)));
    onProgress?.(++done, ids.length);
  }
  const figure = (id: string) => {
    const p = photos[id];
    const caption = [p.takenAt !== undefined ? formatDate(p.takenAt) : "", p.place ?? ""].filter(Boolean).join(" · ");
    return `<figure><img src="${images.get(id)}" alt="${esc(effectiveCategories(p).map(categoryLabel).join(", "))}">${caption ? `<figcaption>${esc(caption)}</figcaption>` : ""}</figure>`;
  };
  const chapters = story.chapters
    .map(
      (c) => `<section>
  <p class="meta">${esc([c.dateLabel, c.place].filter(Boolean).join(" · "))}</p>
  <h2>${esc(c.heading)}</h2>
  <p class="text">${esc(c.text)}</p>
  <div class="photos n${Math.min(c.photoIds.length, 3)}">${c.photoIds.filter((id) => images.has(id)).map(figure).join("")}</div>
</section>`,
    )
    .join("\n");

  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(story.title)}</title>
<style>
  :root { --paper: #f7f8f6; --ink: #1d232b; --muted: #5d6773; --line: #d7dde3; }
  @media (prefers-color-scheme: dark) { :root { --paper: #15191e; --ink: #e7ebef; --muted: #9aa5b1; --line: #2c343d; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--ink); font: 19px/1.65 Georgia, "Iowan Old Style", "Times New Roman", serif; }
  main { max-width: 46rem; margin: 0 auto; padding: 3rem 1rem 5rem; }
  header { text-align: left; margin-bottom: 3rem; }
  h1 { font: 700 clamp(2rem, 6vw, 3.2rem)/1.1 system-ui, sans-serif; letter-spacing: -0.02em; margin: 0 0 .6rem; text-wrap: balance; }
  h2 { font: 650 1.5rem/1.2 system-ui, sans-serif; margin: .2rem 0 .8rem; text-wrap: balance; }
  .sub, .meta, figcaption { font: 12px/1.4 ui-monospace, "SF Mono", Menlo, monospace; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
  section { margin: 0 0 3.5rem; }
  .text { max-width: 36rem; }
  .photos { display: grid; gap: .6rem; margin-top: 1.2rem; }
  .photos.n2, .photos.n3 { grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); }
  figure { margin: 0; }
  img { display: block; width: 100%; height: auto; border-radius: 3px; }
  figcaption { margin-top: .35rem; }
  .closing { font-style: italic; border-top: 1px solid var(--line); padding-top: 1.5rem; }
  footer { margin-top: 3rem; font: 12px/1.4 system-ui, sans-serif; color: var(--muted); }
</style>
</head>
<body>
<main>
<header>
  <p class="sub">${esc(story.subtitle)}</p>
  <h1>${esc(story.title)}</h1>
  ${story.coverPhotoId && images.has(story.coverPhotoId) ? figure(story.coverPhotoId) : ""}
</header>
${chapters}
<p class="closing">${esc(story.closing)}</p>
<footer>Erstellt mit Fotogeschichten${story.author === "claude" ? " · Text von Claude" : ""}</footer>
</main>
</body>
</html>`;
  return new Blob([html], { type: "text/html" });
}
