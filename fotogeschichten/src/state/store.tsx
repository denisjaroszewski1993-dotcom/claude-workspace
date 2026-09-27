import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import type { CategoryId, Photo, PhotoEvent, Settings, Story } from "../types";
import { analyzeFile, fileId, forgetCache, readCacheMany, type AnalysisResult } from "../lib/analyze";
import { categorize } from "../lib/categorize";
import { loadDemo } from "../lib/demo";
import { duplicateMap } from "../lib/duplicates";
import { buildEvents } from "../lib/events";
import { reverseGeocode } from "../lib/geo";
import { loadModels } from "../lib/recognition";
import { imagesFromZip, isZipFile } from "../lib/zip";
import { assetToPhoto, catchUpScope, forgetScopes, rememberScope, savedScopes, type LibraryScope } from "../lib/libraryImport";
import { hasNativeLibrary, NATIVE_THUMB_SIZE, PhotoLibrary, type AccessStatus } from "../lib/nativeLibrary";

export type ModelState = "aus" | "laedt" | "bereit" | "fehler";

export interface Notice {
  id: number;
  text: string;
  tone: "info" | "fehler";
}

interface State {
  photos: Record<string, Photo>;
  order: string[];
  stories: Story[];
  settings: Settings;
  progress: { total: number; done: number };
  models: ModelState;
  notice?: Notice;
}

type Action =
  | { type: "addPhotos"; photos: Photo[] }
  | { type: "patchPhotos"; patches: Record<string, Partial<Photo>> }
  | { type: "progress"; total: number; done: number }
  | { type: "models"; state: ModelState }
  | { type: "settings"; patch: Partial<Settings> }
  | { type: "saveStory"; story: Story }
  | { type: "deleteStory"; id: string }
  | { type: "clear" }
  | { type: "removePhotos"; ids: string[] }
  | { type: "notice"; notice?: Notice };

const DEFAULT_SETTINGS: Settings = { recognition: true, placeNames: false, eventGapHours: 8, apiKey: "" };

const KEYS = {
  settings: "fotogeschichten.einstellungen.v1",
  stories: "fotogeschichten.geschichten.v1",
  corrections: "fotogeschichten.korrekturen.v1",
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function readArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const value = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // privates Fenster o. ä.
  }
}

type Corrections = Record<string, { manual?: CategoryId[]; excluded?: boolean }>;

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "addPhotos": {
      const photos = { ...state.photos };
      const order = [...state.order];
      for (const p of action.photos) {
        if (photos[p.id]) continue;
        photos[p.id] = p;
        order.push(p.id);
      }
      return { ...state, photos, order };
    }
    case "patchPhotos": {
      const photos = { ...state.photos };
      for (const [id, patch] of Object.entries(action.patches)) {
        if (photos[id]) photos[id] = { ...photos[id], ...patch };
      }
      return { ...state, photos };
    }
    case "progress":
      return { ...state, progress: { total: action.total, done: action.done } };
    case "models":
      return { ...state, models: action.state };
    case "settings":
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case "saveStory": {
      const exists = state.stories.some((s) => s.id === action.story.id);
      return {
        ...state,
        stories: exists ? state.stories.map((s) => (s.id === action.story.id ? action.story : s)) : [action.story, ...state.stories],
      };
    }
    case "deleteStory":
      return { ...state, stories: state.stories.filter((s) => s.id !== action.id) };
    case "clear":
      return { ...state, photos: {}, order: [], progress: { total: 0, done: 0 } };
    case "removePhotos": {
      const remove = new Set(action.ids);
      const photos = Object.fromEntries(Object.entries(state.photos).filter(([id]) => !remove.has(id)));
      // Geschichten, die nur aus entfernten Fotos bestehen, gehen mit.
      const stories = state.stories.filter((s) => !(s.photoPool ?? []).every((id) => remove.has(id)));
      return { ...state, photos, order: state.order.filter((id) => !remove.has(id)), stories };
    }
    case "notice":
      return { ...state, notice: action.notice };
  }
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|heic|heif|bmp|tiff?)$/i;

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || IMAGE_EXT.test(file.name);
}

interface StoreValue {
  state: State;
  photos: Photo[];
  events: PhotoEvent[];
  importFiles(files: File[]): Promise<number>;
  importDemo(): Promise<void>;
  importFromLibrary(scope: LibraryScope, options?: { quiet?: boolean; remember?: boolean }): Promise<number>;
  setManualCategories(id: string, categories: CategoryId[] | undefined): void;
  setExcluded(ids: string[], excluded: boolean): void;
  updateSettings(patch: Partial<Settings>): void;
  saveStory(story: Story): void;
  deleteStory(id: string): void;
  clearPhotos(): void;
  removeDemo(): void;
  forgetEverything(): Promise<void>;
  catchUpRecognition(): void;
  notify(text: string, tone?: Notice["tone"]): void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    photos: {},
    order: [],
    stories: readArray<Story>(KEYS.stories),
    settings: readJson(KEYS.settings, DEFAULT_SETTINGS),
    progress: { total: 0, done: 0 },
    models: "aus" as ModelState,
  }));
  const stateRef = useRef(state);
  stateRef.current = state;
  if (import.meta.env.DEV) (window as unknown as { __fotogeschichten: unknown }).__fotogeschichten = stateRef;
  const queue = useRef<string[]>([]);
  const workers = useRef(0);
  const batch = useRef({ total: 0, done: 0 });
  const noticeId = useRef(0);
  // Analyse-Ergebnisse werden gesammelt und gebündelt übernommen: pro Foto neu zu
  // zeichnen (und Erlebnisse neu zu berechnen) wäre bei 20.000 Fotos viel zu langsam.
  const pending = useRef<Record<string, Partial<Photo>>>({});
  const flushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => writeJson(KEYS.settings, state.settings), [state.settings]);
  useEffect(() => writeJson(KEYS.stories, state.stories), [state.stories]);

  const notify = useCallback((text: string, tone: Notice["tone"] = "info") => {
    dispatch({ type: "notice", notice: { id: ++noticeId.current, text, tone } });
  }, []);

  const saveCorrections = useCallback(() => {
    const corrections: Corrections = readJson<Corrections>(KEYS.corrections, {});
    for (const p of Object.values(stateRef.current.photos)) {
      if (p.manualCategories?.length || p.excluded) corrections[p.id] = { manual: p.manualCategories, excluded: p.excluded || undefined };
      else delete corrections[p.id];
    }
    writeJson(KEYS.corrections, corrections);
  }, []);

  const ensureModels = useCallback(async (): Promise<boolean> => {
    if (!stateRef.current.settings.recognition) return false;
    if (stateRef.current.models === "bereit") return true;
    if (stateRef.current.models === "fehler") return false;
    dispatch({ type: "models", state: "laedt" });
    stateRef.current = { ...stateRef.current, models: "laedt" };
    try {
      await loadModels();
      dispatch({ type: "models", state: "bereit" });
      stateRef.current = { ...stateRef.current, models: "bereit" };
      return true;
    } catch (err) {
      console.warn("Modelle nicht geladen", err);
      dispatch({ type: "models", state: "fehler" });
      stateRef.current = { ...stateRef.current, models: "fehler" };
      notify("Die KI-Erkennung konnte nicht geladen werden. Sortiert wird trotzdem – nach Datum, Ort, Farben und Qualität.", "fehler");
      return false;
    }
  }, [notify]);

  const flush = useCallback(() => {
    clearTimeout(flushTimer.current);
    flushTimer.current = undefined;
    const patches = pending.current;
    pending.current = {};
    if (Object.keys(patches).length) {
      dispatch({ type: "patchPhotos", patches });
      const photos = { ...stateRef.current.photos };
      for (const [id, patch] of Object.entries(patches)) if (photos[id]) photos[id] = { ...photos[id], ...patch };
      stateRef.current = { ...stateRef.current, photos };
    }
    dispatch({ type: "progress", ...batch.current });
  }, []);

  const stage = useCallback(
    (id: string, patch: Partial<Photo>) => {
      pending.current[id] = { ...pending.current[id], ...patch };
      if (flushTimer.current !== undefined) return;
      // Je größer die Sammlung, desto seltener: 250 ms bei wenigen, bis 2 s bei sehr vielen Fotos.
      flushTimer.current = setTimeout(flush, Math.min(2000, 250 + stateRef.current.order.length / 10));
    },
    [flush],
  );

  const markDuplicates = useCallback(() => {
    const photos = Object.values(stateRef.current.photos);
    const dups = duplicateMap(photos);
    const patches: Record<string, Partial<Photo>> = {};
    for (const p of photos) {
      const dup = dups.get(p.id);
      if (dup !== p.duplicateOf) patches[p.id] = { duplicateOf: dup };
    }
    if (Object.keys(patches).length) dispatch({ type: "patchPhotos", patches });
  }, []);

  const lookUpPlaces = useCallback(async () => {
    if (stateRef.current.settings.placeNames) {
      const events = buildEvents(Object.values(stateRef.current.photos), { gapHours: stateRef.current.settings.eventGapHours });
      for (const event of events) {
        if (!event.center || event.place) continue;
        const name = await reverseGeocode(event.center);
        if (!name) continue;
        const placePatches: Record<string, Partial<Photo>> = {};
        for (const id of event.photoIds) if (!stateRef.current.photos[id]?.place) placePatches[id] = { place: name };
        dispatch({ type: "patchPhotos", patches: placePatches });
      }
    }
  }, []);

  /** Ein Foto analysieren (oder aus dem Zwischenspeicher übernehmen). */
  const analyzeOne = useCallback(
    async (id: string, cached: AnalysisResult | null, useRecognition: boolean) => {
      const photo = stateRef.current.photos[id];
      // Inzwischen entfernt (z. B. Beispielfotos)? Dann nicht wieder einfügen.
      if (!photo) return;
      try {
        // Mediathek-Fotos: das Swift-Modul legt ein Vorschaubild ab, das zugleich
        // analysiert und angezeigt wird. Dateien werden direkt gelesen.
        const native = photo.native;
        let thumbUrl = photo.thumbUrl;
        const nativeThumb = async () => (await PhotoLibrary.getImage({ id: native!.id, maxSize: NATIVE_THUMB_SIZE })).webPath;
        const load = native
          ? async () => {
              thumbUrl = await nativeThumb();
              return (await fetch(thumbUrl)).blob();
            }
          : async () => {
              if (!photo.file) throw new Error("keine Bilddaten");
              return photo.file;
            };
        const result = await analyzeFile(load, { id, recognition: useRecognition, makeThumb: !native, cached });
        if (native && !thumbUrl) thumbUrl = await nativeThumb();
        if (!thumbUrl && result.thumb) thumbUrl = URL.createObjectURL(result.thumb);
        const takenAt = photo.takenAt ?? result.meta.takenAt;
        const patch: Partial<Photo> = {
          status: "fertig",
          width: photo.width ?? result.width,
          height: photo.height ?? result.height,
          thumbUrl,
          thumb: result.thumb,
          takenAt,
          dateSource: photo.dateSource ?? (photo.source === "beispiel" ? "exif" : result.meta.dateSource),
          gps: photo.gps ?? result.meta.gps,
          camera: result.meta.camera,
          hasCameraExif: result.meta.hasCameraExif,
          colors: result.colors,
          quality: result.quality,
          hash: result.hash,
          recognition: result.recognition,
          categories: categorize({
            colors: result.colors,
            recognition: result.recognition,
            name: photo.name,
            type: photo.type,
            width: result.width,
            height: result.height,
            hasCameraExif: result.meta.hasCameraExif,
            takenAt,
            screenshot: native?.screenshot,
          }),
        };
        stage(id, patch);
      } catch (err) {
        const heic = /heic|heif/i.test(photo.type) || /\.hei[cf]$/i.test(photo.name);
        stage(id, {
          status: "fehler",
          error: photo.native
            ? `Dieses Foto ließ sich nicht laden: ${(err as Error).message || "unbekannter Fehler"}`
            : heic
              ? "HEIC-Fotos kann dieser Browser nicht öffnen. In Safari klappt es – oder am iPhone unter Einstellungen › Kamera › Formate „Maximale Kompatibilität“ wählen."
              : `Dieses Bild ließ sich nicht öffnen (${(err as Error).message || "unbekannter Fehler"}).`,
        });
      }
      batch.current.done++;
    },
    [stage],
  );

  const work = useCallback(async () => {
    const useRecognition = await ensureModels();
    while (queue.current.length) {
      // Häppchenweise: Bekannte Fotos kommen gesammelt aus dem Zwischenspeicher.
      const ids = queue.current.splice(0, 100);
      const known = await readCacheMany(ids);
      for (const [index, id] of ids.entries()) await analyzeOne(id, known[index] ?? null, useRecognition);
    }
  }, [ensureModels, analyzeOne]);

  const pumpRef = useRef<() => Promise<void>>(async () => undefined);
  const pump = useCallback(async () => {
    // Mit KI eine Warteschlange (die Grafikkarte rechnet ohnehin nacheinander), ohne KI zwei.
    const parallel = stateRef.current.settings.recognition ? 1 : 2;
    const starters: Promise<void>[] = [];
    while (workers.current < parallel && queue.current.length) {
      workers.current++;
      starters.push(
        work().finally(() => {
          workers.current--;
        }),
      );
    }
    if (!starters.length) return;
    await Promise.all(starters);
    // Kamen Fotos genau beim Ende des Durchlaufs dazu, weitermachen.
    if (queue.current.length) return pumpRef.current();
    if (workers.current === 0) {
      flush();
      markDuplicates();
      batch.current = { total: 0, done: 0 };
      dispatch({ type: "progress", total: 0, done: 0 });
      void lookUpPlaces();
    }
  }, [work, flush, markDuplicates, lookUpPlaces]);
  pumpRef.current = pump;

  const enqueue = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      queue.current.push(...ids);
      batch.current.total += ids.length;
      dispatch({ type: "progress", ...batch.current });
      void pump();
    },
    [pump],
  );

  const addPhotos = useCallback(
    (photos: Photo[]) => {
      const corrections = readJson<Corrections>(KEYS.corrections, {});
      const fresh = photos
        .filter((p) => !stateRef.current.photos[p.id])
        .map((p) => ({ ...p, manualCategories: corrections[p.id]?.manual, excluded: corrections[p.id]?.excluded }));
      if (!fresh.length) return 0;
      dispatch({ type: "addPhotos", photos: fresh });
      const photosMap = { ...stateRef.current.photos };
      for (const p of fresh) photosMap[p.id] = p;
      stateRef.current = { ...stateRef.current, photos: photosMap, order: [...stateRef.current.order, ...fresh.map((p) => p.id)] };
      enqueue(fresh.map((p) => p.id));
      return fresh.length;
    },
    [enqueue],
  );

  const removeDemo = useCallback(() => {
    const demo = Object.values(stateRef.current.photos).filter((p) => p.source === "beispiel");
    if (!demo.length) return;
    const ids = new Set(demo.map((p) => p.id));
    for (const p of demo) {
      const url = pending.current[p.id]?.thumbUrl ?? p.thumbUrl;
      if (url) URL.revokeObjectURL(url);
      delete pending.current[p.id];
    }
    queue.current = queue.current.filter((id) => !ids.has(id));
    dispatch({ type: "removePhotos", ids: [...ids] });
    stateRef.current = {
      ...stateRef.current,
      photos: Object.fromEntries(Object.entries(stateRef.current.photos).filter(([id]) => !ids.has(id))),
      order: stateRef.current.order.filter((id) => !ids.has(id)),
    };
  }, []);

  const importFiles = useCallback(
    async (input: File[]) => {
      // ZIP-Archive (z. B. von iCloud.com) werden ausgepackt, alles andere bleibt, wie es ist.
      const files: File[] = [];
      let skippedInZips = 0;
      for (const file of input) {
        if (!isZipFile(file)) {
          files.push(file);
          continue;
        }
        notify(`„${file.name}“ wird geöffnet …`);
        try {
          const { files: fromZip, skipped } = await imagesFromZip(file);
          files.push(...fromZip);
          skippedInZips += skipped;
          if (!fromZip.length) notify(`In „${file.name}“ waren keine Fotos.`, "fehler");
        } catch (err) {
          notify(`„${file.name}“ ließ sich nicht öffnen: ${(err as Error).message}`, "fehler");
        }
      }
      const images = files.filter(isImageFile);
      // Sobald eigene Fotos kommen, räumen die Beispielfotos das Feld.
      if (images.length) removeDemo();
      const photos: Photo[] = [];
      const seen = new Set<string>();
      for (const file of images) {
        const id = await fileId(file);
        if (seen.has(id)) continue;
        seen.add(id);
        photos.push({
          id,
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          source: "eigene",
          status: "wartet",
          categories: [],
        });
      }
      const added = addPhotos(photos);
      const skipped = files.length - images.length + skippedInZips;
      const known = photos.length - added + (images.length - photos.length);
      const parts =
        added > 0
          ? [`${added} ${added === 1 ? "Foto wird" : "Fotos werden"} analysiert`, ...(known > 0 ? [`${known} ${known === 1 ? "war" : "waren"} schon da`] : [])]
          : [known === 1 ? "Dieses Foto ist schon da" : `Alle ${known} Fotos sind schon da`];
      if (skipped > 0) parts.push(`${skipped} ${skipped === 1 ? "Datei war kein Bild" : "Dateien waren keine Bilder"}`);
      if (images.length) notify(`${parts.join(", ")}.`);
      else if (!input.some(isZipFile)) notify("Unter den gewählten Dateien war kein Foto.", "fehler");
      return added;
    },
    [addPhotos, notify, removeDemo],
  );

  /** Liest die iPhone-Mediathek (ganz, einen Zeitraum oder ein Album) seitenweise ein. */
  const importFromLibrary = useCallback(
    async (scope: LibraryScope, options: { quiet?: boolean; remember?: boolean } = {}): Promise<number> => {
      let status: AccessStatus = (await PhotoLibrary.checkAccess()).status;
      if (status === "notDetermined") status = (await PhotoLibrary.requestAccess()).status;
      if (status !== "authorized" && status !== "limited") {
        if (!options.quiet) notify("Ohne Zugriff auf die Fotos geht es nicht. Du kannst ihn in den Einstellungen des iPhones erlauben.", "fehler");
        return 0;
      }
      removeDemo();
      if (options.remember !== false) rememberScope(scope);
      let offset = 0;
      let total = Infinity;
      let added = 0;
      while (offset < total) {
        const page = await PhotoLibrary.getAssets({ offset, limit: 500, albumId: scope.albumId, since: scope.since });
        total = page.total;
        if (!page.assets.length) break;
        offset += page.assets.length;
        const photos = page.assets.map(assetToPhoto);
        try {
          // Schon vorhandene Vorschaubilder gleich anzeigen, ohne auf die Analyse zu warten.
          const { images } = await PhotoLibrary.existingImages({ ids: page.assets.map((a) => a.id), maxSize: NATIVE_THUMB_SIZE });
          for (const p of photos) if (images[p.native!.id]) p.thumbUrl = images[p.native!.id];
        } catch {
          // nicht schlimm – dann kommen sie mit der Analyse
        }
        added += addPhotos(photos);
      }
      if (!options.quiet || added > 0) {
        notify(
          total === 0 || total === Infinity
            ? `In ${scope.label} wurden keine Fotos gefunden.`
            : added > 0
              ? `${added} ${added === 1 ? "Foto" : "Fotos"} aus ${scope.label} werden analysiert${status === "limited" ? " (nur die freigegebenen)" : ""}.`
              : `Alle Fotos aus ${scope.label} sind schon da.`,
        );
      }
      return added;
    },
    [addPhotos, notify, removeDemo],
  );

  // In der iPhone-App: beim Start und bei jeder Rückkehr in die App auf den neuesten Stand bringen.
  useEffect(() => {
    if (!hasNativeLibrary()) return;
    let running = false;
    const sync = async (initial: boolean) => {
      const scopes = savedScopes();
      if (!scopes.length || running) return;
      const { status } = await PhotoLibrary.checkAccess().catch(() => ({ status: "denied" as AccessStatus }));
      if (status !== "authorized" && status !== "limited") return;
      running = true;
      try {
        const photos = Object.values(stateRef.current.photos);
        for (const scope of scopes) await importFromLibrary(initial ? scope : catchUpScope(scope, photos), { quiet: true, remember: false });
      } finally {
        running = false;
      }
    };
    void sync(true);
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [importFromLibrary]);

  const importDemo = useCallback(async () => {
    try {
      const items = await loadDemo();
      const photos: Photo[] = [];
      for (const item of items) {
        photos.push({
          id: await fileId(item.file),
          file: item.file,
          name: item.file.name,
          size: item.file.size,
          type: item.file.type,
          lastModified: item.file.lastModified,
          source: "beispiel",
          status: "wartet",
          categories: [],
          takenAt: item.takenAt,
          gps: item.gps,
          place: item.place,
          credit: item.credit,
        });
      }
      addPhotos(photos);
    } catch {
      notify("Die Beispielfotos konnten nicht geladen werden.", "fehler");
    }
  }, [addPhotos, notify]);

  const setManualCategories = useCallback(
    (id: string, categories: CategoryId[] | undefined) => {
      dispatch({ type: "patchPhotos", patches: { [id]: { manualCategories: categories?.length ? categories : undefined } } });
      stateRef.current = {
        ...stateRef.current,
        photos: { ...stateRef.current.photos, [id]: { ...stateRef.current.photos[id], manualCategories: categories } },
      };
      saveCorrections();
    },
    [saveCorrections],
  );

  const setExcluded = useCallback(
    (ids: string[], excluded: boolean) => {
      const patches = Object.fromEntries(ids.map((id) => [id, { excluded }]));
      dispatch({ type: "patchPhotos", patches });
      const photos = { ...stateRef.current.photos };
      for (const id of ids) if (photos[id]) photos[id] = { ...photos[id], excluded };
      stateRef.current = { ...stateRef.current, photos };
      saveCorrections();
    },
    [saveCorrections],
  );

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      dispatch({ type: "settings", patch });
      stateRef.current = { ...stateRef.current, settings: { ...stateRef.current.settings, ...patch } };
      if (patch.recognition === true && stateRef.current.models === "fehler") {
        dispatch({ type: "models", state: "aus" });
        stateRef.current = { ...stateRef.current, models: "aus" };
      }
    },
    [],
  );

  const catchUpRecognition = useCallback(() => {
    const ids = Object.values(stateRef.current.photos)
      .filter((p) => p.status === "fertig" && !p.recognition)
      .map((p) => p.id);
    if (stateRef.current.models === "fehler") {
      dispatch({ type: "models", state: "aus" });
      stateRef.current = { ...stateRef.current, models: "aus" };
    }
    enqueue(ids);
  }, [enqueue]);

  const clearPhotos = useCallback(() => {
    for (const p of Object.values(stateRef.current.photos)) if (p.thumbUrl) URL.revokeObjectURL(p.thumbUrl);
    for (const patch of Object.values(pending.current)) if (patch.thumbUrl) URL.revokeObjectURL(patch.thumbUrl);
    pending.current = {};
    queue.current = [];
    batch.current = { total: 0, done: 0 };
    dispatch({ type: "clear" });
    stateRef.current = { ...stateRef.current, photos: {}, order: [] };
  }, []);

  const forgetEverything = useCallback(async () => {
    clearPhotos();
    await forgetCache();
    forgetScopes();
    if (hasNativeLibrary()) await PhotoLibrary.clearCache().catch(() => undefined);
    for (const key of Object.values(KEYS)) {
      try {
        localStorage.removeItem(key);
      } catch {
        // egal
      }
    }
    try {
      localStorage.removeItem("fotogeschichten.orte.v1");
    } catch {
      // egal
    }
    for (const s of stateRef.current.stories) dispatch({ type: "deleteStory", id: s.id });
    dispatch({ type: "settings", patch: DEFAULT_SETTINGS });
  }, [clearPhotos]);

  const photos = useMemo(() => state.order.map((id) => state.photos[id]).filter(Boolean), [state.order, state.photos]);
  const events = useMemo(() => buildEvents(photos, { gapHours: state.settings.eventGapHours }), [photos, state.settings.eventGapHours]);

  const value: StoreValue = {
    state,
    photos,
    events,
    importFiles,
    importDemo,
    importFromLibrary,
    setManualCategories,
    setExcluded,
    updateSettings,
    saveStory: (story) => dispatch({ type: "saveStory", story }),
    deleteStory: (id) => dispatch({ type: "deleteStory", id }),
    clearPhotos,
    removeDemo,
    forgetEverything,
    catchUpRecognition,
    notify,
  };
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore außerhalb des StoreProvider");
  return value;
}
