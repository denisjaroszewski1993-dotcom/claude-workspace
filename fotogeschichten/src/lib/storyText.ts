import type { CategoryId, StoryLength, StoryStyle } from "../types";
import { monthName, weekdayName } from "./events";
import type { Random } from "./random";
import { rgbToHsv } from "./pixels";

// Der eingebaute Erzähler. Er setzt Texte aus Satzbausteinen zusammen, die
// zu den erkannten Merkmalen passen (Tageszeit, Motiv, Tiere, Menschen,
// Farben). Die Bausteine sind so formuliert, dass sie grammatisch immer
// stimmen – Ortsnamen und Objekte werden nur dort eingesetzt, wo Artikel und
// Fälle eindeutig sind.

export type Daypart = "morgen" | "mittag" | "nachmittag" | "abend" | "nacht";

export interface ChapterFacts {
  index: number;
  total: number;
  start?: number;
  /** true, wenn das Kapitel an einem neuen Kalendertag beginnt */
  newDay: boolean;
  /** Kapitel steht für einen ganzen Monat (Jahresrückblick) */
  month?: number;
  categories: CategoryId[];
  people: number;
  animals: string[];
  foods: string[];
  palette: string[];
  warmth: number;
  brightness: number;
  saturation: number;
}

export function daypartOf(t: number): Daypart {
  const h = new Date(t).getHours();
  if (h >= 5 && h < 11) return "morgen";
  if (h >= 11 && h < 14) return "mittag";
  if (h >= 14 && h < 18) return "nachmittag";
  if (h >= 18 && h < 22) return "abend";
  return "nacht";
}

export type Season = "fruehling" | "sommer" | "herbst" | "winter";

export function seasonOf(t: number): Season {
  const m = new Date(t).getMonth();
  if (m >= 2 && m <= 4) return "fruehling";
  if (m >= 5 && m <= 7) return "sommer";
  if (m >= 8 && m <= 10) return "herbst";
  return "winter";
}

const SEASON_WORD: Record<Season, string> = {
  fruehling: "Frühling",
  sommer: "Sommer",
  herbst: "Herbst",
  winter: "Winter",
};

// ---------------------------------------------------------------------------
// Farben benennen

export function colorName(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const [h, s, v] = rgbToHsv(r, g, b);
  if (v < 0.18) return "Schwarz";
  if (s < 0.14) return v > 0.82 ? "Weiß" : "Grau";
  if (h < 15 || h >= 345) return v < 0.45 ? "Braun" : "Rot";
  if (h < 40) return v < 0.6 || s < 0.35 ? "Braun" : "Orange";
  if (h < 65) return s < 0.45 ? "Sand" : "Gelb";
  if (h < 160) return "Grün";
  if (h < 195) return "Türkis";
  if (h < 255) return "Blau";
  if (h < 290) return "Violett";
  return "Rosa";
}

export function joinGerman(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} und ${items[items.length - 1]}`;
}

const NUMBER_WORDS = ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf"];
const GROUP_WORDS = ["", "allein", "zu zweit", "zu dritt", "zu viert", "zu fünft", "zu sechst", "zu siebt", "zu acht", "zu neunt", "zu zehnt"];

export function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Tiere mit grammatischem Geschlecht, damit "ein Hund" / "eine Katze" stimmt.
const ANIMAL_GENDER: Record<string, "m" | "f" | "n"> = {
  Hund: "m", Katze: "f", Vogel: "m", Pferd: "n", Schaf: "n", Kuh: "f", Elefant: "m", Bär: "m",
  Zebra: "n", Giraffe: "f", Fisch: "m", Schildkröte: "f", Echse: "f", Krokodil: "n", Schlange: "f",
  Krabbeltier: "n", Beuteltier: "n", Meerestier: "n", Wasservogel: "m", Meeressäuger: "m", Wolf: "m",
  Hyäne: "f", Fuchs: "m", Raubkatze: "f", Erdmännchen: "n", Insekt: "n", Schmetterling: "m",
  Hase: "m", Hamster: "m", Nagetier: "n", Schwein: "n", Nilpferd: "n", Rind: "n", Antilope: "f",
  Marder: "m", Wildtier: "n", Affe: "m", Panda: "m",
};

function withArticle(noun: string): string | undefined {
  const g = ANIMAL_GENDER[noun];
  if (!g) return undefined;
  return `${g === "f" ? "eine" : "ein"} ${noun}`;
}

function pronoun(noun: string): string {
  const g = ANIMAL_GENDER[noun];
  return g === "f" ? "sie" : g === "n" ? "es" : "er";
}

// Nur Speisen, die ohne Artikel in einer Aufzählung natürlich klingen.
const LISTABLE_FOOD = new Set([
  "Espresso", "Obst", "Gemüse", "Pizza", "Pasta", "Eis", "Kuchen", "Suppe", "Schokolade", "Rotwein",
  "Dessert", "Brezel", "Guacamole", "Eintopf", "Kartoffelbrei", "Burger", "Donut", "Brokkoli",
]);

// ---------------------------------------------------------------------------
// Satzbausteine

type Bank = Partial<Record<CategoryId, string[]>>;

const SCENES: Record<StoryStyle, Bank> = {
  erzaehlung: {
    strand: [
      "Der Wind trug den Geruch von Salz über den Sand.",
      "Wellen rollten heran und zogen sich wieder zurück, immer im gleichen ruhigen Takt.",
      "Das Wasser glitzerte bis zum Horizont, und der Himmel schien dort einfach weiterzugehen.",
      "Barfuß im Sand wurde die Zeit langsamer.",
    ],
    berge: [
      "Die Gipfel standen still und groß, als hätten sie auf Besuch gewartet.",
      "Mit jedem Höhenmeter wurde die Luft klarer und die Welt da unten kleiner.",
      "Wolken zogen über die Grate, und die Aussicht gehörte ganz diesem Augenblick.",
      "Der Weg war steil, aber jeder Blick zurück hat sich gelohnt.",
    ],
    natur: [
      "Überall war Grün – in hundert verschiedenen Tönen.",
      "Zwischen Gräsern und Bäumen war kaum mehr zu hören als der Wind.",
      "Die Natur hatte keine Eile, und das war ansteckend.",
      "Ein Weg führte ins Grüne, und niemand fragte, wohin genau.",
    ],
    stadt: [
      "Die Straßen waren voller Geschichten: Fassaden, Schilder, Stimmen.",
      "Zwischen alten Mauern und neuen Ideen gab es an jeder Ecke etwas zu entdecken.",
      "Die Stadt hatte ihren eigenen Rhythmus – schnell, laut und voller Leben.",
      "Jede Gasse versprach eine kleine Überraschung.",
    ],
    unterwegs: [
      "Unterwegs zu sein war an diesem Tag schon das halbe Abenteuer.",
      "Räder, Schienen, Straßen – alles schien in Bewegung.",
      "Die Landschaft zog vorbei wie ein Film ohne Ton.",
    ],
    essen: [
      "Dann wurde es Zeit für eine Pause – und für etwas Gutes auf dem Teller.",
      "Es duftete nach Kaffee, und für einen Moment war alles andere egal.",
      "Manche Erinnerungen schmeckt man noch Jahre später.",
      "Gutes Essen braucht keine großen Worte, nur einen freien Platz am Tisch.",
    ],
    tiere: [
      "Plötzlich gab es einen Star, der keinen Applaus brauchte.",
      "Tiere haben ein Talent dafür, genau im richtigen Moment aufzutauchen.",
      "Ein neugieriger Blick, ein kurzes Innehalten – und schon war das Bild im Kasten.",
    ],
    menschen: [
      "Am schönsten waren die Momente, in denen alle zusammen waren.",
      "Ein Lachen hier, ein Blick dort – die kleinen Dinge machten den Tag.",
      "Die Bilder zeigen vor allem eines: wer dabei war.",
    ],
    feier: [
      "Der Abend wurde laut, bunt und herrlich lang.",
      "Musik, Stimmen, Gläser – die Luft vibrierte.",
      "Solche Abende planen sich nicht, sie passieren einfach.",
    ],
    sport: [
      "Bewegung, frische Luft und ein bisschen Ehrgeiz – mehr brauchte es nicht.",
      "Es wurde gelaufen, geworfen, gepaddelt – und viel gelacht.",
    ],
    zuhause: [
      "Manchmal sind die schönsten Orte die vertrautesten.",
      "Drinnen war es warm und gemütlich, draußen durfte die Welt warten.",
    ],
    himmel: [
      "Der Himmel färbte sich in Orange und Rosa, als hätte jemand Farbe verschüttet.",
      "Die Sonne ließ sich Zeit mit dem Abschied.",
      "Für ein paar Minuten schien alles in goldenes Licht getaucht.",
    ],
    nacht: [
      "Als es dunkel wurde, gingen überall die Lichter an.",
      "Die Nacht hatte ihre eigene Farbe – und ihren eigenen Klang.",
      "Lichter spiegelten sich, und die Welt wirkte leiser als am Tag.",
    ],
    winter: [
      "Schnee dämpfte jedes Geräusch, und alles war weiß und still.",
      "Die Kälte biss in die Nase, aber die Aussicht war es wert.",
    ],
    dokumente: [
      "Auch das gehört dazu: Notizen, Bildschirme und kleine Merkzettel des Alltags.",
      "Nicht jedes Bild ist schön – manche sind einfach nützlich.",
    ],
    sonstiges: [
      "Manche Momente passen in keine Schublade, und gerade das macht sie besonders.",
      "Es war einer dieser Augenblicke, die man festhalten will, ohne genau zu wissen, warum.",
    ],
  },
  maerchen: {
    strand: [
      "Das Meer flüsterte Geschichten, die älter waren als jede Burg aus Sand.",
      "Die Wellen brachten Muscheln und Geheimnisse an den Strand.",
    ],
    berge: [
      "Die Berge, so erzählt man, waren einst Riesen, die sich zum Schlafen hingelegt hatten.",
      "Hoch oben, wo die Wolken wohnen, war der Weg steil und die Aussicht wundersam.",
    ],
    natur: [
      "Im Grünen wohnten, wer weiß, vielleicht Feen – jedenfalls roch es nach Moos und Abenteuer.",
      "Die Bäume raunten einander zu, dass Besuch gekommen war.",
    ],
    stadt: [
      "Die Stadt war groß wie ein Königreich, mit Türmen, Toren und tausend Fenstern.",
      "In den Gassen der Stadt wartete hinter jeder Ecke ein neues Wunder.",
    ],
    unterwegs: [
      "Die Reise führte über Straßen und Schienen, weiter, als die Karte reichte.",
      "Ein treues Gefährt trug die Reisenden immer weiter in die Welt hinaus.",
    ],
    essen: [
      "Es gab ein Festmahl, das eines Königs würdig gewesen wäre.",
      "Auf dem Tisch standen Köstlichkeiten, wie man sie sonst nur aus alten Sagen kennt.",
    ],
    tiere: [
      "Ein tierischer Begleiter zeigte sich, klug und ein wenig frech.",
      "Die Tiere des Landes kamen neugierig näher, um die Fremden zu begrüßen.",
    ],
    menschen: [
      "Die Gefährten hielten zusammen, wie es sich für eine gute Geschichte gehört.",
      "Freundschaft, so heißt es, ist der wertvollste Schatz jeder Reise.",
    ],
    feier: [
      "Im Saal des Abends wurde gesungen und getanzt, bis die Kerzen kleiner wurden.",
      "Es wurde ein Fest gefeiert, von dem man noch lange erzählen sollte.",
    ],
    sport: ["Es galt, Prüfungen zu bestehen: laufen, springen, werfen – und niemals aufgeben."],
    zuhause: ["In der warmen Stube war es sicher und gemütlich."],
    himmel: [
      "Am Abend malte ein unsichtbarer Maler den Himmel golden und rosa.",
      "Die Sonne verabschiedete sich mit einem prächtigen Mantel aus Licht.",
    ],
    nacht: [
      "Als die Nacht kam, zündeten Sterne und Laternen um die Wette ihre Lichter an.",
      "In der Dunkelheit erwachte eine Welt voller funkelnder Lichter.",
    ],
    winter: ["Frau Holle hatte ihre Kissen kräftig geschüttelt, und die Welt lag unter einer weißen Decke."],
    dokumente: ["Auch alte Schriften und geheimnisvolle Tafeln wurden sorgsam festgehalten."],
    sonstiges: ["Und manches, was geschah, lässt sich nur in Bildern erzählen."],
  },
  tagebuch: {
    strand: [
      "Ich hatte Sand in den Schuhen und keine Lust, ihn auszuschütteln.",
      "Ich könnte stundenlang aufs Wasser schauen, und genau das habe ich getan.",
    ],
    berge: [
      "Meine Beine brennen noch, aber der Ausblick von oben war jeden Schritt wert.",
      "Da oben habe ich einfach nur geatmet und geschaut.",
    ],
    natur: [
      "Ich habe mir vorgenommen, öfter einfach nur ins Grüne zu schauen.",
      "So viel Grün, so wenig Lärm – genau das habe ich gebraucht.",
    ],
    stadt: [
      "Ich bin durch Straßen gelaufen, deren Namen ich schon wieder vergessen habe – die Bilder zum Glück nicht.",
      "An jeder Ecke gab es etwas, das ich fotografieren musste.",
    ],
    unterwegs: [
      "Ich mag diese Stunden zwischen Abfahrt und Ankunft.",
      "Unterwegs sein fühlt sich für mich immer ein bisschen nach Freiheit an.",
    ],
    essen: [
      "Notiz an mich: Dieses Essen muss ich mir merken.",
      "Ich habe viel zu viel gegessen und bereue nichts.",
    ],
    tiere: [
      "Das Tier auf diesem Bild hat mir den Tag versüßt.",
      "Ich musste einfach stehen bleiben und hinschauen.",
    ],
    menschen: [
      "Ich bin froh, dass ich nicht allein war.",
      "Die Gesichter auf diesen Bildern machen mich jedes Mal froh.",
    ],
    feier: [
      "Es war laut, es war spät, und es war genau richtig.",
      "Ich glaube, ich habe noch nie so viel gelacht.",
    ],
    sport: ["Ich war erschöpft, aber auf die gute Art."],
    zuhause: ["Heute war ein Zuhause-Tag, und das war gut so."],
    himmel: [
      "Ich bin stehen geblieben, bis die Sonne ganz weg war.",
      "So einen Himmel sieht man nicht jeden Tag.",
    ],
    nacht: [
      "Nachts wirkte alles anders – leiser und irgendwie größer.",
      "Ich liebe es, wenn die Lichter angehen.",
    ],
    winter: ["Meine Finger waren kalt, das Herz dafür warm."],
    dokumente: ["Ein paar Bildschirmfotos zur Erinnerung – nicht hübsch, aber wichtig."],
    sonstiges: ["Manches wollte ich einfach festhalten."],
  },
};

const OPENINGS: Record<StoryStyle, Record<Daypart, string[]>> = {
  erzaehlung: {
    morgen: ["Der Tag begann früh.", "Am Morgen lag noch Ruhe über allem.", "Die ersten Bilder entstanden, als der Tag noch jung war."],
    mittag: ["Gegen Mittag stand die Sonne hoch.", "Mittags war der Tag in vollem Gange."],
    nachmittag: ["Der Nachmittag gehörte dem Entdecken.", "Am Nachmittag ging es weiter."],
    abend: ["Am Abend wurde das Licht weicher.", "Dann kam der Abend."],
    nacht: ["Spät in der Nacht war der Tag noch lange nicht vorbei.", "Es wurde Nacht, aber an Schlaf dachte noch niemand."],
  },
  maerchen: {
    morgen: ["Als der Morgen graute, ging die Geschichte weiter.", "Mit dem ersten Hahnenschrei begann ein neuer Teil der Reise."],
    mittag: ["Zur Mittagsstunde, als die Schatten am kürzesten waren, geschah etwas Schönes."],
    nachmittag: ["Am Nachmittag führte der Weg weiter ins Unbekannte."],
    abend: ["Als die Sonne sich zur Ruhe legte, begann ein neues Kapitel."],
    nacht: ["Und als es Nacht wurde, erwachte eine ganz andere Welt."],
  },
  tagebuch: {
    morgen: ["Früh aufgestanden – und es hat sich gelohnt.", "Der Morgen war herrlich ruhig."],
    mittag: ["Mittags war es richtig hell.", "Zur Mittagszeit war ich schon mittendrin."],
    nachmittag: ["Am Nachmittag bin ich weitergezogen.", "Der Nachmittag war lang und gut."],
    abend: ["Abends wurde es ruhiger.", "Am Abend habe ich mir Zeit gelassen."],
    nacht: ["Es ist spät, aber ich will noch aufschreiben, wie schön es war.", "Mitten in der Nacht, und ich bin noch hellwach."],
  },
};

const NEW_DAY: Record<StoryStyle, string[]> = {
  erzaehlung: ["Ein neuer Tag begann.", "Am nächsten Tag ging es weiter."],
  maerchen: ["Und als ein neuer Tag anbrach, wartete schon das nächste Abenteuer."],
  tagebuch: ["Neuer Tag, neues Glück.", "Heute ging es weiter."],
};

const HEADINGS: Record<CategoryId, string[]> = {
  strand: ["Salz und Sand", "Wo das Wasser beginnt", "Wellen", "Am Ufer"],
  berge: ["Über den Wolken", "Gipfelblick", "Der steile Weg", "Höhenluft"],
  natur: ["Im Grünen", "Wiesenwege", "Draußen"],
  stadt: ["Gassen und Fassaden", "Stadtrauschen", "Straßenbilder"],
  unterwegs: ["Unterwegs", "Zwischen hier und dort"],
  essen: ["Eine kleine Pause", "Zu Tisch", "Genuss"],
  tiere: ["Tierischer Besuch", "Wilde Begegnung"],
  menschen: ["Gemeinsam", "Gesichter"],
  feier: ["Der lange Abend", "Musik und Stimmen"],
  sport: ["In Bewegung"],
  zuhause: ["Daheim"],
  himmel: ["Goldene Stunde", "Abendrot"],
  nacht: ["Nachtlichter", "Nach Einbruch der Dunkelheit"],
  winter: ["Weiße Stille"],
  dokumente: ["Notizen"],
  sonstiges: ["Zwischendurch", "Ein Augenblick"],
};

const MONTH_OPENINGS: Record<StoryStyle, string[]> = {
  erzaehlung: ["Dann kam der {monat}.", "Der {monat} hatte seine eigenen Farben.", "Im {monat} ging das Jahr in eine neue Runde."],
  maerchen: ["Und dann zog der {monat} ins Land.", "Als der {monat} kam, begann ein neues Kapitel."],
  tagebuch: ["{Monat} – ich blättere zurück und muss lächeln.", "Der {monat} war voller kleiner Dinge."],
};

// ---------------------------------------------------------------------------

export function chapterHeading(facts: ChapterFacts, rng: Random, used: Set<string>): string {
  if (facts.month !== undefined) return monthName(facts.month);
  // Überschrift zum Hauptmotiv; nur wenn die schon vergeben sind, zum nächsten.
  for (const cat of facts.categories) {
    const fresh = (HEADINGS[cat] ?? []).filter((h) => !used.has(h));
    if (fresh.length) {
      const choice = rng.pick(fresh);
      used.add(choice);
      return choice;
    }
  }
  return rng.pick(HEADINGS[facts.categories[0] ?? "sonstiges"] ?? HEADINGS.sonstiges);
}

function sentenceCount(length: StoryLength): number {
  return length === "kurz" ? 2 : length === "mittel" ? 4 : 6;
}

function openingLine(style: StoryStyle, facts: ChapterFacts, rng: Random): string | undefined {
  if (facts.month !== undefined) {
    const m = monthName(facts.month);
    return rng.pick(MONTH_OPENINGS[style]).replace("{monat}", m).replace("{Monat}", m);
  }
  if (facts.start === undefined) return undefined;
  if (facts.index === 0) {
    const weekday = weekdayName(facts.start);
    const month = monthName(new Date(facts.start).getMonth());
    if (style === "maerchen") {
      return `Es war einmal, an einem ${weekday} im ${month}, da machten sich ein paar Reisende auf den Weg.`;
    }
    if (style === "tagebuch") return rng.pick(["Liebes Tagebuch, was für ein Tag!", `Liebes Tagebuch, heute ist ${weekday}, und ich will festhalten, was passiert ist.`]);
    return rng.pick([`Es war ein ${weekday} im ${month}.`, `Alles begann an einem ${weekday} im ${month}.`]);
  }
  if (facts.newDay && rng.chance(0.7)) return rng.pick(NEW_DAY[style]);
  return rng.pick(OPENINGS[style][daypartOf(facts.start)]);
}

function peopleLine(style: StoryStyle, people: number, rng: Random): string | undefined {
  if (people <= 0) return undefined;
  if (people === 1) {
    return {
      erzaehlung: rng.pick(["Auf einem Bild blickt jemand direkt in die Kamera.", "Ein Gesicht erzählt hier mehr als tausend Worte."]),
      maerchen: "Eine Gestalt blickte in die Ferne, als suche sie schon den nächsten Pfad.",
      tagebuch: "Ein Porträt für die Erinnerung.",
    }[style];
  }
  const n = Math.min(people, 12);
  const many = people > 10;
  return {
    erzaehlung: many
      ? "Auf einem Bild drängen sich so viele Menschen, dass man sie kaum zählen kann."
      : `Auf einem Bild sind ${numberWord(n)} Menschen zu sehen – niemand wollte fehlen.`,
    maerchen: many
      ? "Das ganze Volk war zusammengekommen, und jeder hatte etwas zu erzählen."
      : `${capitalize(numberWord(n))} Gefährten standen beisammen, und jeder hatte etwas zu erzählen.`,
    tagebuch: many ? "Wir waren eine richtig große Runde." : `Wir waren ${GROUP_WORDS[n] ?? "viele"}, und es hätte nicht besser sein können.`,
  }[style];
}

function animalLine(style: StoryStyle, animals: string[], rng: Random): string | undefined {
  const name = animals.find((a) => ANIMAL_GENDER[a]);
  if (!name) return undefined;
  const a = withArticle(name)!;
  const A = capitalize(a);
  if (style === "maerchen") return `${A} kreuzte den Weg und sah aus, als wüsste ${pronoun(name)} ein Geheimnis.`;
  if (style === "tagebuch") return `${A} hat heute mein Herz erobert.`;
  return rng.pick([`${A} stahl allen die Schau.`, `Mit dabei: ${a}.`]);
}

function foodLine(style: StoryStyle, foods: string[]): string | undefined {
  const items = [...new Set(foods.filter((f) => LISTABLE_FOOD.has(f)))].slice(0, 2);
  if (items.length === 0) return undefined;
  if (style === "maerchen") return `Es gab ${joinGerman(items)}, und niemand blieb hungrig.`;
  if (style === "tagebuch") return `Auf dem Tisch: ${joinGerman(items)}. Lecker.`;
  return `Auf dem Tisch: ${joinGerman(items)}.`;
}

function lightLine(style: StoryStyle, facts: ChapterFacts, rng: Random): string | undefined {
  const part = facts.start !== undefined ? daypartOf(facts.start) : undefined;
  if (facts.brightness < 0.22) {
    return style === "tagebuch" ? "Es war dunkel, aber überall blitzten Lichter." : "Es war dunkel, doch überall blitzten Lichter auf.";
  }
  const main = facts.categories[0];
  if (main === "himmel" || main === "nacht") return undefined; // Licht ist dort schon Thema
  if (facts.warmth > 0.3 && (part === "abend" || part === "nachmittag")) return "Das Licht wurde weich und golden.";
  if (facts.saturation > 0.45) return rng.pick(["Die Farben leuchteten, als hätte jemand den Regler aufgedreht.", "Alles strahlte in kräftigen Farben."]);
  if (facts.warmth < -0.15) return "Kühle Blautöne bestimmten die Stimmung.";
  return undefined;
}

function colorLine(style: StoryStyle, palette: string[]): string | undefined {
  const names = [...new Set(palette.map(colorName))].filter((n) => n !== "Schwarz").slice(0, 3);
  if (names.length < 2) return undefined;
  if (style === "tagebuch") return `Farben des Tages: ${joinGerman(names)}.`;
  if (style === "maerchen") return `Die Welt trug an diesem Tag ${joinGerman(names)}.`;
  return `Die Farben dieses Kapitels: ${joinGerman(names)}.`;
}

export function chapterText(style: StoryStyle, length: StoryLength, facts: ChapterFacts, rng: Random): string {
  const target = sentenceCount(length);
  const lines: string[] = [];
  const opening = openingLine(style, facts, rng);
  if (opening) lines.push(opening);

  const main = facts.categories[0] ?? "sonstiges";
  const scenes = SCENES[style][main] ?? SCENES.erzaehlung[main] ?? SCENES.erzaehlung.sonstiges!;
  lines.push(rng.pick(scenes));

  const animal = animalLine(style, facts.animals, rng);
  const people = peopleLine(style, facts.people, rng);
  const food = foodLine(style, facts.foods);
  // Zweites Motiv nur, wenn es nicht schon durch einen eigenen Satz vorkommt.
  const covered = new Set<CategoryId>([main]);
  if (animal) covered.add("tiere");
  if (people) covered.add("menschen");
  if (food) covered.add("essen");
  const second = facts.categories.find((c) => !covered.has(c));
  const extras = [
    animal,
    people,
    food,
    second ? rng.pick(SCENES[style][second] ?? SCENES.erzaehlung[second] ?? [""]) : undefined,
    lightLine(style, facts, rng),
    length === "lang" ? colorLine(style, facts.palette) : undefined,
  ].filter((l): l is string => !!l && !lines.includes(l));

  for (const line of extras) {
    if (lines.length >= target) break;
    lines.push(line);
  }
  return lines.join(" ");
}

export function storyTitle(opts: {
  style: StoryStyle;
  kind: "erlebnis" | "kategorie" | "jahr" | "auswahl";
  mainCategory: CategoryId;
  start?: number;
  days: number;
  label: string;
  rng: Random;
}): string {
  const { style, kind, mainCategory, start, days, label, rng } = opts;
  if (kind === "jahr") {
    return style === "maerchen" ? `Das Märchen vom Jahr ${label}` : style === "tagebuch" ? `Mein Jahr ${label}` : `Unser Jahr ${label}`;
  }
  if (kind === "kategorie") {
    return style === "maerchen" ? `Geschichten aus dem Reich: ${label}` : style === "tagebuch" ? `Mein Album: ${label}` : label;
  }
  const place: Partial<Record<CategoryId, string>> = {
    strand: "am Meer",
    berge: "in den Bergen",
    natur: "im Grünen",
    stadt: "in der Stadt",
    winter: "im Schnee",
    zuhause: "zu Hause",
    unterwegs: "unterwegs",
  };
  const where = place[mainCategory];
  const season = start !== undefined ? SEASON_WORD[seasonOf(start)] : undefined;
  const span = days >= 2 ? (days <= 3 && start !== undefined && [5, 6].includes(new Date(start).getDay()) ? "Ein Wochenende" : `${capitalize(numberWord(days))} Tage`) : "Ein Tag";

  if (style === "maerchen") {
    return where ? `Es war einmal ${where}` : "Es war einmal";
  }
  if (style === "tagebuch") {
    return where ? `Tagebuch: ${span} ${where}` : `Tagebuch: ${label}`;
  }
  if (where && season && rng.chance(0.5)) return `${season} ${where}`;
  if (where) return `${span} ${where}`;
  return label;
}

export function closingLine(style: StoryStyle, rng: Random): string {
  return rng.pick(
    {
      erzaehlung: [
        "Und so bleibt von diesen Stunden mehr als ein paar Bilder: ein Gefühl, zu dem man jederzeit zurückkehren kann.",
        "Manche Tage vergehen schnell. Dieser bleibt.",
      ],
      maerchen: ["Und wenn sie nicht gestorben sind, dann erzählen sie noch heute davon."],
      tagebuch: ["Gute Nacht, liebes Tagebuch. Das war ein Tag zum Behalten.", "Ende des Eintrags. Fortsetzung folgt – hoffentlich bald."],
    }[style],
  );
}
