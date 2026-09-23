# mobilesauna-hamburg.de – Performance-Fixes Startseite (23.09.2026)

Grundlage: PageSpeed Insights (Mobil) – Performance 73, LCP 8,9 s.

## Umgesetzt (über den WP-Connector, Seite 1001 „Startseite“)
1. **Hero-Bild (LCP):** CSS-Hintergrundbild (erst nach dem CSS entdeckt) ersetzt durch ein echtes `<img>`
   in einem HTML-Widget (`a7c1e90`, Klasse `msh-hero-media`) mit `fetchpriority="high"`, `loading="eager"`,
   `srcset` in WebP (640/960/1600 px, 25 / 50 / 131 KB statt 255-KB-JPG). Verlauf-Overlay per CSS nachgebaut.
   Neue Medien-IDs: 2079, 2080, 2081.
2. **Karten-Bilder:** Bildgröße `full` → `large`; sie beanspruchen nicht mehr `fetchpriority="high"`.
3. **Barrierefreiheit:** Alt-Texte für die Medien 2023, 2031, 2033, 2037 gesetzt; Überzeilen (h6) → `<p>`,
   Sterne-Zeilen (h5) → `<div>` (korrekte Überschriften-Reihenfolge, Optik unverändert über `msh-overline`).
4. Elementor-Cache (`_elementor_element_cache`, `_elementor_css`) geleert → CSS neu erzeugt.

Geprüft: Live-HTML enthält das neue Hero-`<img>`; LCP-Element im Browser ist jetzt das Hero-Bild;
Screenshots Mobil/Desktop optisch wie vorher.

## Nachbesserung (gleicher Tag)
- Hero auf dem Handy: eigener Hochformat-Zuschnitt per `<picture>` (Medien 2083/2084, 19 bzw. 42 KB)
  statt des 131-KB-Querformats.
- Lighthouse (Mobil, lokal gemessen): Score 72 → 80–83, LCP 4,1 s → 3,1–3,2 s (PSI-Ausgangswert: 8,9 s).
  Der verbleibende Engpass ist die späte erste Darstellung (FCP ≈ 2,8 s) durch die ladeblockierenden CSS/JS-Dateien (siehe unten).

## Runde 3 (abends): Ursache für „LCP 9 s trotz schnellem Startbild“ gefunden
PageSpeed-Bericht (per Firecrawl ausgelesen): Das Startbild war nach ~1 s geladen, wurde aber erst ~1,5 s später
gezeichnet (Element render delay), weil ~20 CSS/JS-Dateien das Rendern blockieren. PageSpeed (Lantern-Simulation)
rechnet alles, was bis dahin fertig lädt, in den LCP ein: Google Tag Manager + Google-Tag (~300 KiB),
die drei ohne Verzögerung geladenen Kartenbilder (JPG, ~300 KiB) und moment.js (94 KiB).

Umgesetzt:
- **Kartenbilder:** 4 Bild-Widgets → HTML-Widgets mit `<img loading="lazy">`, 4:3-WebP (480/800 px, Medien 2085–2092),
  passendes `sizes`. Whirlpool 285 → 130 KiB, Mobile-Sauna 139 → 56 KiB usw.; sie laden erst nach dem Startbild.
- **Button „KAUFEN“:** Elementors Standardregel (Akzent-Gold als Hintergrund) überschrieb den im Theme vorgesehenen
  Umriss-Stil → weiße Schrift auf Gold (Kontrastfehler). Jetzt am Widget: transparent, goldener Rand, helle Schrift,
  Hover gold gefüllt (wie `.msh-btn-outline` im Child-Theme vorgesehen).
- **Sprunglink „Zum Inhalt wechseln“:** Ziel `#content` fehlte → Startbereich hat jetzt `id="content"`.
- **Meta-Beschreibung:** Seitenauszug gesetzt (AIOSEO nutzt ihn als description/og:description):
  „Mobile Sauna & Whirlpool in Hamburg mieten: online buchen, liefern lassen oder selbst abholen. Außerdem Innen- und
  Außensaunen kaufen – Ihr Wellness-Profi.“

Ergebnis PageSpeed Mobil (Lighthouse 13.5, Google-Server):
| | vorher | danach |
|---|---|---|
| Performance | 73 | 87–93 |
| LCP | 8,7–9,5 s | 2,3–2,4 s |
| FCP | 1,4–3,0 s | 1,2–1,4 s |
| Barrierefreiheit | 92–94 | 98 |
| SEO | 92 | (Meta-Beschreibung ergänzt – einzige offene SEO-Prüfung) |

## Noch offen (nur im WordPress-Backend möglich)
1. **Google-Tag doppelt:** Site Kit bindet GT-WKPQTCGS direkt ein UND über den GTM-Container GTM-K8RQDK26
   → ~190 KiB doppelt, vermutlich doppelte Seitenaufrufe in Analytics. In Site Kit „Google-Tag platzieren“ aus,
   sofern der GTM-Container das Google-Tag auf allen Seiten auslöst (in GTM prüfen). Größter Hebel für TBT.
2. **Buchungs-Dateien auf der Startseite** (4 CSS, moment.js, jQuery UI, Signature Pad …) per „Asset CleanUp“ nur auf /buchung/ laden.
3. **Elementor → Einstellungen → Erweitert → Google Fonts: deaktivieren** – die Schrift lädt das Child-Theme bereits selbst
   (derzeit doppelt: +1 blockierende CSS-Datei, +27 KiB).
4. **Seiten-Cache + Cache-Header** (IONOS Performance bzw. WP Fastest Cache); WebP/Fonts haben derzeit keinen Cache-Header.
5. **`<main>`-Element** fehlt (Theme-Vorlage, einzige offene Barrierefreiheits-Prüfung) – Anpassung im Child-Theme nötig.

## Rückgängig machen
`backup-startseite-1001-elementor_data-2026-09-23.json` wieder als `_elementor_data` der Seite 1001 speichern
und den Elementor-Cache leeren (Elementor → Tools → „Dateien & Daten neu generieren“).

## Noch offen (mit dem Connector nicht möglich – braucht wp-admin / Plugin)
- Render-blockierende Ressourcen: WP-Booking-System-Skripte (jQuery UI, moment.js, Signature Pad …) und -CSS
  laden auf jeder Seite, auch der Startseite. Lösung: z. B. Plugin „Asset CleanUp“/„Perfmatters“ und diese Dateien
  nur auf /buchung/ laden; JS mit `defer`.
- Cache-Lebensdauer für CSS/JS/Fonts verlängern (IONOS Performance / .htaccess).
- Veraltetes JS / erzwungener Reflow: stammen aus Plugin-Skripten (jQuery Migrate, Booking-System).
