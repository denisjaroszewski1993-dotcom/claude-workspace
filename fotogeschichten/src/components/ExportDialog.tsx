import { useMemo, useState } from "react";
import { FolderDown, PackageOpen } from "lucide-react";
import { canWriteFolders, exportToFolder, exportZip, planExport, type ExportStructure } from "../lib/exporter";
import { saveFile, SaveError } from "../lib/platform";
import { useStore } from "../state/store";
import { Dialog, Option, Switch } from "./common";

export function ExportDialog({ onClose }: { onClose: () => void }) {
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
