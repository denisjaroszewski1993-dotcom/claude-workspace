import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import type { CategoryId, StoryLength, StorySource, StoryStyle } from "../types";
import { CATEGORIES, effectiveCategories } from "../lib/categories";
import { claudeAccess, type ClaudeAccess } from "../lib/claudeWriter";
import { formatRange } from "../lib/events";
import { newSeed } from "../lib/random";
import { buildStory } from "../lib/story";
import { useStore } from "../state/store";
import { Dialog, Option } from "./common";

type Writer = "eingebaut" | "claude";

export function StoryCreator({
  initialSource,
  initialPhotoIds,
  onClose,
  onCreated,
}: {
  initialSource?: StorySource;
  initialPhotoIds?: string[];
  onClose: () => void;
  onCreated: (storyId: string, withClaude: boolean) => void;
}) {
  const { photos, events, state, saveStory } = useStore();
  const [kind, setKind] = useState<StorySource["kind"]>(initialSource?.kind ?? "erlebnis");
  const [ref, setRef] = useState<string>(initialSource?.ref ?? "");
  const [style, setStyle] = useState<StoryStyle>("erzaehlung");
  const [length, setLength] = useState<StoryLength>("mittel");
  const [writer, setWriter] = useState<Writer>("eingebaut");
  const [access, setAccess] = useState<ClaudeAccess>({ kind: "keiner" });

  useEffect(() => {
    let alive = true;
    void claudeAccess(state.settings.apiKey).then((a) => {
      if (!alive) return;
      setAccess(a);
      if (a.kind !== "keiner") setWriter("claude");
    });
    return () => {
      alive = false;
    };
  }, [state.settings.apiKey]);

  const done = photos.filter((p) => p.status === "fertig" && !p.excluded);
  const datedEvents = events.filter((e) => e.photoIds.length >= 2);
  const years = useMemo(() => [...new Set(done.filter((p) => p.takenAt !== undefined).map((p) => new Date(p.takenAt!).getFullYear()))].sort((a, b) => b - a), [done]);
  const cats = CATEGORIES.filter((c) => done.some((p) => effectiveCategories(p).includes(c.id)));

  // Sinnvolle Vorauswahl, wenn der Dialog ohne Quelle geöffnet wurde
  useEffect(() => {
    if (ref) return;
    if (kind === "erlebnis" && datedEvents[0]) setRef(datedEvents[0].id);
    if (kind === "jahr" && years[0]) setRef(String(years[0]));
    if (kind === "kategorie" && cats[0]) setRef(cats[0].id);
  }, [kind, ref, datedEvents, years, cats]);

  const selection = useMemo(() => {
    if (kind === "auswahl") return { ids: initialPhotoIds ?? [], label: initialSource?.label ?? "Auswahl" };
    if (kind === "erlebnis") {
      const e = events.find((x) => x.id === ref);
      return { ids: e?.photoIds ?? [], label: e?.title ?? "" };
    }
    if (kind === "jahr") {
      return { ids: done.filter((p) => p.takenAt !== undefined && String(new Date(p.takenAt).getFullYear()) === ref).map((p) => p.id), label: ref };
    }
    const cat = CATEGORIES.find((c) => c.id === ref);
    return { ids: done.filter((p) => effectiveCategories(p).includes(ref as CategoryId)).map((p) => p.id), label: cat?.label ?? "" };
  }, [kind, ref, events, done, initialPhotoIds, initialSource]);

  const create = () => {
    const chosen = selection.ids.map((id) => state.photos[id]).filter(Boolean);
    const story = buildStory({ photos: chosen, source: { kind, ref, label: selection.label }, style, length, seed: newSeed() });
    saveStory(story);
    onCreated(story.id, writer === "claude" && access.kind !== "keiner");
  };

  const claudeText =
    access.kind === "claude.ai"
      ? "Schreibt freier und sieht die Vorschaubilder. Läuft über dein claude.ai-Konto."
      : access.kind === "api"
        ? "Schreibt freier und sieht die Vorschaubilder. Nutzt deinen API-Schlüssel."
        : "Braucht einen API-Schlüssel (Einstellungen) oder claude.ai.";

  return (
    <Dialog
      title="Neue Geschichte"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-primary" onClick={create} disabled={selection.ids.length === 0}>
            <Sparkles size={18} /> Geschichte schreiben
          </button>
        </>
      }
    >
      {kind !== "auswahl" && (
        <div className="field">
          <span className="label">Worüber?</span>
          <div className="options">
            <Option value="erlebnis" current={kind} onSelect={(k) => { setKind(k); setRef(""); }} title="Ein Erlebnis" text="Ein Tag oder eine Reise" disabled={!datedEvents.length} />
            <Option value="jahr" current={kind} onSelect={(k) => { setKind(k); setRef(""); }} title="Ein Jahr" text="Rückblick, Monat für Monat" disabled={!years.length} />
            <Option value="kategorie" current={kind} onSelect={(k) => { setKind(k); setRef(""); }} title="Ein Thema" text="z. B. alle Tierfotos" disabled={!cats.length} />
          </div>
          {kind === "erlebnis" && (
            <select className="input" value={ref} onChange={(e) => setRef(e.target.value)} aria-label="Erlebnis wählen">
              {datedEvents.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} – {formatRange(e.start, e.end)} ({e.photoIds.length} Fotos)
                </option>
              ))}
            </select>
          )}
          {kind === "jahr" && (
            <select className="input" value={ref} onChange={(e) => setRef(e.target.value)} aria-label="Jahr wählen">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          )}
          {kind === "kategorie" && (
            <select className="input" value={ref} onChange={(e) => setRef(e.target.value)} aria-label="Thema wählen">
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      {kind === "auswahl" && <p className="muted">{selection.ids.length} ausgewählte Fotos</p>}

      <div className="field">
        <span className="label">Wie erzählt?</span>
        <div className="options">
          <Option value="erzaehlung" current={style} onSelect={setStyle} title="Erzählung" text="Warm und bildhaft, in der Wir-Form" />
          <Option value="maerchen" current={style} onSelect={setStyle} title="Märchen" text="„Es war einmal …“ – schön zum Vorlesen" />
          <Option value="tagebuch" current={style} onSelect={setStyle} title="Tagebuch" text="Persönlich, in der Ich-Form" />
        </div>
      </div>

      <div className="field">
        <span className="label">Wie lang?</span>
        <div className="options">
          <Option value="kurz" current={length} onSelect={setLength} title="Kurz" text="3 Kapitel, wenige Bilder" />
          <Option value="mittel" current={length} onSelect={setLength} title="Mittel" text="bis 6 Kapitel" />
          <Option value="lang" current={length} onSelect={setLength} title="Lang" text="bis 10 Kapitel, mehr Bilder" />
        </div>
      </div>

      <div className="field">
        <span className="label">Wer schreibt?</span>
        <div className="options">
          <Option value="eingebaut" current={writer} onSelect={setWriter} title="Eingebauter Erzähler" text="Sofort fertig, offline, nichts verlässt das Gerät" />
          <Option value="claude" current={writer} onSelect={setWriter} title="Claude" text={claudeText} disabled={access.kind === "keiner"} />
        </div>
      </div>
    </Dialog>
  );
}
