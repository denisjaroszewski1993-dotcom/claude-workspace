import { WebPlugin } from "@capacitor/core";
import type { AccessStatus, NativeAlbum, NativeAsset, NativeFile, PhotoLibraryPlugin } from "./nativeLibrary";

// Nachgebildete iPhone-Mediathek aus den Beispielfotos – nur für Entwicklung
// und automatische Tests im Browser (Adresse mit ?mediathek-demo).

interface DemoEntry {
  file: string;
  takenAt: string;
  lat: number;
  lon: number;
}

export class PhotoLibraryDemo extends WebPlugin implements PhotoLibraryPlugin {
  // Die Freigabe übersteht ein Neuladen – wie auf dem iPhone.
  private status: AccessStatus = (sessionStorage.getItem("mediathek-demo-zugriff") as AccessStatus | null) ?? "notDetermined";
  /** ?mediathek-demo=600 vervielfacht die Beispielfotos, um große Mediatheken zu testen. */
  private readonly size = Number(new URLSearchParams(location.search).get("mediathek-demo")) || 0;
  private entries?: Promise<DemoEntry[]>;
  readonly albums = new Map<string, Set<string>>();

  private base() {
    return `${import.meta.env.BASE_URL}demo/`;
  }

  private load(): Promise<DemoEntry[]> {
    this.entries ??= fetch(`${this.base()}demo.json`)
      .then((r) => r.json())
      .then((j: { photos: DemoEntry[] }) => {
        if (this.size <= j.photos.length) return j.photos;
        // Kopien im Abstand von je 9 Tagen rückwärts, erkennbar am „#n“ in der Kennung.
        return Array.from({ length: this.size }, (_, i) => {
          const e = j.photos[i % j.photos.length];
          const round = Math.floor(i / j.photos.length);
          return round ? { ...e, file: `${e.file}#${round}`, takenAt: new Date(new Date(e.takenAt).getTime() - round * 9 * 86_400_000).toISOString() } : e;
        });
      });
    return this.entries;
  }

  async checkAccess() {
    return { status: this.status };
  }

  async requestAccess() {
    this.status = "authorized";
    sessionStorage.setItem("mediathek-demo-zugriff", this.status);
    return { status: this.status };
  }

  async openSettings() {}

  async manageLimitedSelection() {
    return {};
  }

  async getAlbums(): Promise<{ albums: NativeAlbum[] }> {
    const all = await this.load();
    return {
      albums: [
        { id: "alle", title: "Zuletzt", count: all.length, kind: "smart" },
        { id: "meer", title: "Ostsee", count: all.filter((e) => e.lat > 54).length, kind: "album" },
      ],
    };
  }

  async getAssets(options: { offset: number; limit: number; albumId?: string; since?: number; until?: number }) {
    let all = (await this.load())
      .map<NativeAsset>((e) => ({
        id: `demo/${e.file}`,
        width: 1200,
        height: 800,
        isFavorite: false,
        isScreenshot: false,
        creationDate: new Date(e.takenAt).getTime(),
        latitude: e.lat,
        longitude: e.lon,
      }))
      .sort((a, b) => b.creationDate! - a.creationDate!);
    if (options.albumId === "meer") all = all.filter((a) => a.latitude! > 54);
    if (options.since !== undefined) all = all.filter((a) => a.creationDate! >= options.since!);
    if (options.until !== undefined) all = all.filter((a) => a.creationDate! < options.until!);
    return { total: all.length, assets: all.slice(options.offset, options.offset + options.limit) };
  }

  private file(id: string): NativeFile {
    const url = `${this.base()}${id.replace("demo/", "").replace(/#\d+$/, "")}`;
    return { path: url, webPath: url };
  }

  async getImage(options: { id: string }) {
    return this.file(options.id);
  }

  async existingImages() {
    return { images: {} };
  }

  async getOriginal(options: { id: string }) {
    return { ...this.file(options.id), fileName: options.id.replace("demo/", "").replace("#", "-") };
  }

  async addToAlbum(options: { title: string; ids: string[] }) {
    const album = this.albums.get(options.title) ?? new Set<string>();
    options.ids.forEach((id) => album.add(id));
    this.albums.set(options.title, album);
    this.publish();
    return { albumId: options.title, added: options.ids.length };
  }

  async deleteAlbums(options: { prefix: string }) {
    const names = [...this.albums.keys()].filter((k) => k.startsWith(options.prefix));
    names.forEach((n) => this.albums.delete(n));
    this.publish();
    return { deleted: names.length };
  }

  /** für automatische Tests */
  private publish() {
    (window as unknown as { __demoAlben: unknown }).__demoAlben = Object.fromEntries([...this.albums].map(([k, v]) => [k, v.size]));
  }

  async share(options: { fileName: string; data: string }) {
    (window as unknown as { __demoGeteilt: unknown }).__demoGeteilt = { fileName: options.fileName, bytes: Math.round((options.data.length * 3) / 4) };
    return { completed: true };
  }

  async keepAwake() {}

  async clearCache() {}
}
