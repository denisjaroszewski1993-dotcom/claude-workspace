# Chat-Verlauf: Instagram-Verwaltung (22.–29.09.2026)

Zusammengefasste Kopie des Chats zum Einfügen in einen neuen Chat.
Der kie.ai-Schlüssel ist bewusst **nicht** enthalten.

---

## Kontext / Stand

- **Instagram-Konto:** @mobilesaunahamburg, verbunden über Composio (Business-/Creator-Konto)
- **Drive-Ordner:** „Instagram Verwaltung“ (ID `1eTM77GNCF1XC2KGx09vTx5FwtyJhjxah`)
- **Wochenplan:** Google Sheet „Instagram Wochenplan KW40“ (ID `1U7VLAO8Yt5rs3IWSkTx_F1-pchnj1gIvPf7BL42IjkY`)
- **Repo:** `denisjaroszewski1993-dotcom/claude-workspace`, Branch `claude/instagram-verwaltung-wochenplan-ow45c0`
  - `instagram-verwaltung/Instagram_Wochenplan_KW40.csv`: Kopie des Wochenplans
  - `kie-ausgabe/2026-09-28-instagram-papierberg-genehmigt.png`: fertiges KI-Bild für Montag
- **kie.ai:** Schlüssel noch **nicht** dauerhaft als Umgebungsvariable `KIE_API_KEY` hinterlegt.
  Empfehlung: bei kie.ai einen neuen Schlüssel erzeugen, weil der alte im Chat stand, und diesen in den Umgebungseinstellungen von claude.ai/code eintragen.
  Guthaben zuletzt: 872 Credits (ca. 4,36 $).

---

## Wochenplan KW 40 (28.09. – 04.10.2026)

| Datum | Tag | Format | Thema / Idee | Status | Notizen |
|---|---|---|---|---|---|
| 28.09. | Mo | Bild (KI) | Papierberg-Kampf: Person mit Schweißtropfen und Kugelschreiber, riesiger Stapel Formulare, endlich „genehmigt“ | Bild fertig, nicht gepostet | günstig, KI-Bild |
| 30.09. | Mi | Bild | Setup-Foto L-Deluxe am Strand, Text-Overlay: „TÜV hat noch 3 Rückfragen“ | geplant | eigenes Fotomaterial |
| 02.10. | Fr | KI-Video (kurz) | Kurzszene: Beamter genehmigt die Sauna erst nach 5 Formularen (kie.ai, Referenzobjekt L-Deluxe) | geplant | teurer, also kurz halten, max. 1×/Woche |
| 04.10. | So | Text-Post | Community-Frage: „Welches Amt nervt euch am meisten?“ | geplant | |

**Vorgeschlagene Uhrzeiten:** Mo 12 oder 18 Uhr · Mi 18–19 Uhr · Fr 18–20 Uhr · So 18–20 Uhr

---

## Verlauf

1. **Wochenplan aus Drive geladen**, als CSV ins Repo gelegt und gepusht.
2. **KI-Bild für Montag erstellt** (kie.ai, GPT Image 2, 1:1, Kosten ca. 3 Cent).
   Prompt:
   > Humorous illustration: an exhausted person at a desk, sweat drops on the forehead, gripping a ballpoint pen, buried behind a towering stack of filled-out paperwork. On top of the stack, one form with a big red stamp "GENEHMIGT". Warm office lighting, slightly exaggerated cartoon-realistic style, bright colors.

   Ergebnis: Mann hinter einem Papierstapel mit Stempel „GENEHMIGT“, dazu eine Tasse „Noch ein bisschen…“ und ein Zettel „Du schaffst das!“.
3. **Beste Posting-Zeiten (allgemeine Studien):**
   - Di–Do am stärksten, Samstag am schwächsten, Sonntagabend gut
   - Bilder und Karussells: morgens 7–9 Uhr, mittags 11–13 Uhr
   - Reels: abends 18–21 Uhr
   - Wichtiger als die Studien: die eigenen Insights unter Profil → Insights → Zielgruppe → „Aktivste Zeiten“
4. **Was über die Schnittstelle (Composio) geht:**
   - Möglich: Feed-Bilder, Karussells, Reels, Stories (Bild/Video, 9:16)
   - Nicht möglich: Sticker (Umfrage, Link, Musik), zeitgesteuertes Planen direkt bei Instagram (dafür setze ich eine Erinnerung zur Uhrzeit), reine Text-Posts (werden als Grafik umgesetzt)
5. **Links in Stories:** Link-Sticker gehen nur über die App. Die Varianten:
   - (1) Ich baue die Grafik mit Markierung, du postest sie und setzt den Link-Sticker selbst (empfohlen)
   - (2) „Link in Bio“
   - (3) Story-Highlights
6. **Folge 1 „Das Amt ruft an“:** Das Video liegt im Drive, die empfohlene Fassung ist `2026-09-24-folge-1-das-amt-ruft-an-FINAL.mp4` (ID `1Nm6UszHnSHVv_f4f6mt8jGkTlCcyNIQw`, 22 MB). Ältere Fassung: `…-v1.mp4`.
   Plan: Am 28.09. um 17:00 Uhr als Reel posten, auch im Feed. Das Papierberg-Bild sollte auf Dienstag rutschen.
   Für den Video-Upload fehlte eine Google-Drive-Verbindung in Composio, die nie abgeschlossen wurde. Eine Bildunterschrift war auch noch nicht freigegeben.
   **Der Nutzer hat mit „abbruch“ abgebrochen, es wurde nichts gepostet.**
7. **29.09. (Dienstag), Plan für heute:** Im Wochenplan steht für Dienstag nichts, er wurde seit dem 22.09. nicht geändert.
   Vorschlag: Folge 1 heute um 18 Uhr nachholen, das Papierberg-Bild auf Donnerstag schieben.
8. **Änderungswunsch für Folge 1:** Die Texttafeln (schwarzer Hintergrund mit Text) sollen jeweils **2–3 Sekunden länger** laufen.
   Vorgehen: Das Video laden, die schwarzen Texttafeln automatisch finden, jede Tafel um ca. 2,5 s verlängern (Standbild halten, Ton still weiterlaufen lassen bzw. Musik passend verlängern), dann `…-FINAL-v2.mp4` zur Freigabe zeigen und danach posten.
   Das Schnittwerkzeug ffmpeg ist in der Cloud-Umgebung eingerichtet (per pip `imageio-ffmpeg`).
   **Blocker:** Die Google-Drive-Verbindung in Composio ist nicht aktiv. Sie steht auf „initializing“, weil die Google-Anmeldung („Zulassen“) nicht abgeschlossen wurde. Composio ist nur für Instagram verbunden.
   Lösung: entweder die Composio-Drive-Anmeldung zu Ende führen, oder das Video in Drive für „Jeder mit dem Link“ freigeben und den Link schicken.

---

## Offene Punkte

- [ ] Folge 1: an das Video kommen (Composio-Drive fertig verbinden **oder** Freigabelink), Texttafeln um je ca. 2,5 s verlängern, v2 freigeben lassen, Bildunterschrift entwerfen, posten (Vorschlag: heute 18 Uhr)
- [ ] Papierberg-Bild posten (neuer Termin, Bildunterschrift)
- [ ] Wochenplan in Drive aktualisieren (Status, Uhrzeiten, Folge 1)
- [ ] kie.ai-Schlüssel erneuern und dauerhaft als `KIE_API_KEY` hinterlegen
- [ ] Welche Webseite und welche Produkte sollen in Stories verlinkt werden?
