export type CategoryId =
  | "menschen"
  | "tiere"
  | "essen"
  | "strand"
  | "berge"
  | "natur"
  | "stadt"
  | "unterwegs"
  | "sport"
  | "feier"
  | "zuhause"
  | "himmel"
  | "nacht"
  | "winter"
  | "dokumente"
  | "sonstiges";

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface PaletteColor {
  hex: string;
  share: number;
}

export interface ColorInfo {
  /** mittlere Helligkeit 0..1 */
  brightness: number;
  /** Streuung der Helligkeit 0..~0.5 */
  contrast: number;
  /** mittlere Sättigung 0..1 */
  saturation: number;
  /** -1 (kühl/blau) .. 1 (warm/orange) */
  warmth: number;
  /** dominante Farben, größter Anteil zuerst */
  palette: PaletteColor[];
  /** Flächenanteile bestimmter Farbgruppen (0..1) */
  shares: {
    green: number;
    blue: number;
    white: number;
    warm: number;
    dark: number;
    bright: number;
  };
  /** Werte nur für das obere Bilddrittel (Himmel) */
  sky: {
    warm: number;
    blue: number;
    brightness: number;
  };
  /** Werte nur für die untere Bildhälfte (Boden) */
  ground: {
    white: number;
    brightness: number;
  };
}

export interface QualityInfo {
  /** Varianz des Laplace-Filters – höher heißt schärfer */
  sharpness: number;
  blurry: boolean;
  exposure: "dunkel" | "ok" | "hell";
  /** 0..1, grobe Gesamtbewertung für die Bildauswahl */
  score: number;
}

export interface RecognizedLabel {
  /** ImageNet-Klasse 0..999 */
  index: number;
  name: string;
  prob: number;
}

export interface DetectedObject {
  name: string;
  score: number;
  /** Anteil der Bildfläche 0..1 */
  area: number;
}

export interface Recognition {
  labels: RecognizedLabel[];
  objects: DetectedObject[];
}

export interface CategoryScore {
  id: CategoryId;
  score: number;
  reasons: string[];
}

export type PhotoStatus = "wartet" | "fertig" | "fehler";

export interface Photo {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  source: "eigene" | "beispiel";
  status: PhotoStatus;
  error?: string;

  thumbUrl?: string;
  /** kleines JPEG (480 px) – für Anzeige und als Vorschaubild für Claude */
  thumb?: Blob;
  width?: number;
  height?: number;

  takenAt?: number;
  dateSource?: "exif" | "dateiname" | "datei";
  gps?: GeoPoint;
  /** Ortsname aus Metadaten, Beispieldaten oder OpenStreetMap */
  place?: string;
  /** Bildnachweis (bei Beispielfotos) */
  credit?: string;
  camera?: string;
  hasCameraExif?: boolean;

  colors?: ColorInfo;
  quality?: QualityInfo;
  hash?: string;
  recognition?: Recognition;

  /** automatisch ermittelt, beste zuerst */
  categories: CategoryScore[];
  /** vom Menschen korrigiert – hat Vorrang */
  manualCategories?: CategoryId[];

  /** gehört zu einer Gruppe nahezu gleicher Bilder; zeigt auf das beste */
  duplicateOf?: string;
  /** aussortiert (wird beim Export in einen eigenen Ordner gelegt) */
  excluded?: boolean;
}

export type EventKind = "erlebnis" | "reise" | "ohne-datum";

export interface PhotoEvent {
  id: string;
  kind: EventKind;
  photoIds: string[];
  start?: number;
  end?: number;
  days: number;
  center?: GeoPoint;
  place?: string;
  title: string;
  topCategories: { id: CategoryId; count: number }[];
}

export type StoryStyle = "erzaehlung" | "maerchen" | "tagebuch";
export type StoryLength = "kurz" | "mittel" | "lang";
export type StoryAuthor = "eingebaut" | "claude";

export interface StorySource {
  kind: "erlebnis" | "kategorie" | "jahr" | "auswahl";
  ref: string;
  label: string;
}

export interface StoryChapter {
  id: string;
  heading: string;
  text: string;
  photoIds: string[];
  dateLabel?: string;
  place?: string;
}

export interface Story {
  id: string;
  title: string;
  subtitle: string;
  style: StoryStyle;
  length: StoryLength;
  source: StorySource;
  chapters: StoryChapter[];
  closing: string;
  coverPhotoId?: string;
  /** alle Fotos, aus denen ausgewählt wurde (für "Neu würfeln") */
  photoPool: string[];
  seed: number;
  author: StoryAuthor;
  createdAt: number;
}

export interface Settings {
  recognition: boolean;
  placeNames: boolean;
  /** Stunden ohne Foto, nach denen ein neues Erlebnis beginnt */
  eventGapHours: number;
  apiKey: string;
}
