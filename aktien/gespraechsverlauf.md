# Gesprächsverlauf Aktien

Verdichtete Zusammenfassung der Claude-Sitzung „Aktien“. Keine Rohtranskripte.

## 2026-10-14
- Sitzung „Aktien“ angelegt. Thema: Denis' Aktien auf Trade Republic und Beobachtung weiterer Werte.
- **OHB SE** am 14.10. mit ca. +7 % verkauft, mitten in einen Kurssprung von +10 % (Xetra 172,40 EUR um 17:11). Denis erwartet in den nächsten Tagen oder Wochen einen Rücksetzer von 5 bis 7 % oder mehr und will dann wieder kaufen. Alarme: Kauf ab 164 EUR (−5 %), stark ab 160 EUR (−7 %), Warnung unter 155 EUR (6-Monats-Tief), Rücksetzer vom Tisch über 187 EUR. Neunmonatszahlen am 12.11.2026. Streubesitz nur 11,55 %, deshalb extreme Schwankungen. Berenberg Buy, Ziel 358 EUR.
- **Kongsberg Gruppen ASA** am 14.10. zu 28,28 EUR mit +1,86 % verkauft (Position ca. 3.567 EUR, ca. 126 Stück). Denis befürchtet, dass sie weiter steigt. Alarme: Kauf ab 26,90 EUR (−5 %), stark ab 26,30 EUR (−7 %), Meldung über 30,25 EUR (+7 %). Neue ISIN nach Split: NO0013536151.
- **Täglicher Bericht eingerichtet:** Skill `aktien-update` im Repo claude-workspace (`.claude/skills/aktien-update/SKILL.md`). Zeitplan „Aktien-Update täglich“ werktags 07:50 Uhr Europe/Berlin, Push und E-Mail. Berichte landen in `aktien/berichte/JJJJ-MM-TT.md`. Auf Zuruf: „Aktien-Update“. Die Zeitplan-Sitzungen laufen ohne Connectoren, Kurse kommen per WebFetch/curl von finanzen.net.
- Dateien im Repo: `aktien/watchlist.md` (Übersichtstabelle mit Referenzkurs und Alarmen, die der Skill liest), `aktien/trades.md` (Trade-Log), `aktien/README.md`.
- Ablage: Google-Drive-Ordner „Claude - Aktien“. Obsidian-Tools waren in der Cloud-Sitzung nicht erreichbar, Text zum Einfügen im Chat ausgegeben.
- Denis' These: Das Weltraumgeschäft in Europa und vor allem Deutschland boomt, Europa rüstet nach, die Aktien werden in den nächsten Jahren steigen. Recherche zu börsennotierten Weltraum-Firmen und Zulieferern (DE/EU) beauftragt, Ergebnis in `aktien/weltraum-aktien.md`.
- Offen: genauer OHB-Verkaufskurs und Stückzahl fürs Trade-Log; weitere Depotwerte von Denis; Termin der Kongsberg-Q3-Zahlen; erster Zeitplan-Lauf am 15.10. prüfen.
