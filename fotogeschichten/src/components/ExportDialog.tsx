import { useMemo, useState } from "react";
import { FolderDown, Images, PackageOpen, Undo2 } from "lucide-react";
import { canWriteFolders, exportToFolder, exportZip, planAlbums, planExport, type ExportStructure } from "../lib/exporter";
import { ALBUM_PREFIX, hasNativeLibrary, PhotoLibrary } from "../lib/nativeLibrary";
import { saveFile, SaveError } from "../lib/platform";
import { useStore } from "../state/store";
import { Dialog, Option, Switch } from "./common";

/** iPhone-App: Fotos in Alben der Fotos-App einsortieren – ohne Kopien. */
function AlbumExport({ onClose }: { onClose: () => void }) {
  const { photos, events, notify } = useStore();
  const [structure, setStructure] = useState<ExportStructure>("kategorie");
  const [includeSorted, setIncludeSorted] = useState(false);
  const [busy, setBusy] = useState<string>();
  const plan = useMemo(() => planAlbums(photos, events, { structure, includeSorted }, ALBUM_PREFIX), [photos, events, structure, includeSorted]);
  const count = plan.reduce((n, a) => n + a.ids.length, 0);

  const sort = async () => {
    try {
      for (const [i, album] of plan.entries()) {
        setBusy(`Album ${i + 1} von ${plan.length}: ${album.title.replace(ALBUM_PREFIX, "")} …`);
        await PhotoLibrary.addToAlbum({ title: album.title, ids: album.ids });
      }
      notify(`${plan.length} Alben in der Fotos-App angelegt oder ergänzt.`);
      onClose();
    } catch (err) {
      notify((err as Error).message || "Die Alben konnten nicht angelegt werden.", "fehler");
    } finally {
      setBusy(undefined);
    }
  };

  const undo = async () => {
    setBusy("Alben werden entfernt …");
    try {
      const { deleted } = await PhotoLibrary.deleteAlbums({ prefix: ALBUM_PREFIX });
      notify(deleted ? `${deleted} Alben entfernt – die Fotos selbst sind unverändert.` : "Es gab keine Alben der App.");
    } catch (err) {
      notify((err as Error).message || "Die Alben wurden nicht entfernt.", "fehler");
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <Dialog
      title="In Fotos-Alben sortieren"
      onClose={onClose}
      footer={
        busy ? (
          <p className="status busy">{busy}</p>
        ) : (
          <>
            <button type="button" className="btn btn-quiet" onClick={() => void undo()}>
              <Undo2 size={18} /> Alben der App entfernen
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void sort()} disabled={!plan.length}>
              <Images size={18} /> {plan.length} Alben anlegen
            </button>
          </>
        )
      }
    >
      <p className="muted">
        Die Fotos werden nicht kopiert: Sie erscheinen zusätzlich in Alben mit „{ALBUM_PREFIX.trim()}“ davor und werden über iCloud auf deine anderen Geräte übertragen. Wer ein
        Album löscht, löscht keine Fotos.
      </p>
      <div className="field">
        <span className="label">Alben nach …</span>
        <div className="options">
          <Option value="kategorie" current={structure} onSelect={setStructure} title="Kategorie" text="Strand und Meer, Tiere …" />
          <Option value="erlebnis" current={structure} onSelect={setStructure} title="Erlebnis" text="2025-07-12 Am Meer" />
          <Option value="datum" current={structure} onSelect={setStructure} title="Monat" text="2025 › 07 Juli" />
        </div>
      </div>
      <div className="toggle-row">
        <div>
          <strong>Album „Aussortiert“</strong>
          <p className="muted small">Doppelte, unscharfe und von dir aussortierte Fotos gesammelt – praktisch, um sie danach in der Fotos-App zu löschen.</p>
        </div>
        <Switch checked={includeSorted} onChange={setIncludeSorted} label="Album Aussortiert anlegen" />
      </div>
      <div className="field">
        <span className="label">
          Vorschau · {plan.length} Alben · {count} Fotos
        </span>
        <ul className="tree">
          {plan.map((a) => (
            <li key={a.title}>
              <span>{a.title.replace(ALBUM_PREFIX, "")}</span>
              <span className="muted">{a.ids.length}</span>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const { photos } = useStore();
  if (hasNativeLibrary() && photos.some((p) => p.native)) return <AlbumExport onClose={onClose} />;
  return <FileExport onClose={onClose} />;
}

function FileExport({ onClose }: { onClose: () => void }) {
  const { photos, events, notify } = useStore();
  const [structure, setStructure] = useState<ExportStructure>("kategorie");
  const [datePrefix, setDatePrefix] = useState(true);
  const [includeSorted, setIncludeSorted] = useState(true);
  const [busy, setBusy] = useState<string>();

  const entries = useMemo(() => planExport(photos, events, { structure, datePrefix, includeSorted }), [photos, events, structure, datePrefix, includeSorted]);
  const folders = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      const folder = e.path.split("/").slice(0, -1).join("/");
      counts.set(folder, (counts.get(folder) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], "de"));
  }, [entries]);
  const totalBytes = entries.reduce((s, e) => s + e.photo.size, 0);
  const tooBig = totalBytes > 1.5 * 1024 ** 3;

  const run = async (target: "zip" | "ordner") => {
    try {
      if (target === "zip") {
        const blob = await exportZip(entries, (d, t) => setBusy(`Packe Foto ${d} von ${t} …`));
        setBusy("Speichern …");
        await saveFile("Fotos sortiert.zip", blob);
      } else {
        await exportToFolder(entries, (d, t) => setBusy(`Kopiere Foto ${d} von ${t} …`));
        notify(`${entries.length} Fotos wurden sortiert in den Ordner kopiert.`);
      }
      onClose();
    } catch (err) {
      const aborted = (err as DOMException)?.name === "AbortError" || (err instanceof SaveError && err.declined);
      if (!aborted) notify(err instanceof Error ? err.message : "Export fehlgeschlagen.", "fehler");
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <Dialog
      title="Sortiert speichern"
      onClose={onClose}
      footer={
        busy ? (
          <p className="status busy">{busy}</p>
        ) : (
          <>
            {canWriteFolders() && (
              <button type="button" className="btn" onClick={() => void run("ordner")} disabled={!entries.length}>
                <FolderDown size={18} /> In Ordner kopieren
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={() => void run("zip")} disabled={!entries.length}>
              <PackageOpen size={18} /> Als ZIP speichern
            </button>
          </>
        )
      }
    >
      <p className="muted">Die App legt sortierte Kopien an. Deine Originale bleiben, wo sie sind.</p>
      <div className="field">
        <span className="label">Ordner nach …</span>
        <div className="options">
          <Option value="kategorie" current={structure} onSelect={setStructure} title="Kategorie" text="Strand und Meer, Tiere, Essen …" />
          <Option value="datum" current={structure} onSelect={setStructure} title="Datum" text="2025 / 07 Juli" />
          <Option value="erlebnis" current={structure} onSelect={setStructure} title="Erlebnis" text="2025-07-12 Am Meer" />
        </div>
      </div>
      <div className="toggle-row">
        <div>
          <strong>Datum vor den Dateinamen</strong>
          <p className="muted small">„2025-07-12 10.14.02 IMG_1234.jpg“ – so stimmt die Reihenfolge in jedem Ordner.</p>
        </div>
        <Switch checked={datePrefix} onChange={setDatePrefix} label="Datum vor den Dateinamen" />
      </div>
      <div className="toggle-row">
        <div>
          <strong>Aussortierte und doppelte mitnehmen</strong>
          <p className="muted small">Landen im Ordner „_Aussortiert“, damit du sie prüfen und löschen kannst.</p>
        </div>
        <Switch checked={includeSorted} onChange={setIncludeSorted} label="Aussortierte mitnehmen" />
      </div>
      <div className="field">
        <span className="label">
          Vorschau · {entries.length} Fotos · {(totalBytes / 1024 / 1024).toFixed(0)} MB
        </span>
        <ul className="tree">
          {folders.map(([folder, n]) => (
            <li key={folder}>
              <span>{folder}/</span>
              <span className="muted">{n}</span>
            </li>
          ))}
          <li>
            <span>Übersicht.csv</span>
            <span className="muted">Tabelle</span>
          </li>
        </ul>
        {tooBig && <p className="small">Das ist sehr viel für eine ZIP-Datei im Browser. {canWriteFolders() ? "„In Ordner kopieren“ ist hier zuverlässiger." : "Am besten in mehreren Durchgängen exportieren."}</p>}
      </div>
    </Dialog>
  );
}
