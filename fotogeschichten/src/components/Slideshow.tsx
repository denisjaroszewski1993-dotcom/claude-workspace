import { useCallback, useEffect, useMemo, useState } from "react";
import { Pause, Play, X } from "lucide-react";
import { useStore } from "../state/store";

type Slide =
  | { kind: "title" }
  | { kind: "photo"; photoId: string; heading?: string; text?: string }
  | { kind: "end" };

const DURATION = 6500;

export function Slideshow({ storyId, onClose }: { storyId: string; onClose: () => void }) {
  const { state } = useStore();
  const story = state.stories.find((s) => s.id === storyId);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const slides = useMemo<Slide[]>(() => {
    if (!story) return [];
    const list: Slide[] = [{ kind: "title" }];
    for (const c of story.chapters) {
      c.photoIds
        .filter((id) => state.photos[id])
        .forEach((id, i) => list.push({ kind: "photo", photoId: id, heading: i === 0 ? c.heading : undefined, text: i === 0 ? c.text : undefined }));
    }
    list.push({ kind: "end" });
    return list;
  }, [story, state.photos]);

  const go = useCallback((delta: number) => setIndex((i) => Math.max(0, Math.min(slides.length - 1, i + delta))), [slides.length]);

  // Nur die aktuelle und die benachbarten Aufnahmen in voller Größe bereithalten
  useEffect(() => {
    const wanted = new Set<string>();
    for (const i of [index - 1, index, index + 1]) {
      const s = slides[i];
      if (s?.kind === "photo") wanted.add(s.photoId);
    }
    setUrls((prev) => {
      const next: Record<string, string> = {};
      for (const [id, url] of Object.entries(prev)) {
        if (wanted.has(id)) next[id] = url;
        else URL.revokeObjectURL(url);
      }
      for (const id of wanted) if (!next[id] && state.photos[id]) next[id] = URL.createObjectURL(state.photos[id].file);
      return next;
    });
  }, [index, slides, state.photos]);

  useEffect(() => () => setUrls((prev) => {
    Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
    return {};
  }), []);

  useEffect(() => {
    if (!playing) return;
    if (index >= slides.length - 1) {
      setPlaying(false);
      return;
    }
    const slide = slides[index];
    const extra = slide?.kind === "photo" && slide.text ? Math.min(6000, slide.text.length * 35) : 0;
    const t = setTimeout(() => go(1), DURATION + extra);
    return () => clearTimeout(t);
  }, [playing, index, slides, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    document.documentElement.requestFullscreen?.().catch(() => undefined);
    let lock: { release(): Promise<void> } | undefined;
    (navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock
      ?.request("screen")
      .then((l) => (lock = l))
      .catch(() => undefined);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
      lock?.release().catch(() => undefined);
    };
  }, [go, onClose]);

  if (!story) return null;
  const cover = story.coverPhotoId ? state.photos[story.coverPhotoId] : undefined;

  return (
    <div className="slideshow" role="dialog" aria-modal="true" aria-label={`Diashow: ${story.title}`}>
      <div className="slide-progress" style={{ width: `${((index + 1) / slides.length) * 100}%` }} />
      {slides.map((slide, i) => {
        if (Math.abs(i - index) > 1) return null;
        const on = i === index;
        if (slide.kind === "title" || slide.kind === "end") {
          return (
            <div key={i} className={`slide${on ? " on" : ""}`}>
              {cover?.thumbUrl && <img className="slide-backdrop" src={cover.thumbUrl} alt="" />}
              <div className="slide-title">
                {slide.kind === "title" ? (
                  <>
                    <p className="mono slide-sub">
                      {story.subtitle}
                    </p>
                    <h2>{story.title}</h2>
                  </>
                ) : (
                  <p className="slide-closing">{story.closing}</p>
                )}
              </div>
            </div>
          );
        }
        const url = urls[slide.photoId] ?? state.photos[slide.photoId]?.thumbUrl;
        return (
          <div key={i} className={`slide${on ? " on" : ""}`}>
            {url && <img className="kb" src={url} alt="" />}
            {slide.heading && (
              <div className="slide-caption">
                <h3>{slide.heading}</h3>
                {slide.text && <p>{slide.text}</p>}
              </div>
            )}
          </div>
        );
      })}
      <div className="slide-zones">
        <button type="button" aria-label="Zurück" onClick={() => go(-1)} />
        <button type="button" aria-label="Weiter" onClick={() => go(1)} />
      </div>
      <div className="slide-controls">
        <button type="button" className="btn btn-icon" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Abspielen"}>
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Diashow schließen">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
