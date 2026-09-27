# Fotogeschichten als iPhone-App

Dieselbe Oberfläche wie im Browser, aber als echte App mit direktem Zugriff auf die Fotomediathek:

- **Ganze Mediathek ohne Auswählen** – auch Fotos, die nur in iCloud liegen. Wahlweise alles, die letzten 30 Tage, die letzten 12 Monate oder ein einzelnes Album.
- **Von selbst aktuell**: Beim Öffnen der App kommen neue Fotos automatisch dazu.
- **In Fotos-Alben sortieren**: Die App legt in der Fotos-App Alben wie „Fotogeschichten · Strand und Meer“ oder „Fotogeschichten · 2025-07-12 Am Meer“ an – ohne Kopien, sie erscheinen per iCloud auch auf Mac und iPad. „Alben der App entfernen“ löscht nur diese Alben, nie Fotos.
- Aufnahmedatum und Ort kommen direkt aus der Mediathek, Favoriten werden in Geschichten bevorzugt, Bildschirmfotos erkennt iOS selbst.
- Geschichten und Exporte gehen über das normale iOS-Teilen-Menü (AirDrop, Nachrichten, Dateien …).

Alles bleibt auf dem iPhone. Die App speichert nur kleine Vorschaubilder (512 px) und die Analyseergebnisse; „Einstellungen › Alles vergessen“ löscht beides.

## Was du brauchst

- einen **Mac** mit macOS 15.6 (Sequoia) oder neuer
- **Xcode 26** oder neuer (kostenlos im Mac App Store)
- [Node.js](https://nodejs.org) ab Version 20
- ein **iPhone mit iOS 15** oder neuer und ein USB-Kabel
- eine **Apple-ID** – ein kostenloser Account genügt zum Ausprobieren

## Installieren – Schritt für Schritt

1. **Projekt holen und bauen** (im Terminal):

   ```bash
   git clone <Adresse dieses Repositorys>
   cd claude-workspace/fotogeschichten
   npm install
   npm run ios
   ```

   `npm run ios` baut die Web-Oberfläche samt KI-Modellen, kopiert sie ins iOS-Projekt und öffnet Xcode. Beim ersten Öffnen lädt Xcode noch das Capacitor-Paket – unten rechts läuft dann ein Fortschrittsbalken.

2. **Apple-ID in Xcode anmelden**: *Xcode › Settings… › Accounts › +* › Apple ID.

3. **Signieren**: Links im Projektnavigator ganz oben auf **App** klicken, dann unter *Targets* **App** › Reiter **Signing & Capabilities**:
   - *Automatically manage signing* anhaken
   - bei *Team* deine Apple-ID wählen („… (Personal Team)“)
   - Meldet Xcode, dass die *Bundle Identifier* `de.fotogeschichten.app` schon vergeben ist, einen eigenen eintragen, z. B. `de.deinname.fotogeschichten`.

4. **iPhone anschließen**, entsperren und „Diesem Computer vertrauen“ bestätigen. In Xcode oben in der Mitte das iPhone als Ziel wählen.

5. **Entwicklermodus einschalten** (einmalig, ab iOS 16): Beim ersten Versuch fordert das iPhone dazu auf. *Einstellungen › Datenschutz & Sicherheit › Entwicklermodus* einschalten, neu starten, bestätigen.

6. In Xcode auf **▶︎** klicken (oder ⌘R). Xcode baut die App und installiert sie.

7. **Entwickler vertrauen** (einmalig): Startet die App nicht, sondern meldet „Nicht vertrauenswürdiger Entwickler“: *Einstellungen › Allgemein › VPN und Geräteverwaltung* › deine Apple-ID › **Vertrauen**.

8. App öffnen › Zeitraum wählen › **Fotos einlesen**. iOS fragt nach dem Zugriff – **Vollen Zugriff erlauben** wählen, sonst sieht die App nur die Fotos, die du einzeln freigibst.

Die erste Analyse dauert je nach Menge und iPhone eine Weile (grob 0,1–0,5 Sekunden pro Foto; die App zeigt die Restzeit an). Der Bildschirm bleibt dabei an. Danach geht es dank Zwischenspeicher schnell.

## Kostenloser Account: 7 Tage

Mit einer kostenlosen Apple-ID läuft die installierte App **7 Tage**. Danach startet sie nicht mehr – iPhone anschließen und in Xcode wieder **▶︎** drücken, dann läuft sie weitere 7 Tage. Deine Analysen, Korrekturen und Geschichten bleiben dabei erhalten.

Mit dem **Apple Developer Program** (99 € im Jahr) gilt die Installation ein Jahr, und du kannst die App über **TestFlight** an Familie und Freunde verteilen (Xcode: *Product › Archive › Distribute App › TestFlight*). Für den App Store bräuchte es zusätzlich eine Datenschutzerklärung und Store-Texte.

## Nach Änderungen am Code

```bash
npm run ios:sync   # baut die Oberfläche neu und kopiert sie ins iOS-Projekt
```

Dann in Xcode **▶︎**. Nur wer Swift-Dateien in `ios/` ändert, braucht das nicht – Xcode baut die selbst neu.

**Ohne iPhone ausprobieren:** In Xcode statt des iPhones einen Simulator wählen (z. B. „iPhone 17“). Eigene Fotos per Drag-and-drop ins Simulatorfenster ziehen – sie landen in dessen Fotos-App.

**Im Browser entwickeln:** `npm run dev` und <http://localhost:5173/?mediathek-demo> öffnen. Dann spielt eine nachgebildete Mediathek aus den Beispielfotos das iPhone; mit `?mediathek-demo=2000` werden es 2.000 Fotos, um große Sammlungen zu testen.

## Wenn etwas hakt

| Meldung | Lösung |
|---|---|
| *Failed to register bundle identifier* | Schritt 3: eigene Bundle Identifier eintragen |
| *No such module 'Capacitor'* | warten, bis Xcode die Pakete geladen hat; sonst *File › Packages › Reset Package Caches* |
| *Untrusted Developer* / *Nicht vertrauenswürdiger Entwickler* | Schritt 7 |
| *Developer Mode disabled* | Schritt 5 |
| App startet nach einer Woche nicht mehr | kostenloser Account – in Xcode erneut ▶︎ |
| Keine Motiverkennung („KI-Erkennung konnte nicht geladen werden“) | `npm run models`, dann `npm run ios:sync` |
| Fotos aus iCloud bleiben hängen | Das iPhone braucht Internet, um sie zu laden. Bei „iPhone-Speicher optimieren“ liegen die Originale nur in iCloud; die App lädt davon nur ein kleines Vorschaubild. |
| Nur ein Teil der Fotos erscheint | Zugriff ist auf ausgewählte Fotos beschränkt: im Mediathek-Kasten „Alle Fotos erlauben“ oder *Einstellungen › Apps › Fotogeschichten › Fotos › Voller Zugriff* |
| Ein Fehler im Swift-Code | In Xcode links den Issue Navigator (⌘5) öffnen und die rote Meldung kopieren. |

## Aufbau

```
capacitor.config.ts                  App-Name, Bundle-ID, Web-Ordner (dist/)
ios/App/App/
  PhotoLibraryPlugin.swift           Swift-Modul „PhotoLibrary“ (PhotoKit):
                                     Zugriff, Alben, Fotos seitenweise, Vorschaubilder
                                     (inkl. iCloud-Download), Alben anlegen/entfernen,
                                     Teilen, Bildschirm wach halten
  MainViewController.swift           meldet das Modul bei Capacitor an
  Info.plist                         Texte für die Zugriffsabfragen (deutsch)
src/lib/
  nativeLibrary.ts                   TypeScript-Seite des Moduls
  nativeLibraryDemo.ts               nachgebildete Mediathek für den Browser (?mediathek-demo)
  libraryImport.ts                   Mediathek-Einträge → Fotos, gemerkte Bereiche, Nachladen
  photoData.ts                       Bilddaten – aus Datei oder aus der Mediathek
```

Das Swift-Modul lädt nie ganze Originale in die Oberfläche: Für Analyse und Raster erzeugt es 512-px-Vorschaubilder auf dem Gerät (Ordner *Application Support/Fotogeschichten/Vorschau*), größere Fassungen für Foto-Detail, Diashow und Geschichten legt es im Cache ab, den iOS bei Platzmangel selbst leert. Die Originale bleiben unangetastet in der Mediathek.
