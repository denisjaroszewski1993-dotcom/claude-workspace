import { Capacitor, registerPlugin } from "@capacitor/core";

// Brücke zum Swift-Modul ios/App/App/PhotoLibraryPlugin.swift. Nur in der
// iPhone-App vorhanden; im Browser gibt es für Tests (npm run dev, Adresse mit
// ?mediathek-demo) eine nachgebildete Mediathek aus den Beispielfotos.

export type AccessStatus = "authorized" | "limited" | "denied" | "restricted" | "notDetermined";

export interface NativeAsset {
  id: string;
  /** liefert das Swift-Modul aus Tempogründen nicht; nur die Nachbildung im Browser */
  fileName?: string;
  width: number;
  height: number;
  isFavorite: boolean;
  isScreenshot: boolean;
  creationDate?: number;
  latitude?: number;
  longitude?: number;
  burstId?: string;
}

export interface NativeAlbum {
  id: string;
  title: string;
  count: number;
  kind: "smart" | "album";
}

export interface NativeFile {
  path: string;
  webPath: string;
  fileName?: string;
  size?: number;
}

export interface PhotoLibraryPlugin {
  checkAccess(): Promise<{ status: AccessStatus }>;
  requestAccess(): Promise<{ status: AccessStatus }>;
  openSettings(): Promise<void>;
  manageLimitedSelection(): Promise<{ count?: number }>;
  getAlbums(): Promise<{ albums: NativeAlbum[] }>;
  getAssets(options: { offset: number; limit: number; albumId?: string; since?: number; until?: number }): Promise<{ total: number; assets: NativeAsset[] }>;
  getImage(options: { id: string; maxSize: number; quality?: number }): Promise<NativeFile>;
  existingImages(options: { ids: string[]; maxSize: number }): Promise<{ images: Record<string, string> }>;
  getOriginal(options: { id: string }): Promise<NativeFile>;
  addToAlbum(options: { title: string; ids: string[] }): Promise<{ albumId: string; added: number }>;
  deleteAlbums(options: { prefix: string }): Promise<{ deleted: number }>;
  share(options: { fileName: string; data: string }): Promise<{ completed: boolean }>;
  keepAwake(options: { enabled: boolean }): Promise<void>;
  clearCache(): Promise<void>;
}

function demoEnabled(): boolean {
  return import.meta.env.DEV && typeof location !== "undefined" && location.search.includes("mediathek-demo");
}

export const PhotoLibrary = registerPlugin<PhotoLibraryPlugin>("PhotoLibrary", {
  web: () => import("./nativeLibraryDemo").then((m) => new m.PhotoLibraryDemo()),
});

/** Läuft die App mit direktem Zugriff auf die iPhone-Mediathek? */
export function hasNativeLibrary(): boolean {
  return Capacitor.isNativePlatform() || demoEnabled();
}

/** Größe der Vorschaubilder, die das Modul dauerhaft ablegt und die App analysiert. */
export const NATIVE_THUMB_SIZE = 512;

/** Titelanfang aller Alben, die die App anlegt – daran erkennt sie sie wieder. */
export const ALBUM_PREFIX = "Fotogeschichten · ";
