import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Dices, Download, Pencil, Play, Sparkles, Square, Trash2 } from "lucide-react";
import type { Story } from "../types";
import { claudeAccess, ClaudeError, writeWithClaude } from "../lib/claudeWriter";
import { formatDate } from "../lib/events";
import { storyHtml } from "../lib/exporter";
import { saveFile, SaveError } from "../lib/platform";
import { newSeed } from "../lib/random";
import { buildStory } from "../lib/story";
import { useStore } from "../state/store";
import { useUi } from "../state/ui";
import { STYLE_LABEL } from "../views/StoriesView";
import { usePhotoUrl } from "./usePhotoUrl";

function slug(s: string) {
  return (
    s
      .replace(/·/g, "-")
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "Geschichte"
  );
}

export function StoryReader({
  storyId,
  startWithClaude,
  onClose,
  onSlideshow,
}: {
  storyId: string;
  startWithClaude: boolean;
  onClose: () => void;
  onSlideshow: () => void;
}) {
  const { state, saveStory, deleteStory, notify } = useStore();
  const ui = useUi();
  const story = state.stories.find((s) => s.id === storyId);
  const [editing, setEditing] = useState(false);
  const [writing, setWriting] = useState<{ text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState<string>();
  const abort = useRef<AbortController | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !editing) onClose();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      abort.current?.abort();
    };
  }, [onClose, editing]);

  const askClaude = async () => {
    if (!story) return;
    const access = await claudeAccess(state.settings.apiKey);
    if (access.kind === "keiner") {
      notify("Für Claude bitte in den Einstellungen einen API-Schlüssel hinterlegen.", "fehler");
      return;
    }
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setWriting({ text: "" });
    try {
      const result = await writeWithClaude({
        story,
        photos: state.photos,
        access,
        signal: controller.signal,
        onText: (text) => setWriting({ text }),
      });
      saveStory(result);
      notify("Claude hat die Geschichte neu geschrieben.");
    } catch (err) {
      if (!controller.signal.aborted) notify(err instanceof ClaudeError ? err.message : "Claude ist gerade nicht erreichbar.", "fehler");
    } finally {
      setWriting(null);
    }
  };

  useEffect(() => {
    if (startWithClaude && story && !started.current) {
      started.current = true;
      void askClaude();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startWithClaude, story?.id]);

  if (!story) return null;

  const photosOf = (ids: string[]) => ids.map((id) => state.photos[id]).filter(Boolean);
  const missing = story.chapters.every((c) => photosOf(c.photoIds).length === 0);
  const cover = story.coverPhotoId ? state.photos[story.coverPhotoId] : undefined;

  const reroll = () => {
    const pool = story.photoPool?.length ? story.photoPool : story.chapters.flatMap((c) => c.photoIds);
    const photos = pool.map((id) => state.photos[id]).filter((p) => p && !p.excluded);
    const next = buildStory({ photos, source: story.source, style: story.style, length: story.length, seed: newSeed() });
    saveStory({ ...next, id: story.id, createdAt: story.createdAt });
  };

  const update = (patch: Partial<Story>) => saveStory({ ...story, ...patch });
  const updateChapter = (id: string, patch: { heading?: string; text?: string }) =>
    update({ chapters: story.chapters.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  const download = async () => {
    setSaving("Bilder werden vorbereitet …");
    try {
      const blob = await storyHtml(story, state.photos, (d, t) => setSaving(`Bild ${d} von ${t} …`));
      setSaving("Speichern …");
      await saveFile(`${slug(story.title)}.html`, blob);
    } catch (err) {
      if (!(err instanceof SaveError && err.declined)) notify(err instanceof Error ? err.message : "Speichern fehlgeschlagen.", "fehler");
    } finally {
      setSaving(undefined);
    }
  };

  const editable = editing ? { contentEditable: true as const, suppressContentEditableWarning: true } : {};

  return (
    <div className="reader" role="dialog" aria-modal="true" aria-label={story.title}>
      <div className="reader-bar">
        <button type="button" className="btn btn-quiet btn-small" onClick={onClose}>
          <ArrowLeft size={18} /> <span className="label-sm">Zurück</span>
        </button>
        <span className="spacer" />
        {editing ? (
          <button type="button" className="btn btn-primary btn-small" onClick={() => setEditing(false)}>
            Fertig
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-small" onClick={onSlideshow} disabled={missing}>
              <Play size={16} /> <span className="label-sm">Diashow</span>
            </button>
            <button type="button" className="btn btn-small btn-quiet" onClick={reroll} disabled={missing || !!writing} title="Andere Bilder und Sätze auswählen">
              <Dices size={16} /> <span className="label-sm">Neu würfeln</span>
            </button>
            <button type="button" className="btn btn-small btn-quiet" onClick={() => void askClaude()} disabled={missing || !!writing}>
              <Sparkles size={16} /> <span className="label-sm">Claude</span>
            </button>
            <button type="button" className="btn btn-small btn-quiet" onClick={() => setEditing(true)} disabled={!!writing}>
              <Pencil size={16} /> <span className="label-sm">Bearbeiten</span>
            </button>
            <button type="button" className="btn btn-small btn-quiet" onClick={() => void download()} disabled={missing || !!saving}>
              <Download size={16} /> <span className="label-sm">HTML</span>
            </button>
            <button type="button" className="btn btn-small btn-quiet btn-icon btn-danger" onClick={() => setConfirmDelete(true)} aria-label="Geschichte löschen">
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>

      <article className="reader-page">
        {confirmDelete && (
          <div className="banner" role="alertdialog" aria-label="Löschen bestätigen">
            <p>Diese Geschichte löschen? Die Fotos bleiben erhalten.</p>
            <button type="button" className="btn btn-small" onClick={() => setConfirmDelete(false)}>
              Behalten
            </button>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                deleteStory(story.id);
                onClose();
              }}
            >
              Löschen
            </button>
          </div>
        )}
        {saving && <p className="status busy">{saving}</p>}
        {writing && (
          <div className="writing" aria-live="polite">
            <div className="toggle-row">
              <span className="status busy">Claude schreibt die Geschichte …</span>
              <button type="button" className="btn btn-small btn-quiet" onClick={() => abort.current?.abort()}>
                <Square size={14} /> Stopp
              </button>
            </div>
            {writing.text ? <pre>{writing.text}</pre> : <span className="muted">Claude schaut sich die Bilder an. Das dauert meist 20–60 Sekunden.</span>}
          </div>
        )}
        {missing && (
          <div className="hint">
            <span>Die Fotos zu dieser Geschichte sind gerade nicht geladen. Wähle dieselben Fotos noch einmal aus – die App erkennt sie wieder.</span>
          </div>
        )}

        <header className="reader-head">
          <p className="mono muted">
            {STYLE_LABEL[story.style]} · {story.subtitle}
          </p>
          <h1 {...editable} onBlur={(e) => editing && update({ title: e.currentTarget.textContent?.trim() || story.title })}>
            {story.title}
          </h1>
          {cover?.thumbUrl && <CoverImage photoId={cover.id} />}
        </header>

        {story.chapters.map((c) => {
          const chapterPhotos = photosOf(c.photoIds);
          return (
            <section className="chapter" key={c.id}>
              {(c.dateLabel || c.place) && <p className="mono muted">{[c.dateLabel, c.place].filter(Boolean).join(" · ")}</p>}
              <h2 {...editable} onBlur={(e) => editing && updateChapter(c.id, { heading: e.currentTarget.textContent?.trim() || c.heading })}>
                {c.heading}
              </h2>
              <p className="chapter-text" {...editable} onBlur={(e) => editing && updateChapter(c.id, { text: e.currentTarget.textContent?.trim() || c.text })}>
                {c.text}
              </p>
              {chapterPhotos.length > 0 && (
                <div className={`chapter-photos n${Math.min(chapterPhotos.length, 5)}`}>
                  {chapterPhotos.map((p) => (
                    <figure key={p.id}>
                      <img src={p.thumbUrl} alt="" loading="lazy" onClick={() => ui.openPhoto(p.id, chapterPhotos.map((x) => x.id))} />
                      {p.takenAt !== undefined && <figcaption>{formatDate(p.takenAt)}</figcaption>}
                    </figure>
                  ))}
                </div>
              )}
            </section>
          );
        })}

        <p className="closing" {...editable} onBlur={(e) => editing && update({ closing: e.currentTarget.textContent?.trim() || story.closing })}>
          {story.closing}
        </p>
        <p className="credits">
          {story.author === "claude" ? "Text von Claude, auf Grundlage der erkannten Motive und Vorschaubilder." : "Text vom eingebauten Erzähler, zusammengesetzt aus den erkannten Merkmalen."}
        </p>
      </article>
    </div>
  );
}

/** Titelbild in voller Auflösung, solange die Geschichte offen ist. */
function CoverImage({ photoId }: { photoId: string }) {
  const { state } = useStore();
  const url = usePhotoUrl(state.photos[photoId]);
  return <img className="cover" src={url} alt="" />;
}
