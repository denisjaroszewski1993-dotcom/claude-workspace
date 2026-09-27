import { ArrowRight, BookOpen } from "lucide-react";
import type { CategoryId, Photo } from "../types";
import { CATEGORIES, CATEGORY_BY_ID, effectiveCategories } from "../lib/categories";
import { formatRange } from "../lib/events";
import { useStore } from "../state/store";
import { useUi } from "../state/ui";
import { ImportCompact } from "../components/ImportZone";
import { EventCard } from "./EventsView";

export function categoryCounts(photos: Photo[]): Map<CategoryId, Photo[]> {
  const map = new Map<CategoryId, Photo[]>();
  for (const p of photos) {
    if (p.status !== "fertig") continue;
    for (const id of effectiveCategories(p)) map.set(id, [...(map.get(id) ?? []), p]);
  }
  return map;
}

function bestFirst(photos: Photo[]): Photo[] {
  return [...photos].filter((p) => !p.duplicateOf && !p.excluded).sort((a, b) => (b.quality?.score ?? 0) - (a.quality?.score ?? 0));
}

export function Overview() {
  const { photos, events, state } = useStore();
  const ui = useUi();
  const done = photos.filter((p) => p.status === "fertig");
  const byCat = categoryCounts(done);
  const dups = done.filter((p) => p.duplicateOf).length;
  const blurry = done.filter((p) => p.quality?.blurry && !p.duplicateOf).length;
  const dated = done.filter((p) => p.takenAt !== undefined).map((p) => p.takenAt!);
  const range = dated.length ? formatRange(Math.min(...dated), Math.max(...dated)) : undefined;
  const cats = CATEGORIES.filter((c) => byCat.has(c.id)).sort((a, b) => byCat.get(b.id)!.length - byCat.get(a.id)!.length);

  return (
    <>
      <section className="stats" aria-label="Kennzahlen">
        <div className="stat">
          <b>{done.length}</b>
          <span>Fotos{range ? ` · ${range}` : ""}</span>
        </div>
        <div className="stat">
          <b>{cats.length}</b>
          <span>Kategorien</span>
        </div>
        <div className="stat">
          <b>{events.filter((e) => e.kind !== "ohne-datum").length}</b>
          <span>Erlebnisse</span>
        </div>
        <div className="stat">
          <b>{state.stories.length}</b>
          <span>Geschichten</span>
        </div>
        {(dups > 0 || blurry > 0) && (
          <button type="button" className="stat stat-link alert" onClick={() => ui.setTab("aufraeumen")}>
            <b>{dups + blurry}</b>
            <span>zum Aufräumen →</span>
          </button>
        )}
      </section>

      {cats.length > 0 && (
        <section className="section" aria-labelledby="h-kat">
          <div className="section-head">
            <h2 id="h-kat" className="section-title">
              Kategorien
            </h2>
            <button type="button" className="btn btn-small btn-quiet" onClick={() => ui.showCategory("alle")}>
              Alle Fotos <ArrowRight size={16} />
            </button>
          </div>
          <div className="cat-grid">
            {cats.map((c) => {
              const list = bestFirst(byCat.get(c.id)!);
              const covers = list.slice(0, 3);
              return (
                <button key={c.id} type="button" className="cat-card" style={{ ["--h" as string]: CATEGORY_BY_ID[c.id].hue }} onClick={() => ui.showCategory(c.id)}>
                  <span className={`mosaic${covers.length < 3 ? " one" : ""}`}>
                    {(covers.length < 3 ? covers.slice(0, 1) : covers).map((p) => (
                      <img key={p.id} src={p.thumbUrl} alt="" loading="lazy" />
                    ))}
                  </span>
                  <span className="cat-card-foot">
                    <span className="swatch" />
                    <strong>{c.label}</strong>
                    <span className="mono muted num">{byCat.get(c.id)!.length}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {events.length > 0 && (
        <section className="section" aria-labelledby="h-erl">
          <div className="section-head">
            <div>
              <h2 id="h-erl" className="section-title">
                Zuletzt erlebt
              </h2>
              <p className="section-sub">Fotos, die zeitlich und räumlich zusammengehören. Aus jedem Erlebnis lässt sich eine Geschichte machen.</p>
            </div>
            <button type="button" className="btn btn-small btn-quiet" onClick={() => ui.setTab("erlebnisse")}>
              Alle Erlebnisse <ArrowRight size={16} />
            </button>
          </div>
          <div className="event-list">
            {events
              .filter((e) => e.kind !== "ohne-datum")
              .slice(0, 2)
              .map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
          </div>
        </section>
      )}

      {state.stories.length === 0 && done.length > 0 && (
        <div className="hint">
          <BookOpen size={18} />
          <span>
            Tipp: Unter <b>Erlebnisse</b> oder <b>Zeitleiste</b> auf „Geschichte erzählen“ tippen – die App wählt die schönsten Bilder aus und schreibt den Text.
          </span>
        </div>
      )}

      <ImportCompact />
    </>
  );
}
