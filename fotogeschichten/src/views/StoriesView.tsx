import { Plus } from "lucide-react";
import { useStore } from "../state/store";
import { useUi } from "../state/ui";
import { Empty } from "../components/common";

export const STYLE_LABEL = { erzaehlung: "Erzählung", maerchen: "Märchen", tagebuch: "Tagebuch" } as const;

export function StoriesView() {
  const { state } = useStore();
  const ui = useUi();
  return (
    <section className="section" aria-labelledby="h-geschichten">
      <div className="section-head">
        <div>
          <h2 id="h-geschichten" className="section-title">
            Geschichten
          </h2>
          <p className="section-sub">Gespeichert in diesem Browser. Sind die Fotos nicht geladen, einfach dieselben Fotos erneut auswählen – die App erkennt sie wieder.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => ui.openCreator()}>
          <Plus size={18} /> Neue Geschichte
        </button>
      </div>
      {state.stories.length === 0 ? (
        <Empty title="Noch keine Geschichte">
          <p>Wähle ein Erlebnis, eine Kategorie oder ein ganzes Jahr – die App sucht die schönsten Bilder aus und schreibt den Text dazu.</p>
          <button type="button" className="btn btn-primary btn-small" onClick={() => ui.openCreator()}>
            Erste Geschichte schreiben
          </button>
        </Empty>
      ) : (
        <div className="story-list">
          {state.stories.map((s) => {
            const cover = s.coverPhotoId ? state.photos[s.coverPhotoId] : undefined;
            const available = s.chapters.some((c) => c.photoIds.some((id) => state.photos[id]));
            return (
              <button key={s.id} type="button" className="story-card" onClick={() => ui.openStory(s.id)}>
                {cover?.thumbUrl ? <img src={cover.thumbUrl} alt="" /> : <span className="noimg" />}
                <span className="story-card-body">
                  <span className="mono muted">
                    {STYLE_LABEL[s.style]} · {s.author === "claude" ? "Text von Claude" : "Eingebauter Erzähler"}
                  </span>
                  <h3>{s.title}</h3>
                  <span className="muted">{s.subtitle}</span>
                  {!available && <span className="status bad">Fotos nicht geladen</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
