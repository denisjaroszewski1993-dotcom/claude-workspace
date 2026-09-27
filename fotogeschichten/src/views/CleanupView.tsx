import { useMemo } from "react";
import { Info, RotateCcw } from "lucide-react";
import type { Photo } from "../types";
import { groupsFromMarks } from "../lib/duplicates";
import { hasNativeLibrary } from "../lib/nativeLibrary";
import { useStore } from "../state/store";
import { useUi } from "../state/ui";
import { Empty, PhotoMount, ShowMore, usePaged } from "../components/common";

function Group({ title, text, photos, action }: { title: string; text: string; photos: Photo[]; action?: React.ReactNode }) {
  const ui = useUi();
  const paged = usePaged(photos, 120);
  if (!photos.length) return null;
  const ids = photos.map((p) => p.id);
  return (
    <div className="cleanup-group">
      <div className="section-head">
        <div>
          <h3 className="subhead">
            {title} <span className="mono muted num">{photos.length}</span>
          </h3>
          <p className="section-sub">{text}</p>
        </div>
        {action}
      </div>
      <div className="grid">
        {paged.shown.map((p) => (
          <PhotoMount key={p.id} photo={p} onOpen={() => ui.openPhoto(p.id, ids)} />
        ))}
      </div>
      <ShowMore paged={paged} noun="Fotos" />
    </div>
  );
}

export function CleanupView() {
  const { photos, state, setExcluded } = useStore();
  const ui = useUi();
  const done = photos.filter((p) => p.status === "fertig");
  const groups = useMemo(() => groupsFromMarks(photos.filter((p) => p.status === "fertig")), [photos]);
  const pagedGroups = usePaged(groups, 30);
  const blurry = done.filter((p) => p.quality?.blurry && !p.duplicateOf && !p.excluded);
  const exposure = done.filter((p) => p.quality && p.quality.exposure !== "ok" && !p.quality.blurry && !p.duplicateOf && !p.excluded);
  const screenshots = done.filter((p) => p.categories[0]?.id === "dokumente" && !p.excluded && !p.duplicateOf);
  const excluded = done.filter((p) => p.excluded);
  const failed = photos.filter((p) => p.status === "fehler");
  const nothing = !groups.length && !blurry.length && !exposure.length && !screenshots.length && !excluded.length && !failed.length;

  return (
    <section className="section" aria-labelledby="h-aufraeumen">
      <div className="section-head">
        <div>
          <h2 id="h-aufraeumen" className="section-title">
            Aufräumen
          </h2>
          <p className="section-sub">Doppelte, unscharfe und missglückte Bilder auf einen Blick.</p>
        </div>
      </div>
      <div className="hint">
        <Info size={18} />
        <span>
          Gelöscht wird nichts – deine Originale bleiben unangetastet. Aussortierte Fotos fehlen in Geschichten und landen beim{" "}
          <button type="button" className="btn-link" onClick={() => ui.openExport()}>
            {hasNativeLibrary() ? "Sortieren" : "Export"}
          </button>{" "}
          {hasNativeLibrary() ? "im Album „Aussortiert“ der Fotos-App." : "im Ordner „_Aussortiert“."} So kannst du sie danach in Ruhe löschen.
        </span>
      </div>

      {nothing && (
        <Empty title="Alles ordentlich">
          <p>Keine doppelten, unscharfen oder falsch belichteten Fotos gefunden.</p>
        </Empty>
      )}

      {groups.length > 0 && (
        <div className="cleanup-group">
          <div className="section-head">
            <div>
              <h3 className="subhead">
                Doppelte und Serienbilder <span className="mono muted num">{groups.length}</span>
              </h3>
              <p className="section-sub">Das jeweils beste Bild (links, ohne Markierung) bleibt; die übrigen sind als „Doppelt“ markiert und werden in Geschichten übersprungen.</p>
            </div>
          </div>
          {pagedGroups.shown.map((g) => {
            const list = [state.photos[g.keepId], ...g.photoIds.filter((id) => id !== g.keepId).map((id) => state.photos[id])].filter(Boolean);
            return (
              <div className="dup-row" key={g.keepId}>
                {list.map((p) => (
                  <PhotoMount key={p.id} photo={p} onOpen={() => ui.openPhoto(p.id, list.map((x) => x.id))} />
                ))}
              </div>
            );
          })}
          <ShowMore paged={pagedGroups} noun="Gruppen" />
        </div>
      )}

      <Group
        title="Unscharf"
        text="Verwackelt oder nicht richtig scharfgestellt."
        photos={blurry}
        action={
          <button type="button" className="btn btn-small" onClick={() => setExcluded(blurry.map((p) => p.id), true)}>
            Alle aussortieren
          </button>
        }
      />
      <Group title="Zu dunkel oder zu hell" text="Stark unter- oder überbelichtet." photos={exposure} />
      <Group title="Screenshots und Dokumente" text="Bildschirmfotos, Zettel, Speisekarten – oft nur kurz wichtig." photos={screenshots} />
      <Group
        title="Aussortiert"
        text="Von dir aussortiert. Ein Tippen auf ein Foto öffnet es; dort lässt es sich zurückholen."
        photos={excluded}
        action={
          <button type="button" className="btn btn-small" onClick={() => setExcluded(excluded.map((p) => p.id), false)}>
            <RotateCcw size={16} /> Alle zurückholen
          </button>
        }
      />
      <Group title="Nicht lesbar" text="Diese Dateien konnte der Browser nicht öffnen." photos={failed} />
    </section>
  );
}
