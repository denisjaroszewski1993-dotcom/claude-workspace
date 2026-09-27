import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import type { CategoryId, Photo, PhotoEvent, Settings, Story } from "../types";
import { analyzeFile, fileId, forgetCache } from "../lib/analyze";
import { categorize } from "../lib/categorize";
import { loadDemo } from "../lib/demo";
import { duplicateMap } from "../lib/duplicates";
import { buildEvents } from "../lib/events";
import { reverseGeocode } from "../lib/geo";
import { loadModels } from "../lib/recognition";
import { imagesFromZip, isZipFile } from "../lib/zip";

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

  const work = useCallback(async () => {
    const useRecognition = await ensureModels();
    while (queue.current.length) {
      const id = queue.current.shift()!;
      const photo = stateRef.current.photos[id];
      if (!photo) continue;
      try {
        const result = await analyzeFile(photo.file, { id, recognition: useRecognition });
        const takenAt = photo.takenAt ?? result.meta.takenAt;
        const patch: Partial<Photo> = {
          status: "fertig",
          width: result.width,
          height: result.height,
          thumbUrl: photo.thumbUrl ?? URL.createObjectURL(result.thumb),
          thumb: result.thumb,
          takenAt,
          dateSource: photo.source === "beispiel" ? "exif" : result.meta.dateSource,
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
          }),
        };
        dispatch({ type: "patchPhotos", patches: { [id]: patch } });
        // Wurde das Foto inzwischen entfernt (z. B. Beispielfotos), nicht wieder einfügen.
        if (stateRef.current.photos[id]) {
          stateRef.current = { ...stateRef.current, photos: { ...stateRef.current.photos, [id]: { ...photo, ...patch } } };
        }
      } catch (err) {
        const heic = /heic|heif/i.test(photo.type) || /\.hei[cf]$/i.test(photo.name);
        dispatch({
          type: "patchPhotos",
          patches: {
            [id]: {
              status: "fehler",
              error: heic
                ? "HEIC-Fotos kann dieser Browser nicht öffnen. In Safari klappt es – oder am iPhone unter Einstellungen › Kamera › Formate „Maximale Kompatibilität“ wählen."
                : `Dieses Bild ließ sich nicht öffnen (${(err as Error).message || "unbekannter Fehler"}).`,
            },
          },
        });
      }
      batch.current.done++;
      dispatch({ type: "progress", ...batch.current });
    }
  }, [ensureModels]);

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
      markDuplicates();
      batch.current = { total: 0, done: 0 };
      dispatch({ type: "progress", total: 0, done: 0 });
      void lookUpPlaces();
    }
  }, [work, markDuplicates, lookUpPlaces]);
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
    for (const p of demo) if (p.thumbUrl) URL.revokeObjectURL(p.thumbUrl);
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
    queue.current = [];
    dispatch({ type: "clear" });
    stateRef.current = { ...stateRef.current, photos: {}, order: [] };
  }, []);

  const forgetEverything = useCallback(async () => {
    clearPhotos();
    await forgetCache();
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
