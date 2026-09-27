import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import type { CategoryId, Photo } from "../types";
import { CATEGORY_BY_ID, categoryLabel, primaryCategory } from "../lib/categories";

export function CategoryChip({
  id,
  count,
  pressed,
  onClick,
}: {
  id: CategoryId;
  count?: number;
  pressed?: boolean;
  onClick?: () => void;
}) {
  const def = CATEGORY_BY_ID[id];
  return (
    <button
      type="button"
      className={`chip${onClick ? "" : " static"}`}
      style={{ ["--h" as string]: def.hue }}
      aria-pressed={onClick ? !!pressed : undefined}
      onClick={onClick}
      tabIndex={onClick ? 0 : -1}
    >
      {def.label}
      {count !== undefined && <span className="count">{count}</span>}
    </button>
  );
}

function shortDate(t?: number): string {
  if (t === undefined) return "ohne Datum";
  const d = new Date(t);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}`;
}

export function PhotoMount({
  photo,
  onOpen,
  selected,
  selectable,
  caption = true,
}: {
  photo: Photo;
  onOpen?: () => void;
  selected?: boolean;
  selectable?: boolean;
  caption?: boolean;
}) {
  const cat = primaryCategory(photo);
  const badge = photo.status === "fehler" ? "Fehler" : photo.duplicateOf ? "Doppelt" : photo.quality?.blurry ? "Unscharf" : photo.excluded ? "Aussortiert" : undefined;
  return (
    <button
      type="button"
      className={`mount${photo.excluded || photo.duplicateOf ? " dimmed" : ""}${selected ? " selected" : ""}`}
      onClick={onOpen}
      aria-pressed={selectable ? !!selected : undefined}
      title={photo.name}
    >
      {photo.thumbUrl ? (
        <img className="mount-img" src={photo.thumbUrl} alt={`${categoryLabel(cat)}, ${shortDate(photo.takenAt)}`} loading="lazy" decoding="async" />
      ) : (
        <span className="mount-placeholder mono">{photo.status === "fehler" ? "–" : "…"}</span>
      )}
      {badge && <span className={`badge${photo.status === "fehler" ? " bad" : ""}`}>{badge}</span>}
      {selectable && <span className="check" aria-hidden="true">{selected ? "✓" : ""}</span>}
      {caption && (
        <span className="mount-caption">
          <span className="dot" style={{ ["--h" as string]: CATEGORY_BY_ID[cat].hue }} />
          <span className="label">
            {shortDate(photo.takenAt)} · {categoryLabel(cat)}
          </span>
        </span>
      )}
    </button>
  );
}

export function Dialog({
  title,
  onClose,
  children,
  footer,
  wide,
  flush,
  labelledBy,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** Inhalt ohne Innenabstand (z. B. Bild bis zum Rand) */
  flush?: boolean;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const scrollY = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = scrollY;
      previous?.focus?.();
    };
  }, [onClose]);
  const headingId = labelledBy ?? "dialog-title";
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`dialog${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={headingId} tabIndex={-1} ref={ref}>
        <div className="dialog-head">
          <h2 id={headingId}>{title}</h2>
          <button type="button" className="btn btn-quiet btn-icon" onClick={onClose} aria-label="Schließen">
            <X size={20} />
          </button>
        </div>
        <div className={`dialog-body${flush ? " flush" : ""}`}>{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" className="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} />;
}

export function Option<T extends string>({
  value,
  current,
  onSelect,
  title,
  text,
  disabled,
}: {
  value: T;
  current: T;
  onSelect: (v: T) => void;
  title: string;
  text?: string;
  disabled?: boolean;
}) {
  return (
    <button type="button" className="option" aria-pressed={value === current} onClick={() => onSelect(value)} disabled={disabled}>
      <strong>{title}</strong>
      {text && <span>{text}</span>}
    </button>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

/**
 * Lange Listen häppchenweise zeigen – 20.000 Vorschaubilder auf einmal legen
 * jedes iPhone lahm. `resetKey` wechselt z. B. mit dem Filter und fängt dann
 * wieder bei der ersten Seite an.
 */
export function usePaged<T>(items: T[], pageSize: number, resetKey: string = "") {
  const [page, setPage] = useState({ key: resetKey, limit: pageSize });
  let limit = page.limit;
  if (page.key !== resetKey) {
    limit = pageSize;
    setPage({ key: resetKey, limit });
  }
  return {
    shown: items.length > limit ? items.slice(0, limit) : items,
    rest: Math.max(0, items.length - limit),
    more: () => setPage((p) => ({ ...p, limit: p.limit + pageSize })),
    step: pageSize,
  };
}

/** Knopf unter einer Liste; lädt beim Hinscrollen von selbst nach. */
export function ShowMore({ paged, noun }: { paged: { rest: number; more: () => void; step: number }; noun: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { rest, more } = paged;
  const moreRef = useRef(more);
  moreRef.current = more;
  useEffect(() => {
    const el = ref.current;
    if (!el || rest <= 0 || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && moreRef.current(), { rootMargin: "600px 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [rest]);
  if (rest <= 0) return null;
  return (
    <div className="show-more" ref={ref}>
      <button type="button" className="btn btn-small" onClick={more}>
        {Math.min(rest, paged.step)} weitere {noun} anzeigen
      </button>
      <span className="muted small num">noch {rest}</span>
    </div>
  );
}
