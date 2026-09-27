import type { CategoryId, CategoryScore, ColorInfo, Recognition } from "../types";
import { meaningOf } from "./imagenet";

// Entscheidet anhand aller Merkmale, in welche Kategorien ein Foto gehört.
// Jede Kategorie sammelt Punkte aus mehreren Quellen (KI-Motiv, gefundene
// Objekte, Farben, Dateityp). Die Gründe werden mitgeschrieben, damit die App
// erklären kann, warum ein Bild wo gelandet ist.

export interface CategorizeInput {
  colors?: ColorInfo;
  recognition?: Recognition;
  name: string;
  type: string;
  width?: number;
  height?: number;
  hasCameraExif?: boolean;
}

const COCO_GROUPS: Record<string, { cat: CategoryId; de: string }> = {
  bird: { cat: "tiere", de: "Vogel" },
  cat: { cat: "tiere", de: "Katze" },
  dog: { cat: "tiere", de: "Hund" },
  horse: { cat: "tiere", de: "Pferd" },
  sheep: { cat: "tiere", de: "Schaf" },
  cow: { cat: "tiere", de: "Kuh" },
  elephant: { cat: "tiere", de: "Elefant" },
  bear: { cat: "tiere", de: "Bär" },
  zebra: { cat: "tiere", de: "Zebra" },
  giraffe: { cat: "tiere", de: "Giraffe" },
  banana: { cat: "essen", de: "Banane" },
  apple: { cat: "essen", de: "Apfel" },
  sandwich: { cat: "essen", de: "Sandwich" },
  orange: { cat: "essen", de: "Orange" },
  broccoli: { cat: "essen", de: "Brokkoli" },
  carrot: { cat: "essen", de: "Karotte" },
  "hot dog": { cat: "essen", de: "Hotdog" },
  pizza: { cat: "essen", de: "Pizza" },
  donut: { cat: "essen", de: "Donut" },
  cake: { cat: "essen", de: "Kuchen" },
  bowl: { cat: "essen", de: "Schüssel" },
  bicycle: { cat: "unterwegs", de: "Fahrrad" },
  car: { cat: "unterwegs", de: "Auto" },
  motorcycle: { cat: "unterwegs", de: "Motorrad" },
  airplane: { cat: "unterwegs", de: "Flugzeug" },
  bus: { cat: "unterwegs", de: "Bus" },
  train: { cat: "unterwegs", de: "Zug" },
  truck: { cat: "unterwegs", de: "Lastwagen" },
  boat: { cat: "unterwegs", de: "Boot" },
  "sports ball": { cat: "sport", de: "Ball" },
  skis: { cat: "sport", de: "Ski" },
  snowboard: { cat: "sport", de: "Snowboard" },
  surfboard: { cat: "sport", de: "Surfbrett" },
  skateboard: { cat: "sport", de: "Skateboard" },
  "tennis racket": { cat: "sport", de: "Tennisschläger" },
  "baseball bat": { cat: "sport", de: "Schläger" },
  kite: { cat: "sport", de: "Drachen" },
  frisbee: { cat: "sport", de: "Frisbee" },
  couch: { cat: "zuhause", de: "Sofa" },
  bed: { cat: "zuhause", de: "Bett" },
  tv: { cat: "zuhause", de: "Fernseher" },
  "dining table": { cat: "zuhause", de: "Tisch" },
  toilet: { cat: "zuhause", de: "Toilette" },
  sink: { cat: "zuhause", de: "Spüle" },
  refrigerator: { cat: "zuhause", de: "Kühlschrank" },
  oven: { cat: "zuhause", de: "Ofen" },
  microwave: { cat: "zuhause", de: "Mikrowelle" },
  "potted plant": { cat: "zuhause", de: "Zimmerpflanze" },
  "traffic light": { cat: "stadt", de: "Ampel" },
  "stop sign": { cat: "stadt", de: "Stoppschild" },
  "fire hydrant": { cat: "stadt", de: "Hydrant" },
  "parking meter": { cat: "stadt", de: "Parkuhr" },
  laptop: { cat: "dokumente", de: "Laptop" },
  book: { cat: "dokumente", de: "Buch" },
  keyboard: { cat: "dokumente", de: "Tastatur" },
};

export const COCO_DE: Record<string, string> = {
  person: "Person",
  "wine glass": "Weinglas",
  cup: "Tasse",
  bottle: "Flasche",
  chair: "Stuhl",
  bench: "Bank",
  umbrella: "Schirm",
  backpack: "Rucksack",
  handbag: "Handtasche",
  suitcase: "Koffer",
  "cell phone": "Handy",
  clock: "Uhr",
  vase: "Vase",
  ...Object.fromEntries(Object.entries(COCO_GROUPS).map(([k, v]) => [k, v.de])),
};

const SCREEN_RATIOS = [16 / 9, 19.5 / 9, 20 / 9, 2.16, 4 / 3, 1.6, 1.5];

const pct = (v: number) => `${Math.round(v * 100)} %`;

export function looksLikeScreenshot(input: CategorizeInput): boolean {
  const name = input.name.toLowerCase();
  if (/screenshot|bildschirmfoto|screen shot|capture d/.test(name)) return true;
  if (input.hasCameraExif) return false;
  if (input.type !== "image/png") return false;
  if (!input.width || !input.height) return false;
  const ratio = Math.max(input.width, input.height) / Math.min(input.width, input.height);
  return SCREEN_RATIOS.some((r) => Math.abs(r - ratio) < 0.03);
}

export function categorize(input: CategorizeInput): CategoryScore[] {
  const scores = new Map<CategoryId, { score: number; reasons: string[] }>();
  const add = (id: CategoryId, points: number, reason: string) => {
    if (points <= 0) return;
    const entry = scores.get(id) ?? { score: 0, reasons: [] };
    entry.score += points;
    if (!entry.reasons.includes(reason)) entry.reasons.push(reason);
    scores.set(id, entry);
  };

  // 1. Motiv-Erkennung (MobileNet)
  for (const label of input.recognition?.labels ?? []) {
    const meaning = meaningOf(label.index);
    if (!meaning || label.prob < 0.04) continue;
    for (const [cat, weight] of Object.entries(meaning.cats) as [CategoryId, number][]) {
      add(cat, label.prob * weight * 1.1, `Motiv: ${meaning.de} (${pct(label.prob)})`);
    }
  }

  // 2. Gefundene Objekte (COCO-SSD)
  const objects = (input.recognition?.objects ?? []).filter((o) => o.score >= 0.5);
  const people = objects.filter((o) => o.name === "person");
  if (people.length > 0) {
    const biggest = Math.max(...people.map((p) => p.area));
    // Menschen zählen nur, wenn sie das Bild prägen – nicht als winzige Passanten.
    if (biggest > 0.04 || people.length >= 3) {
      const points = Math.min(0.95, 0.35 + biggest * 1.5 + people.length * 0.08);
      const kind = people.length === 1 ? (biggest > 0.18 ? "Porträt" : "1 Person") : `${people.length} Personen`;
      add("menschen", points, `${kind} erkannt`);
    }
  }
  for (const obj of objects) {
    const group = COCO_GROUPS[obj.name];
    if (!group) continue;
    const minArea = group.cat === "zuhause" || group.cat === "stadt" ? 0.02 : 0.015;
    if (obj.area < minArea) continue;
    const weight = group.cat === "zuhause" ? 0.35 : group.cat === "dokumente" ? 0.4 : 0.55;
    add(group.cat, obj.score * weight + Math.min(0.3, obj.area), `${group.de} im Bild`);
  }
  const drinks = objects.filter((o) => ["wine glass", "cup", "bottle"].includes(o.name)).length;
  if (objects.some((o) => o.name === "cake") && people.length >= 1) add("feier", 0.5, "Kuchen und Menschen");
  if (drinks >= 2 && people.length >= 2) add("feier", 0.45, "Gläser und mehrere Menschen");
  if (people.length >= 5) add("feier", 0.25, "Viele Menschen");

  // 3. Farben und Licht
  const c = input.colors;
  if (c) {
    if (c.sky.warm > 0.3 && c.brightness < 0.72 && c.saturation > 0.28) {
      add("himmel", Math.min(0.85, 0.3 + c.sky.warm), "Warmes Licht am Himmel");
    } else if (c.shares.warm > 0.4 && c.brightness < 0.6 && c.warmth > 0.25) {
      add("himmel", 0.3, "Abendlicht");
    }
    if (c.brightness < 0.2 && c.shares.dark > 0.5) {
      const withLights = c.contrast > 0.12 || c.shares.warm > 0.04;
      add("nacht", withLights ? 0.6 : 0.4, withLights ? "Dunkel mit Lichtern" : "Sehr dunkles Bild");
    }
    if (c.shares.white > 0.3 && c.saturation < 0.2 && c.brightness > 0.62 && c.warmth < 0.15) {
      add("winter", Math.min(0.6, c.shares.white), "Viel Weiß in kühlen Tönen");
    }
    if (c.shares.green > 0.3) add("natur", Math.min(0.45, c.shares.green * 0.7), "Viel Grün");
    if (c.sky.blue > 0.35 && c.shares.blue > 0.3 && c.shares.green < 0.2) {
      add("strand", 0.15, "Viel Blau");
    }
  }

  // 4. Screenshots
  if (looksLikeScreenshot(input)) add("dokumente", 0.9, "Sieht aus wie ein Bildschirmfoto");

  const result = [...scores.entries()]
    .map(([id, v]) => ({ id, score: Math.min(1, v.score), reasons: v.reasons }))
    .sort((a, b) => b.score - a.score);

  const top = result[0];
  if (!top || top.score < 0.25) {
    return [{ id: "sonstiges", score: 1, reasons: ["Kein eindeutiges Motiv erkannt"] }];
  }
  // Nebenkategorien nur, wenn sie deutlich genug sind.
  return result.filter((r, i) => i === 0 || (r.score >= 0.3 && r.score >= top.score * 0.35)).slice(0, 3);
}
