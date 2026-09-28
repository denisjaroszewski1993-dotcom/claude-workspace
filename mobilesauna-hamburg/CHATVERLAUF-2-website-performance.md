# Chatverlauf 2: Website-Performance mobilesauna-hamburg.de
Fortsetzung von „Website Professionalisierung“ · Branch `claude/unvollendete-aufgabe-qdnxi9`
Repo: `denisjaroszewski1993-dotcom/claude-workspace`, Ordner `mobilesauna-hamburg/`

> **Für den nächsten Chat:** Diese Datei zuerst lesen. Der WordPress-Connector heißt **„www.mobilesauna-hamburg.de“** (Easy MCP AI). Der doppelte Connector „MobileSauna-Hamburg“ ist defekt und kann gelöscht werden.

---

## 1. Ausgangslage
PageSpeed Insights (Mobil) vorher: **Performance 73**, LCP **8,9 s**, Barrierefreiheit 94, Best Practices 100, SEO 92.

**Technik der Seite:**
- WordPress 7.1.1 auf IONOS, Theme „Hello Elementor Child – MobileSauna Hamburg“.
- Elementor 3.31.2 und Elementor Pro 3.25.5.
- WP Booking System Premium mit Add-ons, All in One SEO.
- Plugins „Performance“ (IONOS-Seitencache), „Disable Updates“ (aktiv, siehe offene Punkte) und Asset CleanUp (neu).
- Startseite = Seite **1001**, Elementor-Kit = Post 194.

## 2. Chronologie
1. **Connector lief.** Die Startseite hat einen Hero-Bereich, dessen Bild als CSS-Hintergrund eingebunden war. Das war die vermutete LCP-Ursache.
2. **Runde 1 (Hero):**
   - Das Hintergrundbild durch ein echtes `<img>` in einem HTML-Widget ersetzt (`a7c1e90`), mit `fetchpriority="high"`.
   - Das Bild liegt jetzt als WebP vor (640/960/1600 px), das Verlauf-Overlay ist per CSS nachgebaut.
   - Alt-Texte für die Medien 2023, 2031, 2033 und 2037 gesetzt.
   - Die Überzeilen von h6 auf `<p>` umgestellt, die Sterne-Zeilen von h5 auf `<div>`.
3. **Runde 2:** Für das Handy einen Hochformat-Zuschnitt per `<picture>` ergänzt (`hero-home-mobil-480/800.webp`, 19 bzw. 42 KB).
4. **Denis meldet: laut PageSpeed nicht besser (LCP 9,1–9,5 s).** Die lokale Lighthouse-Messung zeigte 3,1 s, bildete die Bedingungen von PageSpeed aber nicht ab. Den vollständigen PageSpeed-Bericht habe ich dann per **Firecrawl** ausgelesen, weil die PageSpeed-API ihr Tageslimit erreicht hatte.
   - **Ursache:** Das Startbild war nach etwa 1 s geladen, wurde aber erst nach etwa 2,5 s gezeichnet, weil rund 20 CSS/JS-Dateien das Rendern blockieren.
   - PageSpeed simuliert und rechnet alles ein, was bis zu diesem Zeitpunkt fertig lädt. Das waren Google Tag Manager und Google-Tag (~300 KiB), 3 Kartenbilder als JPG ohne Lazy Loading (~300 KiB) und moment.js (94 KiB).
5. **Runde 3:**
   - Die 4 Kartenbilder zu HTML-Widgets mit `loading="lazy"` umgebaut, als 4:3-WebP in 480/800 px (Medien 2085–2092).
   - Button „KAUFEN“ als Umriss-Button (Kontrastfehler behoben).
   - Der Hero-Container bekommt `id="content"`, damit der Sprunglink „Zum Inhalt wechseln“ ein Ziel hat.
   - Meta-Beschreibung über den Seitenauszug gesetzt (All in One SEO übernimmt ihn).
   - **Ergebnis:** Performance 87–93, LCP 2,2–2,4 s, Barrierefreiheit 98, SEO 100.
6. **Site Kit:** Es band das Google-Tag GT-WKPQTCGS direkt ein **und** über den GTM-Container GTM-K8RQDK26, also doppelt. Außerdem liefen Analytics und Google Ads **ohne Cookie-Banner**. Denis nutzt Ads und Analytics derzeit nicht, später aber bestimmt. **Empfehlung:** deaktivieren, nicht löschen.
7. **Denis hat umgesetzt:**
   - Site Kit deaktiviert ✅
   - Elementor → Google Fonts deaktiviert ✅
   - Asset CleanUp installiert, aber **ohne gespeicherte Regel** ❌
8. **IONOS-Cache-Befund:** Das Plugin „Performance“ lieferte echten Browsern (Anfragen mit `Accept: text/html`) und PageSpeed noch Kopien von *vor* den Änderungen aus (Stempel `Generated @ 23.09.2026 20:44:46`).
   - Geleert, indem ich die Startseite ohne Änderung neu gespeichert habe. Das leert den **gesamten** Cache.
   - **Danach:** Performance **94**, TBT **0 ms** (vorher 410), LCP 2,7 s, Barrierefreiheit 98, Best Practices 100, SEO 100.

## 3. Aktueller Stand (PageSpeed Mobil)
| | Vorher | Jetzt |
|---|---|---|
| Performance | 73 | 89–94 |
| LCP | 8,9–9,5 s | 2,2–2,7 s |
| TBT | 150–410 ms | 0 ms |
| Barrierefreiheit | 94 | 98 |
| SEO | 92 | 100 |
| Best Practices | 100 | 100 |

## 4. Offene Punkte (nächster Chat)
1. **Asset CleanUp einrichten.** Die Buchungsdateien laden auf allen Seiten, die Kalender gibt es aber nur auf `/buchung-cube-l/`, `/buchung-cube-m/`, `/buchung-cube-s/` und `/buchung-whirlpool/` (Seiten-IDs 1005–1008).
   - Unter Asset CleanUp → Settings: **Test Mode aus**.
   - Unter Asset CleanUp → CSS & JS Manager → **Homepage**: bei diesen Einträgen „Unload on this page“ wählen und dann „Update“ tippen.
     - CSS: `wpbs-style`, `wpbs-style-form`, `wpbs-cntrct-style`, `wpbs-stripe-front-end-style`
     - JS: `wpbs-momentjs`, `wpbs-script`, `wpbs-cntrct-script`, `wpbs-cntrct-signature-pad`, `wpbs-inv-script`, `jquery-ui-core`, `jquery-ui-datepicker`
   - **Nicht anfassen:** `jquery-core`, `jquery-migrate` und alles mit elementor oder hello im Namen. Die 4 Kalenderseiten nicht bearbeiten.
   - Danach: IONOS-Cache leeren (Startseite neu speichern), die Kalender auf den 4 Seiten prüfen und PageSpeed messen.
2. **Nach jeder Plugin- oder Einstellungsänderung den IONOS-Cache leeren.**
3. **Plugin „Disable Updates“ ist aktiv.** WordPress und die Plugins bekommen keine Sicherheitsupdates mehr, das ist ein Risiko.
4. **Wenn Ads oder Analytics wieder genutzt werden:**
   - Zuerst einen Cookie-Banner einrichten, der die Skripte erst nach Zustimmung lädt.
   - Dann Site Kit wieder aktivieren.
   - Nur **einen** Weg zum Einbinden nutzen: Google-Tag *oder* GTM.
5. Optional:
   - `<main>`-Element fehlt (Theme-Vorlage, einzige offene Barrierefreiheits-Prüfung).
   - WebP-Dateien und Schriften haben keinen Cache-Header.
   - Die Vermietungs-Karten sind durch verschachtelte Container etwas eingerückt (war schon vorher so).

## 5. Technische Hinweise für die Arbeit per Connector
- Elementor-Daten schreibt man über `wp_update_post_meta` (post_type `pages`, Key `_elementor_data`, kompletter JSON-String). Danach die Meta-Felder `_elementor_element_cache` und `_elementor_css` löschen, damit Elementor neu erzeugt.
- Neu speichern mit `wp_update_page`, auch ohne Änderung: löst den Neuaufbau aus und leert den IONOS-Cache komplett.
- Bilder hochladen: Datei ins öffentliche Repo committen und dann `wp_upload_media_from_url` mit der raw.githubusercontent-URL aufrufen.
- PageSpeed messen: Firecrawl-Scrape von `https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fmobilesauna-hamburg.de%2F&form_factor=mobile` mit `waitFor: 60000`.
- Cache-Stand prüfen: Seite mit Browser-Headern abrufen (`Accept: text/html…`) und nach `Generated @` suchen.

## 6. Dateien im Repo (`mobilesauna-hamburg/`)
| Datei | Inhalt |
|---|---|
| `AENDERUNGEN-2026-09-23.md` | Ausführliches Änderungsprotokoll aller Runden, mit Rückgängig-Anleitung |
| `backup-startseite-1001-elementor_data-2026-09-23.json` | **Backup** der Startseite *vor* allen Änderungen |
| `startseite-1001-elementor_data-aktuell.json` | Aktueller Elementor-Stand der Startseite |
| `assets/hero-home-640/960/1600.webp` | Hero Desktop (Medien 2079–2081) |
| `assets/hero-home-mobil-480/800.webp` | Hero Handy (Medien 2083–2084) |
| `assets/*-4x3-480/800.webp` | Kartenbilder Innen-, Außen-, Mobile-Sauna und Whirlpool (Medien 2085–2092) |
| `CHATVERLAUF-2-website-performance.md` | Diese Datei |

Online: https://github.com/denisjaroszewski1993-dotcom/claude-workspace/tree/claude/unvollendete-aufgabe-qdnxi9/mobilesauna-hamburg
