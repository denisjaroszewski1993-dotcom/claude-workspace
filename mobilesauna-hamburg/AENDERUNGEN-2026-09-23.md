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

## Rückgängig machen
`backup-startseite-1001-elementor_data-2026-09-23.json` wieder als `_elementor_data` der Seite 1001 speichern
und den Elementor-Cache leeren (Elementor → Tools → „Dateien & Daten neu generieren“).

## Noch offen (mit dem Connector nicht möglich – braucht wp-admin / Plugin)
- Render-blockierende Ressourcen: WP-Booking-System-Skripte (jQuery UI, moment.js, Signature Pad …) und -CSS
  laden auf jeder Seite, auch der Startseite. Lösung: z. B. Plugin „Asset CleanUp“/„Perfmatters“ und diese Dateien
  nur auf /buchung/ laden; JS mit `defer`.
- Cache-Lebensdauer für CSS/JS/Fonts verlängern (IONOS Performance / .htaccess).
- Veraltetes JS / erzwungener Reflow: stammen aus Plugin-Skripten (jQuery Migrate, Booking-System).
