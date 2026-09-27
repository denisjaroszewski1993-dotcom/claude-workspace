# Fotogeschichten

Eine Web-App, die Fotos automatisch **sortiert**, in **Kategorien** und **Erlebnisse** einteilt und daraus **Bildgeschichten** erzählt – als Erzählung, Märchen oder Tagebuch. Alles läuft im Browser, auch auf dem Handy. Die Fotos verlassen das Gerät nicht.

Als **iPhone-App** liest sie zusätzlich die ganze Fotomediathek samt iCloud direkt ein und sortiert die Fotos in echte Alben der Fotos-App – Anleitung in [IOS.md](IOS.md).

## Was die App erkennt

| Merkmal | Woher | Wofür |
|---|---|---|
| Aufnahmedatum und -uhrzeit | EXIF, sonst Dateiname (`IMG_20240714_153012.jpg`, WhatsApp …) | Zeitleiste, Erlebnisse, Tageszeit in Geschichten, Nachtaufnahmen |
| GPS-Position, Kamera | EXIF | Reisen erkennen, Ortsnamen (optional über OpenStreetMap) |
| Motiv (1000 Klassen, z. B. Küste, Pizza, Kirche, Hunderassen) | KI: MobileNet v2 im Browser | Kategorien, Tiere und Speisen in Geschichten |
| Objekte (Personen, Tiere, Fahrzeuge, Tassen …) inkl. Größe im Bild | KI: COCO-SSD im Browser | Menschen/Porträt/Gruppe, Straßenszenen, Feiern |
| Farben, Helligkeit, warmer Himmel, weißer Boden | Pixelanalyse | Abendrot, Nacht, Schnee, Natur, Farbwörter im Text |
| Schärfe | Laplace-Varianz | unscharfe Bilder aussortieren, beste Bilder wählen |
| Doppelte und Serienbilder | Wahrnehmungs-Hash (dHash) | Aufräumen, keine Wiederholungen in Geschichten |
| Bildschirmfotos | PNG ohne Kamera-EXIF + Bildschirmformat | Kategorie „Screenshots & Dokumente“ |

Jede Zuordnung ist **erklärbar**: Im Foto-Detail steht, warum ein Bild in einer Kategorie gelandet ist („Motiv: Küste (54 %)“, „Aufgenommen um 23:41 Uhr“ …). Falsche Zuordnungen lassen sich dort mit einem Tippen korrigieren; die Korrektur merkt sich die App.

## Was die App daraus macht

- **Übersicht** mit 16 Kategorien (Menschen, Tiere, Essen & Trinken, Strand & Meer, Berge, Natur, Stadt & Bauwerke, Unterwegs, Sport & Freizeit, Feste & Abende, Zuhause, Himmel & Abendrot, Nacht & Lichter, Schnee & Winter, Screenshots & Dokumente, Sonstiges)
- **Zeitleiste** nach Jahr und Monat, mit Jahresrückblick per Knopfdruck
- **Erlebnisse und Reisen**: Fotos, die zeitlich zusammengehören; mehrere Tage am selben Ort (fern von zu Hause) werden zur Reise
- **Aufräumen**: doppelte, unscharfe, falsch belichtete Bilder und Screenshots – es wird nichts gelöscht, nur markiert
- **Geschichten**: Die App wählt die besten, möglichst unterschiedlichen Bilder aus, gliedert sie in Kapitel (Tageszeit, Tage oder Monate) und schreibt den Text
  - **Eingebauter Erzähler**: sofort, offline, aus Satzbausteinen, die zu den erkannten Merkmalen passen („Neu würfeln“ für eine andere Fassung)
  - **Claude** (optional): schreibt freier und sieht je Kapitel ein Vorschaubild – auf claude.ai ohne Schlüssel, selbst gehostet mit eigenem API-Schlüssel
  - Lesen, direkt im Text bearbeiten, als **Diashow** abspielen oder als **eigenständige HTML-Datei** speichern und verschicken
- **Sortiert speichern**: Kopien als ZIP oder direkt in einen Ordner (Chrome/Edge am Computer), wahlweise nach Kategorie, Datum oder Erlebnis, mit Übersichtstabelle (`Übersicht.csv`)
- **In Fotos-Alben sortieren** (iPhone-App): Alben wie „Fotogeschichten · Strand und Meer“ direkt in der Fotos-App, ohne Kopien – per Knopfdruck auch wieder entfernbar

## Fotos hineinholen – auch alle auf einmal aus iCloud

„Fotos hinzufügen“ bietet drei Wege; die Tipps im Dialog passen sich dem Gerät an.

| Weg | Wofür | Alle auf einmal |
|---|---|---|
| **Fotomediathek** | einzelne oder viele Fotos, auch aus iCloud | iPhone: Finger auf ein Foto legen und über die Reihen ziehen · Mac: im Auswahlfenster „Fotos“ wählen, ⌘A · Windows: Strg+A |
| **Ganzer Ordner** | alle Bilder eines Ordners samt Unterordnern | ein Klick – auf dem iPhone ab iOS 18.4 aus der Dateien-App |
| **ZIP-Datei** | z. B. ein Download von iCloud.com | wird automatisch ausgepackt |

**Alle iCloud-Fotos am iPhone:** Fotos-App › Album öffnen › *Auswählen* › *Alle auswählen* › Teilen › *In Dateien sichern* › Ordner wählen. Danach in der App *Ganzer Ordner* und genau diesen Ordner öffnen.

**Alle iCloud-Fotos am Computer:** [icloud.com/photos](https://www.icloud.com/photos/) › ⌘A bzw. Strg+A › Download. iCloud packt bis zu 1.000 Fotos in eine ZIP-Datei; die in der App unter *ZIP-Datei* auswählen oder hineinziehen. Mit *iCloud für Windows* einfach den Ordner „iCloud Fotos“ als *Ganzer Ordner* wählen.

Warum im Browser kein direkter Zugriff? Apple bietet Webseiten keine Schnittstelle zur iCloud-Mediathek – das dürfen nur Apps (PhotoKit). Genau das macht die **iPhone-App** ([IOS.md](IOS.md)): Sie liest die ganze Mediathek, einen Zeitraum oder ein Album ohne Auswählen ein, holt Fotos bei Bedarf aus iCloud und nimmt neue Fotos beim Öffnen automatisch mit.

Der ZIP-Leser (`src/lib/zip.ts`) liest nur das Inhaltsverzeichnis und reicht unkomprimiert gespeicherte Fotos als Ausschnitt der ZIP-Datei weiter, ohne sie in den Arbeitsspeicher zu kopieren. ZIP64-Archive über 4 GB werden unterstützt. Bereits bekannte Fotos erkennt die App am Inhalt und überspringt sie – egal, auf welchem Weg sie kommen.

In der Fotoansicht markiert **Auswählen › Alle … auswählen** alle sichtbaren Fotos (auch gefiltert nach Kategorie), um sie z. B. auszusortieren oder daraus eine Geschichte zu machen.

## Starten

Voraussetzung: [Node.js](https://nodejs.org) ab Version 20.

```bash
cd fotogeschichten
npm install
npm run dev        # lädt beim ersten Start die KI-Modelle (ca. 31 MB) nach public/models
```

Dann <http://localhost:5173> öffnen. Beim ersten Besuch zeigt die App Beispielfotos; sobald du eigene Fotos auswählst, verschwinden sie.

Weitere Befehle:

```bash
npm test               # Unit-Tests (Vitest)
npm run typecheck      # TypeScript-Prüfung
npm run build          # fertige App in dist/ – als statische Seite überall hostbar
npm run build:artifact # zusätzlich dist/artifact.html für claude.ai-Artifacts
npm run models         # KI-Modelle neu herunterladen
npm run ios            # iPhone-App bauen und in Xcode öffnen (nur am Mac, siehe IOS.md)
```

`dist/` ist eine rein statische Seite (relative Pfade). Sie läuft auf GitHub Pages, Netlify, einem NAS oder jedem Webserver – ein eigenes Backend braucht die App nicht.

## Datenschutz

- Analyse, KI-Erkennung und der eingebaute Erzähler laufen vollständig im Browser.
- Gespeichert wird nur lokal im Browser: Analyseergebnisse samt kleiner Vorschaubilder (IndexedDB), Korrekturen, Einstellungen und Geschichten (localStorage). „Einstellungen › Alles vergessen“ löscht alles.
- In der iPhone-App liegen zusätzlich die Vorschaubilder (512 px) im App-Ordner. Alben legt die App nur auf Knopfdruck an; Fotos löscht oder verändert sie nie.
- Nur wenn du es einschaltest:
  - **Ortsnamen**: GPS-Koordinaten (ohne Bilder) gehen an OpenStreetMap Nominatim, höchstens eine Anfrage pro Erlebnis.
  - **Claude**: Gliederung, erkannte Motive und je Kapitel ein Vorschaubild (480 px) gehen an Claude. Selbst gehostet wird dein API-Schlüssel nur in deinem Browser gespeichert und direkt an Anthropic gesendet – nur auf eigenen Geräten verwenden.

## Aufbau

```
src/
  lib/                reine Logik, größtenteils getestet
    pixels.ts         Farben, Schärfe, dHash
    metadata.ts       EXIF + Datum aus Dateinamen
    recognition.ts    MobileNet + COCO-SSD (TensorFlow.js)
    imagenet.ts       ImageNet-Klassen -> deutsche Namen + Kategorien
    categorize.ts     Regeln, die alle Signale zu Kategorien verrechnen
    events.ts         Erlebnisse und Reisen
    duplicates.ts     doppelte und Serienbilder
    story.ts          Kapitel bilden, Bilder auswählen
    storyText.ts      eingebauter Erzähler (Satzbausteine, drei Stile)
    claudeWriter.ts   Claude als Erzähler (claude.ai oder API-Schlüssel)
    exporter.ts       ZIP, Ordner-Export, Geschichte als HTML
    zip.ts            Fotos aus ZIP-Dateien lesen (auch ZIP64, ohne Kopie)
    analyze.ts        Analyse-Pipeline + Zwischenspeicher (IndexedDB)
    nativeLibrary.ts  Brücke zum Swift-Modul der iPhone-App (PhotoKit)
    libraryImport.ts  Mediathek-Einträge -> Fotos, automatisches Nachladen
    photoData.ts      Bilddaten aus Datei oder Mediathek
  state/store.tsx     App-Zustand, Warteschlange für die Analyse
  views/, components/ Oberfläche (React)
ios/                  iPhone-App (Capacitor + ios/App/App/PhotoLibraryPlugin.swift)
scripts/
  fetch-models.mjs    legt die Modelle nach public/models
  build-artifact.mjs  Fassung für claude.ai-Artifacts
public/demo/          Beispielfotos (Unsplash-Lizenz) mit erfundenen Daten
```

## Grenzen und Ideen für später

- **HEIC** (iPhone-Standardformat) können nur Safari und neuere Browser öffnen. Beim Auswählen über die Fotomediathek wandelt iOS meist automatisch in JPEG um. Alternativ: iPhone › Einstellungen › Kamera › Formate › „Maximale Kompatibilität“.
- Beim Hochladen aus der iOS-Fotomediathek kann iOS die **GPS-Daten entfernen**; dann gibt es keine Orte und keine Reiseerkennung. Über *In Dateien sichern* + *Ganzer Ordner* bleiben sie erhalten, solange im Teilen-Menü unter *Optionen* der Standort eingeschaltet ist.
- Während der Analyse hält die App den Bildschirm wach (wo der Browser es erlaubt), damit das iPhone große Mengen nicht mittendrin pausiert.
- MobileNet kennt keine Gesichter oder Namen – Personen werden gezählt, nicht erkannt. Das ist Absicht.
- Sehr große Sammlungen (zehntausende Fotos) funktionieren: Raster, Zeitleiste und Erlebnisse laden beim Scrollen nach, die Doppelten-Suche schafft 20.000 Fotos in Sekundenbruchteilen. Die erste Analyse dauert aber je nach Gerät lange (die App zeigt die Restzeit); danach hilft der Zwischenspeicher.
- Mögliche nächste Schritte: Gesichter gruppieren (nur lokal), eine Karte der Aufnahmeorte, Android-App (Capacitor kann das ebenfalls), mehrsprachige Oberfläche.

## Lizenzen

- Beispielfotos: [Unsplash-Lizenz](https://unsplash.com/license), bezogen über [picsum.photos](https://picsum.photos); Fotografinnen und Fotografen stehen in `public/demo/demo.json`. Aufnahmedaten und Orte der Beispiele sind erfunden.
- Modelle: MobileNet v2 und COCO-SSD (TensorFlow, Apache 2.0).
