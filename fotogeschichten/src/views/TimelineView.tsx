import { BookOpen } from "lucide-react";
import type { Photo } from "../types";
import { monthName } from "../lib/events";
import { useStore } from "../state/store";
import { useUi } from "../state/ui";
import { Empty, PhotoMount } from "../components/common";

const SHORT = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export function TimelineView() {
  const { photos } = useStore();
  const ui = useUi();
  const dated = photos.filter((p) => p.status === "fertig" && p.takenAt !== undefined).sort((a, b) => b.takenAt! - a.takenAt!);
  const undated = photos.filter((p) => p.status === "fertig" && p.takenAt === undefined);

  const years = new Map<number, Map<number, Photo[]>>();
  for (const p of dated) {
    const d = new Date(p.takenAt!);
    const months = years.get(d.getFullYear()) ?? new Map<number, Photo[]>();
    months.set(d.getMonth(), [...(months.get(d.getMonth()) ?? []), p]);
    years.set(d.getFullYear(), months);
  }

  if (!dated.length && !undated.length) {
    return (
      <Empty title="Noch keine Zeitleiste">
        <p>Sobald Fotos mit Aufnahmedatum analysiert sind, erscheinen sie hier nach Jahr und Monat.</p>
      </Empty>
    );
  }

  return (
    <section className="section" aria-label="Zeitleiste">
      {[...years.entries()].map(([year, months]) => {
        const all = [...months.values()].flat();
        const max = Math.max(...[...months.values()].map((m) => m.length));
        return (
          <div className="year" key={year}>
            <div className="year-head">
              <h2>{year}</h2>
              <div className="btn-row">
                <span className="muted num">{all.length} Fotos</span>
                <button
                  type="button"
                  className="btn btn-small btn-primary"
                  onClick={() => ui.openCreator({ kind: "jahr", ref: String(year), label: String(year) }, all.map((p) => p.id))}
                >
                  <BookOpen size={16} /> Jahresrückblick
                </button>
              </div>
            </div>
            <div className="months-bar" aria-hidden="true">
              {SHORT.map((s, m) => {
                const n = months.get(m)?.length ?? 0;
                return (
                  <div key={m}>
                    <i className={n ? "" : "none"} style={{ height: n ? Math.max(6, Math.round((n / max) * 40)) : 2 }} />
                    <span>{s}</span>
                  </div>
                );
              })}
            </div>
            {[...months.entries()].map(([month, list]) => (
              <div className="month" key={month}>
                <div className="month-label">
                  <strong>{monthName(month)}</strong>
                  <span className="mono muted num">{list.length} Fotos</span>
                </div>
                <div className="thumb-row">
                  {[...list].reverse().map((p) => (
                    <PhotoMount key={p.id} photo={p} caption={false} onOpen={() => ui.openPhoto(p.id, [...list].reverse().map((x) => x.id))} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })}
      {undated.length > 0 && (
        <div className="year">
          <div className="year-head">
            <h2>Ohne Datum</h2>
            <span className="muted num">{undated.length} Fotos</span>
          </div>
          <div className="thumb-row">
            {undated.map((p) => (
              <PhotoMount key={p.id} photo={p} caption={false} onOpen={() => ui.openPhoto(p.id, undated.map((x) => x.id))} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
