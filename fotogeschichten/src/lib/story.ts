import type { CategoryId, Photo, Story, StoryChapter, StoryLength, StorySource, StoryStyle } from "../types";
import { effectiveCategories } from "./categories";
import { COCO_DE } from "./categorize";
import { dayKey, formatDate, formatRange, formatTime, weekdayName } from "./events";
import { meaningOf } from "./imagenet";
import { hammingDistance } from "./pixels";
import { createRandom, type Random } from "./random";
import { chapterHeading, chapterText, closingLine, storyTitle, type ChapterFacts } from "./storyText";

// Baut aus einer Menge Fotos eine Geschichte: Kapitel bilden, die besten und
// unterschiedlichsten Bilder auswählen, Texte schreiben lassen.

const LIMITS: Record<StoryLength, { chapters: number; photos: number }> = {
  kurz: { chapters: 3, photos: 2 },
  mittel: { chapters: 6, photos: 3 },
  lang: { chapters: 10, photos: 5 },
};

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

interface Group {
  photos: Photo[];
  month?: number;
}

/** Gruppiert chronologisch: Monate (lange Zeiträume), Tage (Reisen) oder Tageszeit-Blöcke. */
export function groupForChapters(photos: Photo[], kind: StorySource["kind"]): Group[] {
  const dated = photos.filter((p) => p.takenAt !== undefined).sort((a, b) => a.takenAt! - b.takenAt!);
  const undated = photos.filter((p) => p.takenAt === undefined);
  const groups: Group[] = [];

  if (dated.length) {
    const span = dated[dated.length - 1].takenAt! - dated[0].takenAt!;
    if (kind === "jahr" || span > 60 * DAY) {
      const byMonth = new Map<string, Photo[]>();
      for (const p of dated) {
        const d = new Date(p.takenAt!);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        byMonth.set(key, [...(byMonth.get(key) ?? []), p]);
      }
      for (const list of byMonth.values()) groups.push({ photos: list, month: new Date(list[0].takenAt!).getMonth() });
    } else {
      // Neuer Abschnitt bei jedem neuen Tag und nach Pausen von mehr als 90 Minuten.
      // Zu viele Abschnitte fasst limitGroups danach wieder zusammen.
      let current: Photo[] = [];
      for (const p of dated) {
        const prev = current[current.length - 1];
        if (prev && (p.takenAt! - prev.takenAt! > 90 * MINUTE || dayKey(p.takenAt!) !== dayKey(prev.takenAt!))) {
          groups.push({ photos: current });
          current = [];
        }
        current.push(p);
      }
      if (current.length) groups.push({ photos: current });
      // Ein einziger, großer Block wird in der Mitte geteilt, damit die Geschichte Luft bekommt.
      if (groups.length === 1 && groups[0].photos.length > 6) {
        const all = groups[0].photos;
        const half = Math.ceil(all.length / 2);
        groups.splice(0, 1, { photos: all.slice(0, half) }, { photos: all.slice(half) });
      }
    }
  }
  if (undated.length) groups.push({ photos: undated });
  return groups;
}

/**
 * Benachbarte Gruppen mit dem kleinsten Abstand zusammenlegen, bis das Limit
 * passt. Über Nacht wird nur zusammengelegt, wenn es nicht anders geht.
 */
export function limitGroups(groups: Group[], max: number): Group[] {
  const result = groups.map((g) => ({ ...g, photos: [...g.photos] }));
  while (result.length > max) {
    let bestIndex = 0;
    let bestCost = Infinity;
    for (let i = 0; i < result.length - 1; i++) {
      const a = result[i].photos;
      const b = result[i + 1].photos;
      const lastA = a[a.length - 1].takenAt;
      const firstB = b[0].takenAt;
      const gap = firstB !== undefined && lastA !== undefined ? firstB - lastA : Infinity;
      const overnight = firstB !== undefined && lastA !== undefined && dayKey(firstB) !== dayKey(lastA) ? DAY : 0;
      const cost = gap + overnight + (a.length + b.length) * 10 * MINUTE;
      if (cost < bestCost) {
        bestCost = cost;
        bestIndex = i;
      }
    }
    const merged = { photos: [...result[bestIndex].photos, ...result[bestIndex + 1].photos], month: result[bestIndex].month };
    result.splice(bestIndex, 2, merged);
  }
  return result;
}

function peopleIn(p: Photo): number {
  return (p.recognition?.objects ?? []).filter((o) => o.name === "person" && o.score >= 0.5 && o.area > 0.01).length;
}

/** Wählt gute und möglichst unterschiedliche Bilder, Reihenfolge bleibt chronologisch. */
export function selectPhotos(photos: Photo[], count: number, focus: CategoryId[]): Photo[] {
  const usable = photos.filter((p) => !p.excluded && !p.duplicateOf);
  const pool = usable.filter((p) => !p.quality?.blurry).length >= Math.min(count, usable.length) ? usable.filter((p) => !p.quality?.blurry) : usable;
  const chosen: Photo[] = [];
  const baseScore = (p: Photo) => {
    let s = p.quality?.score ?? 0.5;
    const cats = effectiveCategories(p);
    if (cats.some((c) => focus.includes(c))) s += 0.12;
    if (peopleIn(p) > 0) s += 0.08;
    if (cats[0] === "dokumente") s -= 0.3;
    return s;
  };
  while (chosen.length < count && chosen.length < pool.length) {
    let best: Photo | undefined;
    let bestScore = -Infinity;
    for (const p of pool) {
      if (chosen.includes(p)) continue;
      let s = baseScore(p);
      for (const c of chosen) {
        if (p.hash && c.hash && hammingDistance(p.hash, c.hash) < 18) s -= 0.35;
        if (effectiveCategories(p)[0] === effectiveCategories(c)[0]) s -= 0.06;
        if (p.takenAt !== undefined && c.takenAt !== undefined && Math.abs(p.takenAt - c.takenAt) < 2 * MINUTE) s -= 0.1;
      }
      if (s > bestScore) {
        bestScore = s;
        best = p;
      }
    }
    if (!best) break;
    chosen.push(best);
  }
  return chosen.sort((a, b) => (a.takenAt ?? 0) - (b.takenAt ?? 0));
}

function dominantCategories(photos: Photo[]): CategoryId[] {
  const counts = new Map<CategoryId, number>();
  for (const p of photos) {
    effectiveCategories(p).forEach((c, i) => counts.set(c, (counts.get(c) ?? 0) + (i === 0 ? 1 : 0.4)));
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
}

export function describePhotos(photos: Photo[]) {
  const animals: string[] = [];
  const foods: string[] = [];
  const motifs: string[] = [];
  for (const p of photos) {
    for (const l of p.recognition?.labels ?? []) {
      const meaning = meaningOf(l.index);
      if (!meaning || l.prob < 0.15) continue;
      if (meaning.cats.tiere) animals.push(meaning.de);
      if (meaning.cats.essen) foods.push(meaning.de);
      motifs.push(meaning.de);
    }
    for (const o of p.recognition?.objects ?? []) {
      if (o.score < 0.55) continue;
      const de = COCO_DE[o.name];
      if (!de || o.name === "person") continue;
      if (["bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe"].includes(o.name)) animals.unshift(de);
      if (["pizza", "cake", "donut", "broccoli", "carrot", "banana", "apple", "orange", "sandwich", "hot dog"].includes(o.name)) foods.push(de);
    }
  }
  const uniq = (xs: string[]) => [...new Set(xs)];
  return { animals: uniq(animals), foods: uniq(foods), motifs: uniq(motifs) };
}

function average(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export interface BuildStoryOptions {
  photos: Photo[];
  source: StorySource;
  style: StoryStyle;
  length: StoryLength;
  seed: number;
}

export function buildStory({ photos, source, style, length, seed }: BuildStoryOptions): Story {
  const rng: Random = createRandom(seed);
  const limits = LIMITS[length];
  const candidates = photos.filter((p) => !p.excluded && p.status === "fertig");
  const groups = limitGroups(groupForChapters(candidates, source.kind), limits.chapters);
  const usedHeadings = new Set<string>();
  const chapters: StoryChapter[] = [];
  let previousDay: string | undefined;

  groups.forEach((group, index) => {
    const focus = dominantCategories(group.photos);
    const chosen = selectPhotos(group.photos, limits.photos, focus.slice(0, 2));
    if (chosen.length === 0) return;
    const start = group.photos[0].takenAt;
    const day = start !== undefined ? dayKey(start) : undefined;
    const described = describePhotos(chosen);
    const facts: ChapterFacts = {
      index: chapters.length,
      total: groups.length,
      start,
      newDay: !!day && !!previousDay && day !== previousDay,
      month: group.month,
      categories: dominantCategories(chosen).slice(0, 3),
      people: Math.max(0, ...chosen.map(peopleIn)),
      animals: described.animals,
      foods: described.foods,
      palette: chosen.flatMap((p) => p.colors?.palette.slice(0, 2).map((c) => c.hex) ?? []),
      warmth: average(chosen.map((p) => p.colors?.warmth ?? 0)),
      brightness: average(chosen.map((p) => p.colors?.brightness ?? 0.5)),
      saturation: average(chosen.map((p) => p.colors?.saturation ?? 0.3)),
    };
    previousDay = day ?? previousDay;
    const place = mostCommon(group.photos.map((p) => p.place));
    chapters.push({
      id: `k${index}`,
      heading: chapterHeading(facts, rng, usedHeadings),
      text: chapterText(style, length, facts, rng),
      photoIds: chosen.map((p) => p.id),
      dateLabel: start === undefined ? undefined : group.month !== undefined ? String(new Date(start).getFullYear()) : chapterDateLabel(start, style),
      place,
    });
  });

  const dated = candidates.filter((p) => p.takenAt !== undefined).map((p) => p.takenAt!);
  const start = dated.length ? Math.min(...dated) : undefined;
  const end = dated.length ? Math.max(...dated) : undefined;
  const days = new Set(dated.map(dayKey)).size;
  const main = dominantCategories(candidates)[0] ?? "sonstiges";
  const allChosen = chapters.flatMap((c) => c.photoIds);
  const cover = candidates
    .filter((p) => allChosen.includes(p.id))
    .sort((a, b) => (b.quality?.score ?? 0) - (a.quality?.score ?? 0))[0];

  return {
    id: `story-${Date.now().toString(36)}-${seed.toString(36)}`,
    title: storyTitle({ style, kind: source.kind, mainCategory: main, start, days, label: source.label, rng }),
    subtitle: subtitleFor(start, end, candidates),
    style,
    length,
    source,
    chapters,
    closing: closingLine(style, rng),
    coverPhotoId: cover?.id,
    seed,
    author: "eingebaut",
    createdAt: Date.now(),
  };
}

function chapterDateLabel(t: number, style: StoryStyle): string {
  if (style === "tagebuch") return `${formatDate(t, true)}, ${formatTime(t)}`;
  return `${weekdayName(t)}, ${formatTime(t)}`;
}

function mostCommon(values: (string | undefined)[]): string | undefined {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function subtitleFor(start: number | undefined, end: number | undefined, photos: Photo[]): string {
  const parts: string[] = [];
  if (start !== undefined) parts.push(formatRange(start, end));
  const place = mostCommon(photos.map((p) => p.place));
  if (place) parts.push(place);
  parts.push(`${photos.length} ${photos.length === 1 ? "Foto" : "Fotos"}`);
  return parts.join(" · ");
}
