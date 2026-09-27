import { BookOpen, Images, MapPin } from "lucide-react";
import type { PhotoEvent } from "../types";
import { formatRange } from "../lib/events";
import { useStore } from "../state/store";
import { useUi } from "../state/ui";
import { CategoryChip, Empty, ShowMore, usePaged } from "../components/common";

export function EventCard({ event }: { event: PhotoEvent }) {
  const { state } = useStore();
  const ui = useUi();
  const photos = event.photoIds.map((id) => state.photos[id]).filter(Boolean);
  const cover = photos
    .filter((p) => !p.duplicateOf && p.thumbUrl)
    .sort((a, b) => (b.quality?.score ?? 0) - (a.quality?.score ?? 0))
    .slice(0, 4)
    .sort((a, b) => (a.takenAt ?? 0) - (b.takenAt ?? 0));
  const kindLabel = event.kind === "reise" ? `Reise · ${event.days} Tage` : event.kind === "ohne-datum" ? "Ohne Datum" : "Ein Tag";

  return (
    <article className="event-card">
      <div className="strip">
        {cover.map((p) => (
          <button key={p.id} type="button" onClick={() => ui.openPhoto(p.id, event.photoIds)} aria-label="Foto ansehen">
            <img src={p.thumbUrl} alt="" loading="lazy" />
          </button>
        ))}
      </div>
      <div className="event-body">
        <span>
          <span className="kind">{kindLabel}</span>
        </span>
        <h3>{event.title}</h3>
        <div className="event-meta">
          <span>{formatRange(event.start, event.end)}</span>
          <span className="num">{event.photoIds.length} Fotos</span>
          {event.place && (
            <span>
              <MapPin size={14} className="inline-icon" /> {event.place}
            </span>
          )}
        </div>
        <div className="chips">
          {event.topCategories.slice(0, 3).map((c) => (
            <CategoryChip key={c.id} id={c.id} />
          ))}
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-primary btn-small" onClick={() => ui.openCreator({ kind: "erlebnis", ref: event.id, label: event.title }, event.photoIds)}>
            <BookOpen size={16} /> Geschichte erzählen
          </button>
          <button type="button" className="btn btn-small btn-quiet" onClick={() => ui.openPhoto(event.photoIds[0], event.photoIds)}>
            <Images size={16} /> Fotos durchblättern
          </button>
        </div>
      </div>
    </article>
  );
}

export function EventsView() {
  const { events, state, updateSettings } = useStore();
  const paged = usePaged(events, 20, String(state.settings.eventGapHours));
  return (
    <section className="section" aria-labelledby="h-erlebnisse">
      <div className="section-head">
        <div>
          <h2 id="h-erlebnisse" className="section-title">
            Erlebnisse und Reisen
          </h2>
          <p className="section-sub">
            Ein neues Erlebnis beginnt nach {state.settings.eventGapHours} Stunden ohne Foto. Mehrere Tage am selben Ort, fern von zu Hause, werden zur Reise zusammengefasst.
          </p>
        </div>
        <label className="inline-field" htmlFor="gap">
          Pause
          <select id="gap" className="input input-inline" value={state.settings.eventGapHours} onChange={(e) => updateSettings({ eventGapHours: Number(e.target.value) })}>
            {[2, 4, 6, 8, 12, 24].map((h) => (
              <option key={h} value={h}>
                {h} Stunden
              </option>
            ))}
          </select>
        </label>
      </div>
      {events.length === 0 ? (
        <Empty title="Noch keine Erlebnisse">
          <p>Sobald Fotos analysiert sind, erscheinen sie hier gruppiert.</p>
        </Empty>
      ) : (
        <>
          <div className="event-list">
            {paged.shown.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
          <ShowMore paged={paged} noun="Erlebnisse" />
        </>
      )}
    </section>
  );
}
