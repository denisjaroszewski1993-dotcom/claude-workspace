import { useState, type DragEvent } from "react";
import { FileArchive, FolderOpen, ImagePlus, ShieldCheck, Sparkles } from "lucide-react";
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
      <ImportOptions onPicked={onClose} />
      <ICloudGuide open />
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
      <ImportOptions />
      <div className="btn-row">
        <button type="button" className="btn btn-quiet btn-small" onClick={() => void importDemo()}>
          <Sparkles size={16} /> Erst mal mit Beispielfotos ausprobieren
        </button>
      </div>
      <ICloudGuide />
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
        <button type="button" className="btn btn-small" onClick={() => ui.pickFiles("fotos")}>
          <ImagePlus size={16} /> Fotos
        </button>
        <button type="button" className="btn btn-small" onClick={() => ui.pickFiles("ordner")}>
          <FolderOpen size={16} /> Ordner
        </button>
        <button type="button" className="btn btn-small" onClick={() => ui.pickFiles("zip")}>
          <FileArchive size={16} /> ZIP
        </button>
        <button type="button" className="btn btn-small btn-quiet" onClick={() => ui.openImport()}>
          iCloud: so geht’s
        </button>
      </div>
    </div>
  );
}
