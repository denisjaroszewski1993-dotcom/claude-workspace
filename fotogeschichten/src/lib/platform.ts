// Die App läuft entweder als normale Webseite oder als Artifact auf claude.ai.
// Auf claude.ai stellt die Umgebung zwei Fähigkeiten bereit: Dateien zum
// Speichern anbieten ("downloads") und Claude fragen ("sample").

export interface SampleResult {
  text: string;
  truncated: boolean;
}

export interface SampleOptions {
  images?: Blob[];
  modelTier?: "default" | "complex" | "quick";
  signal?: AbortSignal;
  onText?: (update: { text: string; delta: string }) => void;
  cache?: boolean;
}

export interface SampleFn {
  (input: string, options?: SampleOptions): Promise<SampleResult>;
  json<T = unknown>(input: string, options?: SampleOptions): Promise<T>;
  limits(): Promise<{ maxPromptBytes: number; images?: { maxCount: number; maxInputBytes: number; mediaTypes: string[] } }>;
}

interface Downloads {
  save(request: { filename: string; data: Blob | string }): Promise<{ status: "saved" | "delivered" }>;
}

interface ClaudeHost {
  use(name: string): Promise<unknown>;
}

declare global {
  interface Window {
    claude?: ClaudeHost;
  }
}

export function inClaudeViewer(): boolean {
  return typeof window !== "undefined" && typeof window.claude?.use === "function";
}

let samplePromise: Promise<SampleFn | null> | undefined;
let downloadsPromise: Promise<Downloads | null> | undefined;

export function getSample(): Promise<SampleFn | null> {
  if (!inClaudeViewer()) return Promise.resolve(null);
  samplePromise ??= window.claude!.use("sample").then(
    (s) => (s as SampleFn) ?? null,
    () => null,
  );
  return samplePromise;
}

function getDownloads(): Promise<Downloads | null> {
  if (!inClaudeViewer()) return Promise.resolve(null);
  downloadsPromise ??= window.claude!.use("downloads").then(
    (d) => (d as Downloads) ?? null,
    () => null,
  );
  return downloadsPromise;
}

export class SaveError extends Error {
  constructor(
    message: string,
    readonly declined = false,
  ) {
    super(message);
  }
}

/** Bietet eine Datei zum Speichern an – auf claude.ai über den Dialog der Umgebung. */
export async function saveFile(filename: string, data: Blob): Promise<void> {
  const downloads = await getDownloads();
  if (downloads) {
    try {
      await downloads.save({ filename, data });
      return;
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "declined") throw new SaveError("Speichern abgebrochen.", true);
      if (code === "too_large") throw new SaveError("Die Datei ist zu groß für diesen Weg. Bitte weniger Fotos auswählen.");
      if (code !== "unavailable" && code !== "not_granted") throw new SaveError("Die Datei konnte nicht gespeichert werden.");
      // sonst: klassischer Download-Link
    }
  }
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export type Device = "ios" | "mac" | "windows" | "android" | "anderes";

/** Grobe Geräteerkennung – nur für passende Bedienhinweise, nicht für Funktionen. */
export function detectDevice(): Device {
  if (typeof navigator === "undefined") return "anderes";
  const ua = navigator.userAgent;
  // iPadOS meldet sich als Mac, hat aber einen Touchscreen
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Macintosh/.test(ua)) return "mac";
  if (/Windows/.test(ua)) return "windows";
  return "anderes";
}
