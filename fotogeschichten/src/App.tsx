import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CalendarDays, Compass, Eraser, ImagePlus, Images, LayoutDashboard, PackageOpen, Settings, X } from "lucide-react";
import type { CategoryId, StorySource } from "./types";
import { effectiveCategories } from "./lib/categories";
import { groupsFromMarks } from "./lib/duplicates";
import { remaining, type EtaStart } from "./lib/eta";
import { hasNativeLibrary, PhotoLibrary } from "./lib/nativeLibrary";
import { useStore } from "./state/store";
import { UiContext, type Tab, type UiActions } from "./state/ui";
import { ImportDialog, ImportHero } from "./components/ImportZone";
import { PhotoDetail } from "./components/PhotoDetail";
import { StoryCreator } from "./components/StoryCreator";
import { StoryReader } from "./components/StoryReader";
import { Slideshow } from "./components/Slideshow";
import { ExportDialog } from "./components/ExportDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { Overview } from "./views/Overview";
import { PhotosView } from "./views/PhotosView";
import { TimelineView } from "./views/TimelineView";
import { EventsView } from "./views/EventsView";
import { StoriesView } from "./views/StoriesView";
import { CleanupView } from "./views/CleanupView";

const TABS: { id: Tab; label: string; short: string; icon: typeof Images; mobile: boolean }[] = [
  { id: "uebersicht", label: "Übersicht", short: "Start", icon: LayoutDashboard, mobile: true },
  { id: "fotos", label: "Fotos", short: "Fotos", icon: Images, mobile: true },
  { id: "zeitleiste", label: "Zeitleiste", short: "Zeitleiste", icon: CalendarDays, mobile: true },
  { id: "erlebnisse", label: "Erlebnisse", short: "Erlebnisse", icon: Compass, mobile: true },
  { id: "geschichten", label: "Geschichten", short: "Geschichten", icon: BookOpen, mobile: true },
  // Auf dem Handy über die Übersicht erreichbar, damit die Leiste lesbar bleibt
  { id: "aufraeumen", label: "Aufräumen", short: "Aufräumen", icon: Eraser, mobile: false },
];

/** „noch ca. 12 Min.“ unter dem Fortschrittsbalken. */
function useEta(total: number, done: number): string | undefined {
  const start = useRef<EtaStart | undefined>(undefined);
  const [eta, setEta] = useState<string>();
  useEffect(() => {
    if (total === 0 || done >= total) {
      start.current = undefined;
      setEta(undefined);
    } else if (!start.current || done < start.current.done) {
      // Neuer Durchlauf: ab dem ersten fertigen Foto messen.
      start.current = done > 0 ? { at: Date.now(), done } : undefined;
      setEta(undefined);
    } else {
      setEta(remaining(start.current, Date.now(), done, total));
    }
  }, [total, done]);
  return eta;
}

const FIRST_VISIT_KEY = "fotogeschichten.besucht.v1";

function isFirstVisit(): boolean {
  try {
    if (localStorage.getItem(FIRST_VISIT_KEY)) return false;
    localStorage.setItem(FIRST_VISIT_KEY, "1");
    return true;
  } catch {
    return true;
  }
}

export function App() {
  const store = useStore();
  const { state, photos, events, importFiles, importDemo, removeDemo } = store;
  const [tab, setTab] = useState<Tab>(() => {
    const fromHash = location.hash.slice(1) as Tab;
    return TABS.some((t) => t.id === fromHash) ? fromHash : "uebersicht";
  });
  const [filter, setFilter] = useState<CategoryId | "alle">("alle");
  const [detail, setDetail] = useState<{ id: string; list: string[] } | null>(null);
  const [creator, setCreator] = useState<{ source?: StorySource; photoIds?: string[] } | null>(null);
  const [reader, setReader] = useState<{ id: string; claude: boolean } | null>(null);
  const [slideshow, setSlideshow] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);

  // Beim allerersten Besuch zeigt die App gleich die Beispielfotos –
  // nicht in der iPhone-App, dort geht es direkt um die eigene Mediathek.
  useEffect(() => {
    if (isFirstVisit() && !hasNativeLibrary()) void importDemo();
  }, [importDemo]);

  useEffect(() => {
    if (!TABS.some((t) => t.id === tab) || location.hash.slice(1) === tab) return;
    try {
      history.replaceState(null, "", `#${tab}`);
    } catch {
      // in eingebetteten Ansichten nicht erlaubt – dann eben ohne Sprungmarke
    }
  }, [tab]);

  const goTab = useCallback((t: Tab) => {
    setTab(t);
    window.scrollTo({ top: 0 });
  }, []);

  const ui: UiActions = useMemo(
    () => ({
      setTab: goTab,
      showCategory: (id) => {
        setFilter(id);
        goTab("fotos");
      },
      openPhoto: (id, list) => setDetail({ id, list }),
      openCreator: (source, photoIds) => setCreator({ source, photoIds }),
      openStory: (id) => setReader({ id, claude: false }),
      openExport: () => setExportOpen(true),
      openSettings: () => setSettingsOpen(true),
      openImport: () => setImportOpen(true),
      pickFiles: (kind) => ({ fotos: filesInput, ordner: folderInput, zip: zipInput })[kind].current?.click(),
    }),
    [goTab],
  );

  const onFiles = async (list: FileList | null, input: HTMLInputElement) => {
    const files = list ? [...list] : [];
    input.value = "";
    if (!files.length) return;
    const added = await importFiles(files);
    if (added > 0 && tab !== "uebersicht") goTab("uebersicht");
  };

  // Während der Analyse den Bildschirm wach halten – sonst pausiert das iPhone die Seite.
  const analysing = state.progress.total > 0 && state.progress.done < state.progress.total;
  useEffect(() => {
    if (!analysing) return;
    type Lock = { release(): Promise<void> };
    const wakeLock = (navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<Lock> } }).wakeLock;
    let lock: Lock | undefined;
    let released = false;
    // In der iPhone-App übernimmt das iOS selbst (zuverlässiger als im Browser).
    if (hasNativeLibrary()) void PhotoLibrary.keepAwake({ enabled: true }).catch(() => undefined);
    wakeLock
      ?.request("screen")
      .then((l) => {
        if (released) void l.release().catch(() => undefined);
        else lock = l;
      })
      .catch(() => undefined);
    return () => {
      released = true;
      void lock?.release().catch(() => undefined);
      if (hasNativeLibrary()) void PhotoLibrary.keepAwake({ enabled: false }).catch(() => undefined);
    };
  }, [analysing]);

  const hasPhotos = photos.length > 0;
  const demo = photos.some((p) => p.source === "beispiel");
  const { total, done } = state.progress;
  const busy = analysing;
  const eta = useEta(total, done);
  const counts: Partial<Record<Tab, number>> = {
    fotos: photos.length,
    erlebnisse: events.filter((e) => e.kind !== "ohne-datum").length,
    geschichten: state.stories.length,
    aufraeumen:
      groupsFromMarks(photos).length + photos.filter((p) => p.quality?.blurry && !p.duplicateOf && !p.excluded).length,
  };

  const tabButtons = (bottom: boolean) =>
    TABS.filter((t) => !bottom || t.mobile).map((t) => {
      const Icon = t.icon;
      return (
        <button key={t.id} type="button" className="tab" aria-current={tab === t.id ? "page" : undefined} onClick={() => goTab(t.id)}>
          {bottom && <Icon size={20} aria-hidden="true" />}
          {bottom ? t.short : t.label}
          {!bottom && counts[t.id] ? <span className="count">{counts[t.id]}</span> : null}
        </button>
      );
    });

  const modelNote =
    state.models === "laedt" ? "Die KI-Erkennung wird geladen (einmalig ca. 31 MB) …" : state.models === "bereit" ? "Motive, Personen, Farben und Schärfe werden erkannt." : "Datum, Ort, Farben und Schärfe werden gelesen.";

  return (
    <UiContext.Provider value={ui}>
      <div className="app">
        <header className="topbar">
          <div className="topbar-inner">
            <div className="brand">
              <span className="brand-name">
                Foto<span>geschichten</span>
              </span>
              <span className="brand-tag mono">sortieren · erkennen · erzählen</span>
            </div>
            {hasPhotos && (
              <button
                type="button"
                className="btn btn-small btn-quiet"
                onClick={() => setExportOpen(true)}
                aria-label={hasNativeLibrary() ? "In Fotos-Alben sortieren" : "Sortiert speichern"}
              >
                <PackageOpen size={18} /> <span className="hide-narrow">{hasNativeLibrary() ? "Sortieren" : "Speichern"}</span>
              </button>
            )}
            <button type="button" className="btn btn-small btn-primary" onClick={() => setImportOpen(true)} aria-label="Fotos hinzufügen">
              <ImagePlus size={18} /> <span className="hide-narrow">Fotos hinzufügen</span>
            </button>
            <button type="button" className="btn btn-small btn-quiet btn-icon" onClick={() => setSettingsOpen(true)} aria-label="Einstellungen">
              <Settings size={19} />
            </button>
          </div>
          {hasPhotos && (
            <nav className="tabs tabs-top" aria-label="Bereiche">
              {tabButtons(false)}
            </nav>
          )}
        </header>

        <main className="main">
          {busy && (
            <section className="progress" aria-live="polite">
              <div className="progress-row">
                <strong className="num">
                  Analysiere {done.toLocaleString("de-DE")} von {total.toLocaleString("de-DE")} Fotos{eta ? ` · ${eta}` : ""}
                </strong>
                <span className="muted small">{modelNote}</span>
              </div>
              <div className="filmstrip" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
                <div className="filmstrip-fill" style={{ width: `${(done / total) * 100}%` }} />
              </div>
            </section>
          )}

          {demo && (
            <div className="banner">
              <p>Du siehst Beispielfotos mit erfundenen Daten. Sobald du eigene Fotos hinzufügst, verschwinden sie.</p>
              <button type="button" className="btn btn-small" onClick={() => setImportOpen(true)}>
                Eigene Fotos wählen
              </button>
              <button type="button" className="btn btn-small btn-icon" onClick={removeDemo} aria-label="Beispielfotos entfernen">
                <X size={16} />
              </button>
            </div>
          )}

          {!hasPhotos ? (
            <ImportHero />
          ) : tab === "uebersicht" ? (
            <Overview />
          ) : tab === "fotos" ? (
            <PhotosView filter={filter} onFilter={setFilter} />
          ) : tab === "zeitleiste" ? (
            <TimelineView />
          ) : tab === "erlebnisse" ? (
            <EventsView />
          ) : tab === "geschichten" ? (
            <StoriesView />
          ) : (
            <CleanupView />
          )}
        </main>

        <footer className="site">
          <span>Fotogeschichten läuft vollständig in deinem Browser.</span>
          <span>{photos.filter((p) => p.status === "fertig" && effectiveCategories(p).length).length} Fotos sortiert</span>
        </footer>

        {hasPhotos && (
          <nav className="bottom-nav" aria-label="Bereiche">
            {tabButtons(true)}
          </nav>
        )}

        <input ref={filesInput} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => void onFiles(e.target.files, e.target)} />
        <input ref={zipInput} type="file" accept=".zip,application/zip,application/x-zip-compressed" multiple hidden onChange={(e) => void onFiles(e.target.files, e.target)} />
        <input
          ref={folderInput}
          type="file"
          multiple
          hidden
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          onChange={(e) => void onFiles(e.target.files, e.target)}
        />

        {detail && <PhotoDetail id={detail.id} list={detail.list} onNavigate={(id) => setDetail({ ...detail, id })} onClose={() => setDetail(null)} />}
        {creator && (
          <StoryCreator
            initialSource={creator.source}
            initialPhotoIds={creator.photoIds}
            onClose={() => setCreator(null)}
            onCreated={(id, claude) => {
              setCreator(null);
              setReader({ id, claude });
            }}
          />
        )}
        {reader && !slideshow && (
          <StoryReader storyId={reader.id} startWithClaude={reader.claude} onClose={() => setReader(null)} onSlideshow={() => {
              setReader({ id: reader.id, claude: false });
              setSlideshow(reader.id);
            }} />
        )}
        {slideshow && <Slideshow storyId={slideshow} onClose={() => setSlideshow(null)} />}
        {exportOpen && <ExportDialog onClose={() => setExportOpen(false)} />}
        {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
        {importOpen && <ImportDialog onClose={() => setImportOpen(false)} />}
        <Toast />
      </div>
    </UiContext.Provider>
  );
}

function Toast() {
  const { state } = useStore();
  const [hidden, setHidden] = useState<number>();
  const notice = state.notice;
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setHidden(notice.id), notice.tone === "fehler" ? 9000 : 5000);
    return () => clearTimeout(t);
  }, [notice]);
  if (!notice || hidden === notice.id) return null;
  return (
    <div className={`toast ${notice.tone}`} role="status">
      <p>{notice.text}</p>
      <button type="button" className="btn btn-small btn-icon" onClick={() => setHidden(notice.id)} aria-label="Hinweis schließen">
        <X size={16} />
      </button>
    </div>
  );
}
