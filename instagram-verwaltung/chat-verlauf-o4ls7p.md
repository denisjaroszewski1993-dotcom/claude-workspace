# Chat-Verlauf: Instagram-Verwaltung @mobilesaunahamburg (22.–29.09.2026)

Kopie des Chats (Branch `claude/instagram-verwaltung-o4ls7p`, PR #3) zum Weitermachen in einem neuen Chat.
Die Nachrichten sind in Reihenfolge wiedergegeben. Technische Zwischenschritte von Claude sind zusammengefasst, alle Texte, Entscheidungen und IDs sind vollständig. Der kie.ai-Schlüssel ist bewusst **nicht** enthalten.

---

## So startest du den neuen Chat

Neuen Chat in der Umgebung **„Insta“** mit dem Repo `denisjaroszewski1993-dotcom/claude-workspace` öffnen und schreiben:

> Lies `instagram-verwaltung/chat-verlauf-o4ls7p.md` und `instagram-verwaltung/STATUS.md` auf dem Branch `claude/instagram-verwaltung-o4ls7p` und mach dort weiter. Als Erstes: Reel „Folge 1“ veröffentlichen (ist freigegeben).

Vorher auf claude.ai unter Einstellungen → Konnektoren **Composio** und **Claude Code Remote** neu verbinden (beide Anmeldungen waren am 29.09. abgelaufen).

---

## Sofort zu erledigen

1. **Reel „Folge 1 – Das Amt ruft an“ veröffentlichen. Denis hat Video und Text freigegeben („Du darfst es jetzt posten“, 29.09.).**
   - Video: `video/2026-09-29-folge-1-das-amt-ruft-an-v2.mp4` (47,7 s, 1080×1920)
   - Öffentliche URL: `https://raw.githubusercontent.com/denisjaroszewski1993-dotcom/claude-workspace/claude/instagram-verwaltung-o4ls7p/video/2026-09-29-folge-1-das-amt-ruft-an-v2.mp4`
   - Container `18071108354724900` wurde am 29.09. um ca. 14:25 UTC angelegt (24 h gültig). Veröffentlichen mit `INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH` (ig_user_id `me`, creation_id `18071108354724900`, max_wait_seconds 300). Ist er abgelaufen: neu anlegen mit `INSTAGRAM_POST_IG_USER_MEDIA` (media_type REELS, share_to_feed true, video_url wie oben, Caption unten).
   - Vorher mit `INSTAGRAM_GET_IG_USER_MEDIA` prüfen, ob es nicht doch schon online ist.
   - Freigegebene Bildunterschrift:
     ```
     Tag 3 ohne Fernwärme … und das Amt ruft an. 📞🥶

     Folge 1 unserer Serie „Das Amt ruft an“.

     Warten Sie nicht, bis die Politik reagiert. Unsere Saunen heizen auch ohne Netz. 🔥

     🛠️ Saunabau & Verkauf bundesweit, für Privat & Gewerbe
     🚚 Auch zur Miete: mobile Sauna & Whirlpool
     📩 Beratung per DM oder 0157 736 323 19
     🌐 www.mobilesauna-hamburg.de

     #sauna #saunabau #mobilesauna #gartensauna #fernwärme #winter #vorsorge #satire #dasamtruftan #hamburg #saunaliebe
     ```
2. Die alten Erinnerungen aus diesem Chat laufen hier weiter (siehe unten). Im neuen Chat neu setzen und die alten löschen, sonst meldet sich zusätzlich dieser Chat.

---

## Regeln von Denis

- **Jeden Beitrag vorher zeigen, erst nach OK posten.**
- Schwerpunkt **Sauna**. Reihenfolge: **Bau & Verkauf zuerst**, Vermietung zuletzt. Whirlpool nur am Rande.
- **Bundesweit**, für **Privat & Gewerbe**.
- KI-Videos: vorher Kosten nennen, max. 1 pro Woche.
- Denis ist kein Techniker: einfach erklären, Schritt für Schritt.

---

## Verlauf

### 22.09. – Einstieg
- **Denis:** „Kannst du meinen Instagram verwalten?“
- Claude hat die Composio-Verbindung zu **@mobilesaunahamburg** (Business) geprüft: 1.505 Follower, 432 gefolgt, 32 Beiträge, letzter Post 23.05.2026. Am besten lief bis dahin das Umbau-Reel „Vom Schuppen zur Wellness-Oase“ (21 Likes, 4 Kommentare). Claude hat erklärt, was geht (Posten, Kommentare, DMs, Statistiken) und was nicht (Bio/Profil ändern, Planen direkt bei Instagram, Musik, Story teilen).
- **Denis:** „Im Google Drive ist ein Plan, dem bitte folgen.“
- Plan gefunden: Sheet **„Instagram Wochenplan KW40“** (ID `1U7VLAO8Yt5rs3IWSkTx_F1-pchnj1gIvPf7BL42IjkY`) im Drive-Ordner **„Instagram Verwaltung“** (ID `1eTM77GNCF1XC2KGx09vTx5FwtyJhjxah`). Inhalt:
  - Mo 28.09.: KI-Bild „Papierberg-Kampf … endlich genehmigt“
  - Mi 30.09.: Foto L-Deluxe am Strand, Overlay „TÜV hat noch 3 Rückfragen“
  - Fr 02.10.: KI-Video „Beamter genehmigt die Sauna erst nach 5 Formularen“ (Referenz L-Deluxe)
  - So 04.10.: Text-Post / Community-Frage „Welches Amt nervt euch am meisten?“
- Claude hat Entwürfe für alle vier Beiträge geschrieben. Hinweis: Reine Text-Posts gibt es nicht, deshalb wird der Sonntag eine Grafik.
- **Denis:** „Jedes Mal vorher nochmal sehen.“ → Erinnerungen für 28.09., 30.09., 02.10. und 04.10. jeweils um 9 Uhr gesetzt.
- **kie.ai-Schlüssel:** Denis hat ihn in den Einstellungen der Umgebung „Insta“ als `KIE_API_KEY` eingetragen. In einer Test-Sitzung ging er (872 Credits ≈ 4,36 $).
- Frage zu Hashtags usw.: Claude beachtet bei jedem Post Hashtags (8–12, gemischt lokal/Nische/breit), Aufhänger in der ersten Zeile, Aufruf zum Handeln, 4:5 im Feed bzw. 9:16 bei Reels, Alt-Text, Titelbild, Kommentare prüfen.

### 23./24.09. – Papierberg vorgezogen und gepostet
- **Denis:** Den Wochenplan vorziehen und das Papierberg-Bild heute posten, für Montag etwas Neues finden.
- KI-Bild erzeugt (GPT Image 2, 4:5, 6 Credits): `kie-ausgabe/2026-09-23-papierberg-genehmigt.jpg`.
- **Gepostet am 24.09.:** https://www.instagram.com/p/DdrJBJ9EUBW/ (Text mit Hashtags und Alt-Text).
- Die Status-Zelle im Sheet konnte nicht geändert werden, weil Google Sheets nicht in Composio verbunden war.

### 26.09. – Profil
- Das Profil (Bio, Name, Bild, Kategorie, Highlights) kann nur Denis in der App ändern. Die Schnittstelle lässt das nicht zu.
- **DM-Fragen-Buttons eingerichtet und geprüft:**
  1. Was kostet eine eigene Sauna?
  2. Baut ihr auch eine Sauna nach Maß?
  3. Welche Modelle habt ihr?
  4. Kann ich Sauna oder Whirlpool mieten?
- **Freigegebene neue Bio** (149 Zeichen, Denis muss sie selbst eintragen, am 28.09. noch nicht übernommen):
  ```
  🛠️ Saunabau & Verkauf bundesweit
  🔥 Saunen für Privat & Gewerbe
  🚚 Mobile Sauna & Whirlpool Vermietung
  📞 0157 736 323 19
  🌐 www.mobilesauna-hamburg.de
  ```
- Alte Bio: „MobileSauna-Hamburg / Vermietung | Bau | Verkauf / Tel. 015773632319 / www.mobilesauna-hamburg.de“
- Vorschlag für Story-Highlights: Saunabau · Modelle & Preise · Umbauten · Kunden · Miete. Kategorie: „Sauna“.
- **Login am Computer:** Denis ist privat als deniso_lacertus angemeldet. Mit „mobilesaunahamburg“ landet er im privaten Konto. Am Firmenkonto ist noch eine **alte GMX-Adresse ohne Zugriff** hinterlegt.
  Lösung: Am Handy im Firmenkonto → Kontenübersicht → Persönliche Informationen → Kontaktinformationen → neue E-Mail (und Handynummer) hinzufügen, die alte löschen. Danach unter Passwort und Sicherheit ein eigenes Passwort setzen, bei Bedarf über „Passwort vergessen“ an die neue Adresse. Anschließend am Computer über ☰ → Konten wechseln → „Bei einem bestehenden Konto anmelden“ einloggen und das Login speichern. Danach 2-Faktor-Schutz empfohlen. Ob Denis das erledigt hat, ist offen.

### 28.09. – Montag
- Kommentare unter dem Papierberg-Post: 2× „Send me this post“ von Spam-Accounts (wellnesshealth_vibe, germanyvibe___). Empfehlung: nicht antworten, ausblenden.
- Neues KI-Bild für Montag: **„Montag vs. Feierabend“** (links Büro mit Aktenbergen „MONTAG“, rechts eigene Gartensauna „FEIERABEND“): `kie-ausgabe/2026-09-28-montag-vs-feierabend.jpg`. Entwurf:
  ```
  Montag: Papierberg. Feierabend: Aufguss. 🔥

  Stell dir vor, dein Feierabend beginnt 20 Schritte hinter deiner Haustür, in deiner eigenen Sauna.

  🛠️ Wir bauen und verkaufen Saunen bundesweit: Mobil-, Garten- und Innensaunen, für Privat & Gewerbe.
  💰 Eigene Sauna ab 5.900 €
  🚚 Lieber erst testen? Auch zur Miete.

  📩 Schreib uns per DM oder ruf an: 0157 736 323 19
  🌐 www.mobilesauna-hamburg.de

  #sauna #gartensauna #saunabau #saunakaufen #eigenesauna #aussensauna #mobilesauna #wellness #feierabend #montag #saunazeit #saunaliebe
  ```
  Alt-Text: „Geteiltes Bild: links ein gestresster Mann im Büro zwischen Aktenstapeln, Überschrift ‚MONTAG‘. Rechts derselbe Mann entspannt in einer beleuchteten Holzsauna mit Glasfront im Garten bei Sonnenuntergang, Überschrift ‚FEIERABEND‘.“
- **Denis:** Auf nächsten Montag (05.10.) verschieben. Die Erinnerung ist gesetzt.
- kie.ai-Guthaben am 28.09.: 601,5 Credits (≈ 3 $). Rund 260 Credits wurden vermutlich in einem anderen Chat für ein Video verbraucht.
- **Denis:** „Übernimm alle Informationen aus claude/instagram-verwaltung-wochenplan-ow45c0.“ → übernommen nach `instagram-verwaltung/chat-verlauf-wochenplan-ow45c0.md`, Gesamtübersicht in `instagram-verwaltung/STATUS.md`. Hinweise aus dem Chat: Der kie.ai-Schlüssel stand dort einmal im Chat, also sollte er erneuert werden. Posting-Zeiten: Reels 18–21 Uhr, Bilder 7–9 oder 11–13 Uhr.
- **Denis:** Das Video „Folge 1“ soll morgen um 17:00 Uhr raus, die Texte sollen länger stehen. Das Foto L-Deluxe ist für Mittwoch eingeplant.
- Google-Drive- und Google-Sheets-Verbindung in Composio: Die erste Drive-Verbindung hatte zu wenig Rechte (Häkchen nicht gesetzt) und wurde gelöscht. Neue Links wurden verschickt, **beide Verbindungen waren am 29.09. noch nicht aktiv.**
- **Denis:** „Du sollst dauerhaft alle Verbindungen und Befugnisse haben.“ Die Regel „vorher zeigen“ bleibt, solange Denis nichts anderes sagt.

### 29.09. – Reel Folge 1
- Denis hat das Video direkt in den Chat hochgeladen (`2026-09-24-folge-1-das-amt-ruft-an-FINAL.mp4`, 38,1 s).
- Inhalt: Bundestag-Sondersitzung → „Tag 3 ohne Fernwärme“, ein frierender Beamter telefoniert → der Saunabauer telefoniert entspannt in der Werkstatt → Beamte stehen Schlange vor rauchenden Sauna-Anhängern, „Mobile Sauna Hamburg heizt auch ohne Netz.“ → Schlusstext auf Schwarz.
- **Bearbeitung (v2, 47,7 s):** Der Ton ist ab 29,5 s still, deshalb wurden nur die Schlussbilder verlängert:
  - „Warten Sie nicht, bis die Politik reagiert.“ allein: ca. 1 s → ca. 2,5 s
  - mit „Nehmen Sie Ihre Vorsorge für den Winter selbst in die Hand und schaffen Sie sich eine Sauna an.“: ca. 2 s → **ca. 8,5 s**
  - www.mobilesauna-hamburg.de: ca. 3 s → ca. 5,5 s
- Denis: „Ja das passt alles“ (Text), dann nach dem Ansehen: **„Du darfst es jetzt posten.“**
- Der Container wurde angelegt, das Veröffentlichen scheiterte: **Composio-Anmeldung abgelaufen**, Claude Code Remote ebenfalls. → Denis will in einem neuen Chat weitermachen.

---

## Weitere Planung

| Datum | Beitrag | Status |
|---|---|---|
| 30.09. (Mi) | Foto L-Deluxe am Strand + „TÜV HAT NOCH 3 RÜCKFRAGEN“ | **Foto fehlt noch**, Denis soll es in den Drive-Ordner legen |
| 02.10. (Fr) | KI-Video Beamter / 5 Formulare (Kling Standard, 5 s, 9:16, ca. 0,35 $) | Kosten-OK nötig. Ggf. entbehrlich, weil Folge 1 schon ein Video ist, mit Denis klären |
| 04.10. (So) | Frage-Grafik „Welches Amt nervt euch am meisten? 👇“ | geplant |
| 05.10. (Mo) | „Montag vs. Feierabend“ | Bild + Text fertig, vorher nochmal zeigen |

Entwürfe:
- **Mi:** „Die Sauna steht, das Meer rauscht, der Aufguss ist bereit. Und der TÜV? Hat noch drei Rückfragen. 🙃 …“ Den Schluss auf Bau & Verkauf ausrichten (eigene Sauna ab 5.900 €, Miete als Zusatz).
- **Fr (Video-Prompt):** „A stern civil servant at a cluttered desk stamps five forms one after another, then slams a big stamp and finally smiles, a wooden mobile sauna trailer visible through the window, comedic, warm light, 9:16“
- **So:** „Ehrliche Frage an euch: Welches Amt hat euch schon mal den letzten Nerv geraubt? Ab in die Kommentare! 👇 #hamburg #bürokratie #mobilesauna #community“

## Erinnerungen in diesem Chat (IDs zum Löschen)

- `trig_01C78CSY7reJRH5VffRUtkAE`: 30.09., 9 Uhr, Mittwochsbeitrag
- `trig_01YPFK5Qt8oG6Z7UcxWkhYPL`: 02.10., 9 Uhr, Freitagsvideo
- `trig_01KpndYnVzbBvz49eYd5yuez`: 04.10., 9 Uhr, Sonntagsgrafik
- `trig_01SYN4R3G1vcsWj2LU7rEjaQ`: 05.10., 9 Uhr, Montag vs. Feierabend
- `trig_01NCDpYEETeHEtpUAeSPvEus`: 29.09., 17 Uhr, Reel Folge 1

## Technisches

- Instagram-Konto-ID: `28563538793279267`
- Bilder/Videos für Instagram: ins Repo pushen und über die raw.githubusercontent.com-URL posten. **Das Repo ist öffentlich.**
- kie.ai: Schlüssel steht in der Umgebung „Insta“ als `KIE_API_KEY`. Bildmodell `gpt-image-2-text-to-image` (aspect_ratio 4:5, resolution 1K). Ergebnisse in `kie-ausgabe/`.
- ffmpeg: `pip install imageio-ffmpeg`, Pfad über `imageio_ffmpeg.get_ffmpeg_exe()`.
- Offen: Google Drive + Sheets in Composio verbinden (dabei alle Häkchen setzen), kie.ai-Schlüssel erneuern, Bio eintragen, E-Mail/Passwort des Firmenkontos klären.
