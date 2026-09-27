import { useMemo, useState } from "react";
import { ArrowDownUp, BookOpen, CheckSquare, EyeOff, X } from "lucide-react";
import type { CategoryId } from "../types";
import { CATEGORIES, effectiveCategories } from "../lib/categories";
import { useStore } from "../state/store";
import { useUi } from "../state/ui";
import { CategoryChip, Empty, PhotoMount } from "../components/common";
import { categoryCounts } from "./Overview";

export function PhotosView({ filter, onFilter }: { filter: CategoryId | "alle"; onFilter: (f: CategoryId | "alle") => void }) {
  const { photos, setExcluded } = useStore();
  const ui = useUi();
  const [newestFirst, setNewestFirst] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const byCat = useMemo(() => categoryCounts(photos), [photos]);
  const visible = useMemo(() => {
    const list = photos.filter((p) => filter === "alle" || (p.status === "fertig" && effectiveCategories(p).includes(filter)));
    return list.sort((a, b) => {
      const d = (a.takenAt ?? 0) - (b.takenAt ?? 0);
      return newestFirst ? -d : d;
    });
  }, [photos, filter, newestFirst]);
  const ids = visible.map((p) => p.id);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  return (
    <section className="section" aria-labelledby="h-fotos">
      <div className="section-head">
        <div>
          <h2 id="h-fotos" className="section-title">
            {filter === "alle" ? "Alle Fotos" : CATEGORIES.find((c) => c.id === filter)?.label}
          </h2>
          <p className="section-sub">
            {visible.length} {visible.length === 1 ? "Foto" : "Fotos"}
            {filter !== "alle" ? ` · ${CATEGORIES.find((c) => c.id === filter)?.hint}` : ""} · Antippen zeigt, was erkannt wurde, und erlaubt Korrekturen.
          </p>
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-small btn-quiet" onClick={() => setNewestFirst((v) => !v)}>
            <ArrowDownUp size={16} /> {newestFirst ? "Neueste zuerst" : "Älteste zuerst"}
          </button>
          <button type="button" className="btn btn-small" aria-pressed={selecting} onClick={() => (selecting ? stopSelecting() : setSelecting(true))}>
            <CheckSquare size={16} /> {selecting ? "Auswahl beenden" : "Auswählen"}
          </button>
        </div>
      </div>

      <div className="chips chips-scroll" role="group" aria-label="Nach Kategorie filtern">
        <button type="button" className="chip plain" aria-pressed={filter === "alle"} onClick={() => onFilter("alle")}>
          Alle <span className="count">{photos.length}</span>
        </button>
        {CATEGORIES.filter((c) => byCat.has(c.id)).map((c) => (
          <CategoryChip key={c.id} id={c.id} count={byCat.get(c.id)!.length} pressed={filter === c.id} onClick={() => onFilter(c.id)} />
        ))}
      </div>

      {visible.length === 0 ? (
        <Empty title="Hier ist noch nichts">
          <p>In dieser Kategorie liegen keine Fotos.</p>
        </Empty>
      ) : (
        <div className="grid">
          {visible.map((p) => (
            <PhotoMount
              key={p.id}
              photo={p}
              selectable={selecting}
              selected={selected.has(p.id)}
              onOpen={() => (selecting ? toggle(p.id) : ui.openPhoto(p.id, ids))}
            />
          ))}
        </div>
      )}

      {selecting && (
        <div className="selection-bar" role="region" aria-label="Auswahl">
          <p>{selected.size} ausgewählt</p>
          <button type="button" className="btn btn-small" onClick={() => setSelected(new Set(ids))}>
            Alle
          </button>
          <button
            type="button"
            className="btn btn-small"
            disabled={!selected.size}
            onClick={() => {
              setExcluded([...selected], true);
              stopSelecting();
            }}
          >
            <EyeOff size={16} /> Aussortieren
          </button>
          <button
            type="button"
            className="btn btn-small btn-primary"
            disabled={selected.size < 2}
            onClick={() => {
              ui.openCreator({ kind: "auswahl", ref: "auswahl", label: `${selected.size} ausgewählte Fotos` }, [...selected]);
              stopSelecting();
            }}
          >
            <BookOpen size={16} /> Geschichte daraus
          </button>
          <button type="button" className="btn btn-small btn-icon" onClick={stopSelecting} aria-label="Auswahl beenden">
            <X size={16} />
          </button>
        </div>
      )}
    </section>
  );
}
