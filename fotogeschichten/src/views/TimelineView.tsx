import { useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import type { Photo } from "../types";
import { monthName } from "../lib/events";
import { useStore } from "../state/store";
import { useUi } from "../state/ui";
import { Empty, PhotoMount, ShowMore, usePaged } from "../components/common";

const SHORT = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
/** So viele Vorschaubilder pro Monat, bevor „+ n weitere“ kommt. */
const PER_MONTH = 30;

/** Eine Reihe Vorschaubilder; lange Reihen erst auf Wunsch ganz. */
function ThumbRow({ photos }: { photos: Photo[] }) {
  const ui = useUi();
  const [all, setAll] = useState(false);
  const ids = photos.map((p) => p.id);
  const shown = all ? photos : photos.slice(0, PER_MONTH);
  return (
    <div className="thumb-row">
      {shown.map((p) => (
        <PhotoMount key={p.id} photo={p} caption={false} onOpen={() => ui.openPhoto(p.id, ids)} />
      ))}
      {shown.length < photos.length && (
        <button type="button" className="thumb-more" onClick={() => setAll(true)}>
          + {photos.length - shown.length} weitere
        </button>
      )}
    </div>
  );
}

export function TimelineView() {
  const { photos } = useStore();
  const ui = useUi();
  const { years, undated, empty } = useMemo(() => {
    const dated = photos.filter((p) => p.status === "fertig" && p.takenAt !== undefined).sort((a, b) => b.takenAt! - a.takenAt!);
    const undated = photos.filter((p) => p.status === "fertig" && p.takenAt === undefined);
    const years = new Map<number, Map<number, Photo[]>>();
    for (const p of dated) {
      const d = new Date(p.takenAt!);
      let months = years.get(d.getFullYear());
      if (!months) years.set(d.getFullYear(), (months = new Map()));
      const list = months.get(d.getMonth());
      if (list) list.push(p);
      else months.set(d.getMonth(), [p]);
    }
    // Innerhalb eines Monats chronologisch, damit man von vorn nach hinten blättert.
    for (const months of years.values()) for (const list of months.values()) list.reverse();
    return { years: [...years.entries()], undated, empty: !dated.length && !undated.length };
  }, [photos]);
  const paged = usePaged(years, 2);

  if (empty) {
    return (
      <Empty title="Noch keine Zeitleiste">
        <p>Sobald Fotos mit Aufnahmedatum analysiert sind, erscheinen sie hier nach Jahr und Monat.</p>
      </Empty>
    );
  }

  return (
    <section className="section" aria-label="Zeitleiste">
      {paged.shown.map(([year, months]) => {
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
                <ThumbRow photos={list} />
              </div>
            ))}
          </div>
        );
      })}
      <ShowMore paged={paged} noun="Jahre" />
      {undated.length > 0 && paged.rest === 0 && (
        <div className="year">
          <div className="year-head">
            <h2>Ohne Datum</h2>
            <span className="muted num">{undated.length} Fotos</span>
          </div>
          <ThumbRow photos={undated} />
        </div>
      )}
    </section>
  );
}
