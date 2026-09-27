import { z } from "zod";
import type { Photo, Story, StoryLength, StoryStyle } from "../types";
import { categoryLabel, effectiveCategories } from "./categories";
import { COCO_DE } from "./categorize";
import { formatDate, formatTime } from "./events";
import { labelName } from "./imagenet";
import { getSample } from "./platform";
import { thumbBlob } from "./photoData";
import { colorName, joinGerman } from "./storyText";

// Lässt Claude die Geschichte schreiben. Zwei Wege:
// 1. Auf claude.ai (als Artifact): über die eingebaute "sample"-Fähigkeit –
//    kein Schlüssel nötig, es zählt das Kontingent der Person, die die Seite nutzt.
// 2. Selbst gehostet: direkt über die Claude API mit eigenem API-Schlüssel.
// Mitgeschickt werden die Gliederung (Daten, erkannte Motive) und je Kapitel
// ein kleines Vorschaubild.

const MODEL = "claude-opus-5";

const StorySchema = z.object({
  title: z.string(),
  chapters: z.array(z.object({ id: z.string(), heading: z.string(), text: z.string() })),
  closing: z.string(),
});

export type ClaudeStory = z.infer<typeof StorySchema>;

const STYLE_GUIDE: Record<StoryStyle, string> = {
  erzaehlung: "eine warme, bildhafte Erzählung in der Wir-Form und in der Vergangenheit",
  maerchen: "ein Märchen in der dritten Person: beginnt mit „Es war einmal“, verspielt, für Kinder geeignet, mit einem märchenhaften Schluss",
  tagebuch: "ein Tagebucheintrag in der Ich-Form, persönlich und locker",
};

const LENGTH_GUIDE: Record<StoryLength, string> = {
  kurz: "1 bis 2 Sätze pro Kapitel",
  mittel: "3 bis 4 Sätze pro Kapitel",
  lang: "5 bis 7 Sätze pro Kapitel",
};

function describePhoto(p: Photo): string {
  const parts: string[] = [];
  const labels = (p.recognition?.labels ?? []).filter((l) => l.prob >= 0.12).slice(0, 3);
  if (labels.length) parts.push(`Motiv: ${labels.map((l) => `${labelName(l.index, l.name)} (${Math.round(l.prob * 100)} %)`).join(", ")}`);
  const objects = (p.recognition?.objects ?? []).filter((o) => o.score >= 0.5);
  const people = objects.filter((o) => o.name === "person").length;
  const things = [...new Set(objects.filter((o) => o.name !== "person").map((o) => COCO_DE[o.name] ?? o.name))];
  if (people) parts.push(`${people} ${people === 1 ? "Person" : "Personen"}`);
  if (things.length) parts.push(`Objekte: ${things.join(", ")}`);
  parts.push(`Kategorien: ${effectiveCategories(p).map(categoryLabel).join(", ")}`);
  if (p.colors) {
    const colors = [...new Set(p.colors.palette.slice(0, 3).map((c) => colorName(c.hex)))];
    parts.push(`Farben: ${joinGerman(colors)}`);
  }
  if (p.takenAt !== undefined) parts.push(`Uhrzeit: ${formatTime(p.takenAt)}`);
  return parts.join("; ");
}

export function buildPrompt(story: Story, photos: Record<string, Photo>, style: StoryStyle, length: StoryLength): string {
  const outline = story.chapters
    .map((c, i) => {
      const chapterPhotos = c.photoIds.map((id) => photos[id]).filter(Boolean);
      const first = chapterPhotos[0];
      const when = first?.takenAt !== undefined ? formatDate(first.takenAt, true) : "ohne Datum";
      const lines = [
        `Kapitel ${c.id} (Bild ${i + 1} ist das erste Foto dieses Kapitels) – ${when}${c.place ? ` – Ort: ${c.place}` : ""}`,
        ...chapterPhotos.map((p, j) => `  Foto ${j + 1}: ${describePhoto(p)}`),
      ];
      return lines.join("\n");
    })
    .join("\n\n");

  return [
    "Du schreibst eine kurze Bildergeschichte auf Deutsch zu einem privaten Fotoalbum.",
    `Stil: ${STYLE_GUIDE[style]}. Länge: ${LENGTH_GUIDE[length]}.`,
    "Angehängt ist pro Kapitel ein Vorschaubild, in der Reihenfolge der Kapitel. Die automatische Erkennung darunter kann danebenliegen – verlass dich im Zweifel auf das, was du auf dem Bild siehst.",
    "Regeln: Erfinde keine Namen von Personen. Nenne Orte nur, wenn sie unten stehen. Beschreibe, was wirklich zu sehen ist, konkret und mit Gefühl, ohne Kitsch. Keine Emojis. Jedes Kapitel bekommt eine kurze Überschrift (2 bis 5 Wörter).",
    "",
    `Arbeitstitel: ${story.title}`,
    `Zeitraum und Umfang: ${story.subtitle}`,
    "",
    outline,
    "",
    'Antworte nur mit JSON in dieser Form: {"title": "…", "chapters": [{"id": "k0", "heading": "…", "text": "…"}], "closing": "ein Schlusssatz"}. Verwende genau die Kapitel-IDs von oben.',
  ].join("\n");
}

function mergeIntoStory(story: Story, result: ClaudeStory): Story {
  const byId = new Map(result.chapters.map((c) => [c.id, c]));
  return {
    ...story,
    title: result.title?.trim() || story.title,
    chapters: story.chapters.map((c, i) => {
      const written = byId.get(c.id) ?? result.chapters[i];
      return written ? { ...c, heading: written.heading.trim() || c.heading, text: written.text.trim() || c.text } : c;
    }),
    closing: result.closing?.trim() || story.closing,
    author: "claude",
  };
}

function validate(value: unknown): ClaudeStory {
  const parsed = StorySchema.safeParse(value);
  if (!parsed.success) throw new ClaudeError("Claude hat in einem unerwarteten Format geantwortet. Bitte noch einmal versuchen.");
  return parsed.data;
}

export class ClaudeError extends Error {
  constructor(
    message: string,
    readonly hideFeature = false,
  ) {
    super(message);
  }
}

export type ClaudeAccess = { kind: "claude.ai" } | { kind: "api"; apiKey: string } | { kind: "keiner" };

export async function claudeAccess(apiKey: string): Promise<ClaudeAccess> {
  if (await getSample()) return { kind: "claude.ai" };
  if (apiKey.trim()) return { kind: "api", apiKey: apiKey.trim() };
  return { kind: "keiner" };
}

export interface WriteOptions {
  story: Story;
  photos: Record<string, Photo>;
  access: ClaudeAccess;
  signal?: AbortSignal;
  onText?: (text: string) => void;
}

export async function writeWithClaude({ story, photos, access, signal, onText }: WriteOptions): Promise<Story> {
  const prompt = buildPrompt(story, photos, story.style, story.length);
  const thumbs = (await Promise.all(story.chapters.map((c) => (photos[c.photoIds[0]] ? thumbBlob(photos[c.photoIds[0]]) : undefined)))).filter(
    (b): b is Blob => !!b,
  );

  if (access.kind === "claude.ai") {
    const sample = (await getSample())!;
    const limits = await sample.limits().catch(() => null);
    const maxImages = limits?.images?.maxCount ?? 0;
    const images = maxImages > 0 ? thumbs.slice(0, maxImages) : undefined;
    try {
      const value = await sample.json(prompt, {
        images,
        signal,
        cache: false,
        onText: onText ? ({ text }) => onText(text) : undefined,
      });
      return mergeIntoStory(story, validate(value));
    } catch (err) {
      throw sampleError(err);
    }
  }

  if (access.kind === "api") {
    const [{ default: Anthropic }, { betaZodOutputFormat }] = await Promise.all([
      import("@anthropic-ai/sdk"),
      import("@anthropic-ai/sdk/helpers/beta/zod"),
    ]);
    const client = new Anthropic({ apiKey: access.apiKey, dangerouslyAllowBrowser: true });
    const imageBlocks = await Promise.all(
      thumbs.slice(0, 20).map(async (blob) => ({
        type: "image" as const,
        source: { type: "base64" as const, media_type: "image/jpeg" as const, data: await blobToBase64(blob) },
      })),
    );
    try {
      const response = await client.beta.messages.parse(
        {
          model: MODEL,
          max_tokens: 16000,
          // Lehnt das Modell ab, springt serverseitig automatisch ein passendes Ersatzmodell ein.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { effort: "medium", format: betaZodOutputFormat(StorySchema) },
          messages: [{ role: "user", content: [...imageBlocks, { type: "text", text: prompt }] }],
        },
        { signal },
      );
      if (response.stop_reason === "refusal") throw new ClaudeError("Claude möchte zu diesen Bildern keine Geschichte schreiben.");
      if (response.stop_reason === "max_tokens") throw new ClaudeError("Die Geschichte wurde zu lang. Bitte eine kürzere Länge wählen.");
      if (!response.parsed_output) throw new ClaudeError("Claude hat in einem unerwarteten Format geantwortet. Bitte noch einmal versuchen.");
      return mergeIntoStory(story, response.parsed_output);
    } catch (err) {
      if (err instanceof ClaudeError) throw err;
      if (err instanceof Anthropic.AuthenticationError) throw new ClaudeError("Der API-Schlüssel wurde nicht akzeptiert. Bitte in den Einstellungen prüfen.");
      if (err instanceof Anthropic.PermissionDeniedError) throw new ClaudeError("Dieser API-Schlüssel darf das Modell nicht verwenden.");
      if (err instanceof Anthropic.RateLimitError) throw new ClaudeError("Zu viele Anfragen – bitte in einer Minute noch einmal versuchen.");
      if (err instanceof Anthropic.APIUserAbortError) throw new ClaudeError("Abgebrochen.");
      if (err instanceof Anthropic.APIConnectionError) throw new ClaudeError("Keine Verbindung zu Claude. Bitte die Internetverbindung prüfen.");
      if (err instanceof Anthropic.APIError) throw new ClaudeError(`Claude ist gerade nicht erreichbar (Fehler ${err.status ?? "unbekannt"}).`);
      throw err;
    }
  }

  throw new ClaudeError("Für Claude wird ein API-Schlüssel benötigt (Einstellungen).");
}

function sampleError(err: unknown): Error {
  if (err instanceof ClaudeError) return err;
  const code = (err as { code?: string })?.code;
  switch (code) {
    case "cancelled":
      return new ClaudeError("Abgebrochen.");
    case "not_granted":
    case "sampling_disabled":
    case "not_declared":
    case "capability_disabled":
    case "capability_removed":
      return new ClaudeError("Claude ist hier nicht freigegeben. Der eingebaute Erzähler schreibt die Geschichte trotzdem.", true);
    case "rate_limited":
      return new ClaudeError("Gerade zu viele Anfragen – bitte später noch einmal versuchen.");
    case "refused":
      return new ClaudeError("Claude möchte zu diesen Bildern keine Geschichte schreiben.");
    case "invalid_json":
    case "empty_completion":
      return new ClaudeError("Claude hat in einem unerwarteten Format geantwortet. Bitte noch einmal versuchen.");
    case "session_expired":
      return new ClaudeError("Bitte bei claude.ai neu anmelden.");
    case "image_rejected":
      return new ClaudeError("Ein Vorschaubild wurde nicht angenommen.");
    default:
      return new ClaudeError("Claude ist gerade nicht erreichbar. Bitte später noch einmal versuchen.");
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
