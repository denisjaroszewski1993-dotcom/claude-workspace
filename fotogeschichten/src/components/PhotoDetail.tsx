import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, EyeOff, RotateCcw } from "lucide-react";
import type { CategoryId } from "../types";
import { CATEGORIES, CATEGORY_BY_ID, effectiveCategories } from "../lib/categories";
import { COCO_DE } from "../lib/categorize";
import { formatDate, formatTime } from "../lib/events";
import { labelName } from "../lib/imagenet";
import { useStore } from "../state/store";
import { CategoryChip, Dialog } from "./common";
import { usePhotoUrl } from "./usePhotoUrl";

function sizeLabel(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.round(bytes / 1024)} KB`;
}

export function PhotoDetail({ id, list, onNavigate, onClose }: { id: string; list: string[]; onNavigate: (id: string) => void; onClose: () => void }) {
  const { state, setManualCategories, setExcluded } = useStore();
  const photo = state.photos[id];
  const fullUrl = usePhotoUrl(photo);
  const [editing, setEditing] = useState(false);
  const index = list.indexOf(id);
  const prev = index > 0 ? list[index - 1] : undefined;
  const next = index >= 0 && index < list.length - 1 ? list[index + 1] : undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && prev) onNavigate(prev);
      if (e.key === "ArrowRight" && next) onNavigate(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, onNavigate]);

  const current = useMemo(() => (photo ? effectiveCategories(photo) : []), [photo]);
  if (!photo) return null;

  const toggleCategory = (cat: CategoryId) => {
    const set = new Set<CategoryId>(current.filter((c) => c !== "sonstiges"));
    if (set.has(cat)) set.delete(cat);
    else set.add(cat);
    setManualCategories(photo.id, set.size ? [...set] : ["sonstiges"]);
  };

  const labels = (photo.recognition?.labels ?? []).filter((l) => l.prob >= 0.05);
  const objects = (photo.recognition?.objects ?? []).filter((o) => o.score >= 0.5);
  const objectCounts = new Map<string, number>();
  for (const o of objects) objectCounts.set(o.name, (objectCounts.get(o.name) ?? 0) + 1);

  return (
    <Dialog title={photo.name} onClose={onClose} wide flush>
      <div className="detail">
        <div className="detail-image">
          {fullUrl && <img src={fullUrl} alt="" />}
          {photo.status === "fehler" && <p className="detail-error">{photo.error}</p>}
          <div className="detail-nav">
            {prev ? (
              <button type="button" className="btn btn-icon" onClick={() => onNavigate(prev)} aria-label="Vorheriges Foto">
                <ChevronLeft />
              </button>
            ) : (
              <span />
            )}
            {next && (
              <button type="button" className="btn btn-icon" onClick={() => onNavigate(next)} aria-label="Nächstes Foto">
                <ChevronRight />
              </button>
            )}
          </div>
        </div>

        <div className="detail-info">
          <dl className="facts">
            <dt>Aufnahme</dt>
            <dd>
              {photo.takenAt !== undefined ? `${formatDate(photo.takenAt, true)}, ${formatTime(photo.takenAt)}` : "unbekannt"}
              {photo.dateSource === "datei" && <span className="muted"> (Dateidatum)</span>}
              {photo.dateSource === "dateiname" && <span className="muted"> (aus Dateiname)</span>}
            </dd>
            {(photo.place || photo.gps) && (
              <>
                <dt>Ort</dt>
                <dd>
                  {photo.place ?? ""}
                  {photo.gps && (
                    <>
                      {photo.place ? " · " : ""}
                      <a href={`https://www.openstreetmap.org/?mlat=${photo.gps.lat}&mlon=${photo.gps.lon}#map=13/${photo.gps.lat}/${photo.gps.lon}`} target="_blank" rel="noreferrer">
                        Karte
                      </a>
                    </>
                  )}
                </dd>
              </>
            )}
            {photo.camera && (
              <>
                <dt>Kamera</dt>
                <dd>{photo.camera}</dd>
              </>
            )}
            <dt>Datei</dt>
            <dd className="num">
              {photo.width && photo.height ? `${photo.width} × ${photo.height}` : ""}
              {photo.size > 0 ? ` · ${sizeLabel(photo.size)}` : photo.native ? " · aus der Mediathek" : ""}
            </dd>
            {photo.quality && (
              <>
                <dt>Qualität</dt>
                <dd>
                  {photo.quality.blurry ? "unscharf" : "scharf"} · {photo.quality.exposure === "ok" ? "gut belichtet" : photo.quality.exposure === "dunkel" ? "zu dunkel" : "zu hell"}
                  {photo.duplicateOf && " · doppelt"}
                </dd>
              </>
            )}
            {photo.credit && (
              <>
                <dt>Nachweis</dt>
                <dd>{photo.credit}</dd>
              </>
            )}
          </dl>

          {photo.colors && photo.colors.palette.length > 0 && (
            <div className="field">
              <span className="label">Farben</span>
              <div className="palette" aria-hidden="true">
                {photo.colors.palette.map((c) => (
                  <i key={c.hex} style={{ background: c.hex, flex: c.share }} />
                ))}
              </div>
            </div>
          )}

          <div className="field">
            <div className="toggle-row">
              <span className="label">{photo.manualCategories ? "Kategorien (von dir korrigiert)" : "Kategorien – warum?"}</span>
              <button type="button" className="btn btn-small btn-quiet" onClick={() => setEditing((v) => !v)}>
                {editing ? "Fertig" : "Korrigieren"}
              </button>
            </div>
            {editing ? (
              <>
                <div className="chips">
                  {CATEGORIES.filter((c) => c.id !== "sonstiges").map((c) => (
                    <CategoryChip key={c.id} id={c.id} pressed={current.includes(c.id)} onClick={() => toggleCategory(c.id)} />
                  ))}
                </div>
                {photo.manualCategories && (
                  <button type="button" className="btn btn-small btn-quiet" onClick={() => setManualCategories(photo.id, undefined)}>
                    <RotateCcw size={15} /> Automatische Zuordnung wiederherstellen
                  </button>
                )}
              </>
            ) : photo.manualCategories ? (
              <div className="chips">
                {photo.manualCategories.map((c) => (
                  <CategoryChip key={c} id={c} />
                ))}
              </div>
            ) : (
              <div className="reasons">
                {photo.categories.map((c) => (
                  <div className="reason" key={c.id}>
                    <div className="reason-head">
                      <CategoryChip id={c.id} />
                      <span className="meter" aria-hidden="true">
                        <i style={{ width: `${Math.round(c.score * 100)}%`, background: `hsl(${CATEGORY_BY_ID[c.id].hue} 62% var(--chip-l))` }} />
                      </span>
                      <span className="mono muted num">{Math.round(c.score * 100)}</span>
                    </div>
                    <ul>
                      {c.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          {(labels.length > 0 || objects.length > 0) && (
            <div className="field">
              <span className="label">Erkannt</span>
              <p className="muted small">
                {labels.map((l) => `${labelName(l.index, l.name)} ${Math.round(l.prob * 100)} %`).join(" · ")}
                {labels.length > 0 && objects.length > 0 ? " — " : ""}
                {[...objectCounts.entries()].map(([name, n]) => `${n > 1 ? `${n}× ` : ""}${COCO_DE[name] ?? name}`).join(", ")}
              </p>
            </div>
          )}
          {!photo.recognition && photo.status === "fertig" && (
            <p className="muted small">
              Ohne KI-Erkennung analysiert – sortiert nach Datum, Farben und Qualität.
            </p>
          )}

          <div className="btn-row">
            {photo.excluded ? (
              <button type="button" className="btn btn-small" onClick={() => setExcluded([photo.id], false)}>
                <RotateCcw size={15} /> Zurückholen
              </button>
            ) : (
              <button type="button" className="btn btn-small" onClick={() => setExcluded([photo.id], true)}>
                <EyeOff size={15} /> Aussortieren
              </button>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
