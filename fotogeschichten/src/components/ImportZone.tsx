import { useState, type DragEvent } from "react";
import { FolderOpen, ImagePlus, ShieldCheck, Sparkles } from "lucide-react";
import { useStore } from "../state/store";
import { useUi } from "../state/ui";

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

export function ImportHero() {
  const { importDemo } = useStore();
  const ui = useUi();
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
      <div className="btn-row">
        <button type="button" className="btn btn-primary" onClick={() => ui.pickFiles()}>
          <ImagePlus size={18} /> Fotos auswählen
        </button>
        <button type="button" className="btn" onClick={() => ui.pickFiles(true)}>
          <FolderOpen size={18} /> Ganzen Ordner
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => void importDemo()}>
          <Sparkles size={18} /> Mit Beispielfotos ausprobieren
        </button>
      </div>
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
      <p>Weitere Fotos hierher ziehen oder auswählen – bereits bekannte werden erkannt und übersprungen.</p>
      <div className="btn-row">
        <button type="button" className="btn btn-small" onClick={() => ui.pickFiles()}>
          <ImagePlus size={16} /> Fotos
        </button>
        <button type="button" className="btn btn-small btn-quiet" onClick={() => ui.pickFiles(true)}>
          <FolderOpen size={16} /> Ordner
        </button>
      </div>
    </div>
  );
}
