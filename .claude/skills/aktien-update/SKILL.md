---
name: aktien-update
description: Täglicher Kursbericht zu Denis' Beobachtungsliste (aktien/watchlist.md). Holt aktuelle Kurse, meldet welche Aktie gefallen ist, prüft Kauf- und Verkaufsalarme, schreibt den Bericht nach aktien/berichte/ und pusht ihn. Aufrufen bei "Aktien-Update", "tägliches Update", "welche Aktie ist gefallen", "Kursbericht" oder vom täglichen Zeitplan.
---

# Aktien-Update

Ziel: Denis handelt aktiv auf Trade Republic. Er verkauft in Kurssprünge hinein und
kauft nach Rücksetzern zurück. Der Bericht sagt ihm auf einen Blick, welche Aktie
gefallen ist und ob eine Einstiegszone erreicht wurde.

## Ablauf

1. **Watchlist lesen:** `aktien/watchlist.md`. Die Tabelle unter „Übersicht“ ist die
   Quelle: Aktie, ISIN, Status, Referenzkurs, Alarm unter, Alarm über.
2. **Kurse holen** für jede Aktie in der Tabelle. Werkzeuge in dieser Reihenfolge:
   WebFetch, dann `curl -sL` mit Text-Extraktion, Firecrawl nur falls verfügbar.
   Bevorzugte Quelle: `https://www.finanzen.net/aktien/<name>-aktie` (Xetra-Tab via
   `@stBoerse_XETRA`), alternativ `https://www.comdirect.de/inf/aktien/<ISIN>`,
   `https://www.boerse.de/aktien/<Name>-Aktie/<ISIN>` oder die IR-Seite der Firma
   (OHB: https://www.ohb.de/kursinformationen). Pro Aktie brauchst du:
   letzter Kurs mit Uhrzeit, Vortagesschluss, Tagestief, Tageshoch, Veränderung in %.
   Suche nach Nachrichten der letzten 24 Stunden nur, wenn sich eine Aktie um mehr als
   4 % bewegt hat oder ein Alarm ausgelöst wurde.
3. **Auswerten** pro Aktie:
   - Veränderung zum Vortag in %.
   - Abstand zum Referenzkurs in % (Referenzkurs = Kurs am Tag des letzten Verkaufs
     bzw. Kaufs, steht in der Tabelle).
   - **Kaufalarm:** letzter Kurs oder Tagestief liegt auf oder unter „Alarm unter“.
   - **Verkaufsalarm:** bei Positionen im Depot, Kurs auf oder über „Alarm über“.
   - **Warnung:** Kurs unter dem in der Watchlist notierten Tief (z. B. 6-Monats-Tief),
     dann ist der Rücksetzer kein Rücksetzer mehr, sondern ein Trendbruch.
4. **Bericht schreiben** nach `aktien/berichte/JJJJ-MM-TT.md` in diesem Format:

   ```
   # Aktien-Update TT.MM.JJJJ

   ## Alarme
   - (Liste der ausgelösten Kauf-/Verkaufsalarme, oder „keine“)

   ## Gefallen
   | Aktie | Kurs | Vortag | Tag % | zu Referenz % | Hinweis |

   ## Gestiegen
   | Aktie | Kurs | Vortag | Tag % | zu Referenz % | Hinweis |

   ## Termine der nächsten 14 Tage
   - (Quartalszahlen usw. aus der Watchlist)

   ## Nachrichten
   - (nur bei Bewegungen über 4 % oder Alarm, 1 Satz pro Meldung mit Quelle)
   ```
   Sortiere „Gefallen“ nach Tagesverlust absteigend. Zahlen mit Komma, EUR.
5. **Watchlist pflegen:** Datum in „Stand:“ aktualisieren. Referenzkurse und Alarme
   nur ändern, wenn Denis es sagt. Neue Tiefs/Hochs im Abschnitt der Aktie nachtragen.
6. **Commit und Push:** Bericht und Watchlist committen (`git push origin HEAD:main`,
   weil die Sitzung oft mit detached HEAD startet). Commit-Text:
   `Aktien-Update TT.MM.JJJJ`.
7. **Antwort an Denis:** Die Alarme zuerst, dann die Tabelle „Gefallen“, dann in zwei
   Sätzen das Wichtigste. Norddeutsch locker, kein Fachgeschwafel. Keine Anlageberatung,
   nur Fakten und die in der Watchlist festgelegten Zonen.

## Regeln

- Wenn das Repo nicht im Arbeitsverzeichnis liegt (frische Sitzung aus dem Zeitplan):
  mit `add_repo` (owner `denisjaroszewski1993-dotcom`, repo `claude-workspace`) anbinden
  und klonen, dann weiter wie oben.
- Kurse immer mit Uhrzeit und Börsenplatz angeben. Morgens vor 9 Uhr ist der
  Xetra-Vortagesschluss der relevante Kurs, Tradegate/LS Exchange liefern vorbörsliche Kurse.
- Wenn eine Quelle nicht erreichbar ist, eine andere nehmen. Wenn gar kein Kurs zu
  bekommen ist, das im Bericht klar sagen, nicht schätzen.
- Keine Käufe oder Verkäufe auslösen, das macht Denis selbst in Trade Republic.
- Neue Aktien, die Denis nennt, in die Tabelle und als eigenen Abschnitt in die
  Watchlist aufnehmen (Referenzkurs = Kurs am Tag der Aufnahme, Alarm unter = minus 5 %,
  Alarm über = plus 7 %, sofern Denis nichts anderes sagt). Käufe und Verkäufe nach
  `aktien/trades.md` eintragen.
