import { useEffect, useState, type DragEvent } from "react";
import { FileArchive, FolderOpen, ImagePlus, Library, ShieldCheck, Sparkles } from "lucide-react";
import { albumScope, rangeScope } from "../lib/libraryImport";
import { hasNativeLibrary, PhotoLibrary, type AccessStatus, type NativeAlbum } from "../lib/nativeLibrary";
import { detectDevice, type Device } from "../lib/platform";
import { useStore } from "../state/store";
import { useUi, type PickKind } from "../state/ui";
import { Dialog } from "./common";

async function filesFromDrop(e: DragEvent): Promise<File[]> {
  const items = [...e.dataTransfer.items];
  const entries = items.map((i) => (i as DataTransferItem & { webkitGetAsEntry?(): FileSystemEntry | null }).webkitGetAsEntry?.()).filter(Boolean) as FileSystemEntry[];
  if (!entries.length) return [...e.dataTransfer.files];
  const out: File[] = [];
  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      out.push(await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej)));
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      let batch: FileSystemEntry[];
      do {
        batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        for (const child of batch) await walk(child);
      } while (batch.length);
    }
  };
  for (const entry of entries) await walk(entry);
  return out;
}

function useDrop() {
  const { importFiles } = useStore();
  const [active, setActive] = useState(false);
  return {
    active,
    handlers: {
      onDragOver: (e: DragEvent) => {
        e.preventDefault();
        setActive(true);
      },
      onDragLeave: () => setActive(false),
      onDrop: async (e: DragEvent) => {
        e.preventDefault();
        setActive(false);
        await importFiles(await filesFromDrop(e));
      },
    },
  };
}

const TIPS: Record<PickKind, Partial<Record<Device, string>> & { standard: string }> = {
  fotos: {
    ios: "Viele auf einmal: Finger auf ein Foto legen und über die Reihen ziehen.",
    android: "Viele auf einmal: ein Foto lange drücken und über die anderen ziehen.",
    mac: "Im Auswahlfenster steht links unter „Medien“ oft „Fotos“ – dort markiert ⌘A alle.",
    standard: "Strg+A markiert alle Bilder im geöffneten Ordner.",
  },
  ordner: {
    ios: "Aus der Dateien-App, z. B. iCloud Drive (ab iOS 18.4).",
    windows: "Mit iCloud für Windows einfach den Ordner „iCloud Fotos“ wählen.",
    standard: "Alle Bilder eines Ordners samt Unterordnern.",
  },
  zip: {
    standard: "Zum Beispiel ein Download von iCloud.com mit bis zu 1.000 Fotos.",
  },
};

const tip = (kind: PickKind, device: Device) => TIPS[kind][device] ?? TIPS[kind].standard;

/** Die drei Wege, Fotos hineinzuholen – mit Hinweisen passend zum Gerät. */
export function ImportOptions({ onPicked }: { onPicked?: () => void }) {
  const ui = useUi();
  const device = detectDevice();
  const pick = (kind: PickKind) => {
    ui.pickFiles(kind);
    onPicked?.();
  };
  return (
    <div className="import-options">
      <button type="button" className="import-option primary" onClick={() => pick("fotos")}>
        <ImagePlus size={22} aria-hidden="true" />
        <strong>Fotomediathek</strong>
        <span>Einzelne oder viele Fotos – auch aus iCloud.</span>
        <em>{tip("fotos", device)}</em>
      </button>
      <button type="button" className="import-option" onClick={() => pick("ordner")}>
        <FolderOpen size={22} aria-hidden="true" />
        <strong>Ganzer Ordner</strong>
        <span>Alle Bilder auf einmal, ohne einzeln zu tippen.</span>
        <em>{tip("ordner", device)}</em>
      </button>
      <button type="button" className="import-option" onClick={() => pick("zip")}>
        <FileArchive size={22} aria-hidden="true" />
        <strong>ZIP-Datei</strong>
        <span>Wird automatisch ausgepackt.</span>
        <em>{tip("zip", device)}</em>
      </button>
    </div>
  );
}

type Range = "30-tage" | "12-monate" | "alles";

const RANGES: { id: Range; label: string }[] = [
  { id: "30-tage", label: "Letzte 30 Tage" },
  { id: "12-monate", label: "Letzte 12 Monate" },
  { id: "alles", label: "Alle Fotos" },
];

/** iPhone-App: die Mediathek direkt einlesen – ganz, nach Zeitraum oder als Album. */
export function LibraryImport({ onDone }: { onDone?: () => void }) {
  const { importFromLibrary } = useStore();
  const [status, setStatus] = useState<AccessStatus | null>(null);
  const [range, setRange] = useState<Range>("12-monate");
  const [albums, setAlbums] = useState<NativeAlbum[] | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () =>
    PhotoLibrary.checkAccess()
      .then((r) => setStatus(r.status))
      .catch(() => setStatus("denied"));
  useEffect(() => {
    void refresh();
  }, []);

  const run = async (scope: Parameters<typeof importFromLibrary>[0]) => {
    setBusy(true);
    try {
      const added = await importFromLibrary(scope);
      if (added > 0) onDone?.();
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const showAlbums = async () => {
    if (status === "notDetermined") setStatus((await PhotoLibrary.requestAccess()).status);
    setAlbums((await PhotoLibrary.getAlbums()).albums);
  };

  if (status === "denied" || status === "restricted") {
    return (
      <section className="library">
        <div className="library-head">
          <Library size={24} aria-hidden="true" />
          <div>
            <strong>Kein Zugriff auf deine Fotos</strong>
            <span>Erlaube Fotogeschichten in den Einstellungen den Zugriff auf „Alle Fotos“ – dann liest die App deine Mediathek direkt ein.</span>
          </div>
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={() => void PhotoLibrary.openSettings()}>
            Einstellungen öffnen
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="library" aria-labelledby="library-title">
      <div className="library-head">
        <Library size={24} aria-hidden="true" />
        <div>
          <strong id="library-title">Deine Mediathek</strong>
          <span>Direkt vom iPhone, auch Fotos aus iCloud – ohne einzeln auszuwählen.</span>
        </div>
      </div>
      <div className="chips" role="radiogroup" aria-label="Zeitraum">
        {RANGES.map((r) => (
          <button key={r.id} type="button" role="radio" className="chip plain" aria-checked={range === r.id} aria-pressed={range === r.id} onClick={() => setRange(r.id)}>
            {r.label}
          </button>
        ))}
      </div>
      <div className="btn-row">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run(rangeScope(range))}>
          {busy ? "Wird eingelesen …" : "Fotos einlesen"}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => void showAlbums()}>
          Ein Album wählen
        </button>
      </div>
      {albums && (
        <ul className="album-list" aria-label="Alben">
          {albums.map((a) => (
            <li key={a.id}>
              <button type="button" disabled={busy} onClick={() => void run(albumScope(a.id, a.title))}>
                <span>{a.title}</span>
                <span className="mono muted num">{a.count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {status === "limited" && (
        <p className="library-note">
          Du hast nur ausgewählte Fotos freigegeben.{" "}
          <button type="button" className="btn-link" onClick={() => void PhotoLibrary.manageLimitedSelection().then(refresh)}>
            Auswahl ändern
          </button>{" "}
          ·{" "}
          <button type="button" className="btn-link" onClick={() => void PhotoLibrary.openSettings()}>
            Alle Fotos erlauben
          </button>
        </p>
      )}
      <p className="library-note">
        Fotos, die nur in iCloud liegen, lädt das iPhone beim Analysieren nach. Bei tausenden Fotos dauert der erste Durchlauf eine Weile; danach kommen neue Fotos beim Öffnen der App
        automatisch dazu.
      </p>
    </section>
  );
}

/** Schritt-für-Schritt: alle iCloud-Fotos auf einmal hineinholen. */
export function ICloudGuide({ open }: { open?: boolean }) {
  const device = detectDevice();
  const phone = (
    <section key="phone">
      <h4>Am iPhone oder iPad</h4>
      <ol>
        <li>
          In der <b>Fotos</b>-App ein Album öffnen, oben <b>Auswählen</b> und dann <b>Alle auswählen</b> tippen (oder mit dem Finger über die Fotos ziehen).
        </li>
        <li>
          <b>Teilen</b>-Symbol › <b>In Dateien sichern</b> › einen Ordner wählen, z. B. „Auf meinem iPhone › Fotogeschichten“. Unter <b>Optionen</b> den Standort eingeschaltet lassen – dann erkennt die App auch Orte und Reisen.
        </li>
        <li>
          Hier auf <b>Ganzer Ordner</b> tippen und genau diesen Ordner öffnen (ab iOS 18.4). Danach kannst du den Ordner in der Dateien-App wieder löschen.
        </li>
      </ol>
    </section>
  );
  const computer = (
    <section key="computer">
      <h4>Am Mac oder PC</h4>
      <ol>
        <li>
          <a href="https://www.icloud.com/photos/" target="_blank" rel="noreferrer">
            icloud.com/photos
          </a>{" "}
          öffnen und anmelden.
        </li>
        <li>
          <b>⌘A</b> (Mac) bzw. <b>Strg+A</b> (Windows) drücken und auf das Download-Symbol klicken. iCloud packt die Fotos in eine ZIP-Datei – bis zu 1.000 pro Durchgang.
        </li>
        <li>
          Die ZIP-Datei hier unter <b>ZIP-Datei</b> auswählen oder einfach hineinziehen.
        </li>
      </ol>
      <p>
        Mit <b>iCloud für Windows</b> geht es noch schneller: <b>Ganzer Ordner</b> › „iCloud Fotos“.
      </p>
    </section>
  );
  return (
    <details className="guide" open={open}>
      <summary>Alle iCloud-Fotos auf einmal – so geht’s</summary>
      <div className="guide-body">
        {device === "ios" ? [phone, computer] : [computer, phone]}
        <p className="guide-note">
          Warum nicht direkt aus iCloud? Apple lässt Webseiten nicht in die iCloud-Mediathek schauen – das dürfen nur Apps. Deine Fotos bleiben auch hier auf deinem Gerät.
        </p>
      </div>
    </details>
  );
}

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const { photos, importDemo } = useStore();
  return (
    <Dialog
      title="Fotos hinzufügen"
      onClose={onClose}
      footer={
        photos.length === 0 ? (
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => {
              void importDemo();
              onClose();
            }}
          >
            <Sparkles size={18} /> Beispielfotos laden
          </button>
        ) : undefined
      }
    >
      {hasNativeLibrary() ? (
        <>
          <LibraryImport onDone={onClose} />
          <h3 className="subhead">Weitere Wege</h3>
          <ImportOptions onPicked={onClose} />
        </>
      ) : (
        <>
          <ImportOptions onPicked={onClose} />
          <ICloudGuide open />
        </>
      )}
    </Dialog>
  );
}

export function ImportHero() {
  const { importDemo } = useStore();
  const { active, handlers } = useDrop();
  return (
    <section className={`dropzone${active ? " active" : ""}`} {...handlers}>
      <p className="mono muted">Leuchttisch für deine Fotos</p>
      <h1>
        Fotos rein. <em>Ordnung und Geschichten</em> raus.
      </h1>
      <p className="lead">
        Die App erkennt Motive, Menschen, Orte und Tageszeiten, sortiert alles in Kategorien und Erlebnisse – und erzählt daraus Bildgeschichten.
      </p>
      {hasNativeLibrary() && <LibraryImport />}
      <ImportOptions />
      <div className="btn-row">
        <button type="button" className="btn btn-quiet btn-small" onClick={() => void importDemo()}>
          <Sparkles size={16} /> Erst mal mit Beispielfotos ausprobieren
        </button>
      </div>
      {!hasNativeLibrary() && <ICloudGuide />}
      <div className="steps">
        <div className="step">
          <span className="mono">1 · Erkennen</span>
          <p>Datum, Ort, Kamera, Farben, Schärfe und – per KI im Browser – Motive und Personen.</p>
        </div>
        <div className="step">
          <span className="mono">2 · Sortieren</span>
          <p>16 Kategorien, Zeitleiste, Erlebnisse und Reisen, dazu doppelte und unscharfe Bilder.</p>
        </div>
        <div className="step">
          <span className="mono">3 · Erzählen</span>
          <p>Als Erzählung, Märchen oder Tagebuch – zum Lesen, als Diashow oder zum Verschicken.</p>
        </div>
      </div>
      <p className="privacy">
        <ShieldCheck size={18} className="privacy-icon" />
        Deine Fotos bleiben auf deinem Gerät. Die Analyse läuft komplett im Browser; nichts wird hochgeladen. Nur wenn du es ausdrücklich einschaltest, gehen Koordinaten an OpenStreetMap
        oder Vorschaubilder an Claude.
      </p>
    </section>
  );
}

export function ImportCompact() {
  const ui = useUi();
  const { active, handlers } = useDrop();
  return (
    <div className={`dropzone dropzone-compact${active ? " active" : ""}`} {...handlers}>
      <p>Weitere Fotos, Ordner oder ZIP-Dateien hierher ziehen – bereits bekannte Fotos werden erkannt und übersprungen.</p>
      <div className="btn-row">
        {hasNativeLibrary() && (
          <button type="button" className="btn btn-small btn-primary" onClick={() => ui.openImport()}>
            <Library size={16} /> Mediathek
          </button>
        )}
        <button type="button" className="btn btn-small" onClick={() => ui.pickFiles("fotos")}>
          <ImagePlus size={16} /> Fotos
        </button>
        <button type="button" className="btn btn-small" onClick={() => ui.pickFiles("ordner")}>
          <FolderOpen size={16} /> Ordner
        </button>
        <button type="button" className="btn btn-small" onClick={() => ui.pickFiles("zip")}>
          <FileArchive size={16} /> ZIP
        </button>
        {!hasNativeLibrary() && (
          <button type="button" className="btn btn-small btn-quiet" onClick={() => ui.openImport()}>
            iCloud: so geht’s
          </button>
        )}
      </div>
    </div>
  );
}
