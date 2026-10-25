# Instagram und Facebook parallel posten

Stand: 25.10.2026. Jeder Beitrag für Mobile Sauna Hamburg geht gleichzeitig und
identisch auf Instagram und Facebook: gleiches Bild/Video, gleicher Text, gleiche
Hashtags, gleiche KI-Kennzeichnung.

## Konten

| Plattform | Konto | ID | Verbindung |
|---|---|---|---|
| Instagram | @mobilesaunahamburg | ig_user_id `28563538793279267` (Windsor: `17841451746978781`) | Composio `instagram` |
| Facebook | Seite „Mobilesauna-Hamburg“ | page_id `103980968875536` | Composio `facebook` (Konto `facebook_spor-circle`, Rechte: CREATE_CONTENT) |

Nicht verwechseln: Fun-Vermietung hat eigene Konten (Instagram @funvermietung,
Facebook-Seite `105186882636721`). Die nur nehmen, wenn Denis das ausdrücklich sagt.

## Feste Regeln

1. **Erst nach „Ja, posten“ von Denis.** Ein „Ja“ gilt für beide Plattformen
   zusammen. Soll ein Beitrag nur auf eine Plattform, sagt Denis das dazu.
2. **Identischer Inhalt.** Text 1:1 übernehmen, auch Emojis, Hashtags, Telefonnummer
   und den KI-Hinweis („Symbolbild (KI)“, „SATIRE“ usw.). Keine Plattform-Varianten,
   außer Denis will das.
3. **Direkt nacheinander posten**: erst Instagram, dann sofort Facebook.
4. **Ergebnis melden**: beide Links an Denis. Klappt eine Plattform nicht, sofort
   sagen, welche und warum. Nicht stillschweigend nur auf einer posten.
5. **Doppelte vermeiden**: vor dem Posten kurz `FACEBOOK_GET_PAGE_POSTS`
   (page_id oben, `limit` 5) prüfen, ob der Beitrag schon auf Facebook ist.
   Falls in der Meta-App „Auf Facebook teilen“ für Instagram eingeschaltet ist,
   würde jeder Post doppelt erscheinen. Dann entweder das Teilen in der App
   ausschalten oder nur auf Instagram posten.

## Welches Werkzeug für welches Format

Alle Medien müssen als öffentliche HTTPS-URL erreichbar sein (wie bei Instagram:
kie-Upload, 24 h gültig). Bilder als JPEG.

| Format | Instagram (Composio) | Facebook (Composio) |
|---|---|---|
| Einzelbild | `INSTAGRAM_POST_IG_USER_MEDIA` (`image_url`, `caption`) → `INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH` | `FACEBOOK_CREATE_PHOTO_POST` (`page_id`, `url`, `message`) |
| Karussell | `INSTAGRAM_CREATE_CAROUSEL_CONTAINER` → `INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH` | `FACEBOOK_CREATE_MULTI_PHOTO_POST` (`page_id`, `photo_urls` in derselben Reihenfolge, `message`) |
| Reel / Video | `INSTAGRAM_POST_IG_USER_MEDIA` (`video_url`, `media_type: REELS`, `caption`) → `INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH` | `FACEBOOK_CREATE_VIDEO_POST` (`page_id`, `file_url` = dieselbe MP4-URL, `description` = Beschreibungstext) |
| Story | `INSTAGRAM_POST_IG_USER_MEDIA` mit `media_type: STORIES` | kein Gegenstück eingerichtet, nur Instagram |

Hinweise:
- Facebook hat kein echtes Karussell. Der Mehrbild-Post zeigt die Bilder als Raster,
  der Inhalt ist trotzdem derselbe.
- `FACEBOOK_UPLOAD_PHOTOS_BATCH` **nicht** für Karussells nehmen: das erzeugt pro
  Bild einen eigenen Beitrag.
- Facebook kann auch planen (`published: false` + `scheduled_publish_time`,
  Unix-Zeit UTC, mind. 10 Min in der Zukunft). Instagram über die Schnittstelle
  nicht. Für „identisch und parallel“ deshalb beide sofort posten.

## Bisher auf Facebook (Stand 25.10.2026)

07.10. Karussell „5 Fehler beim Saunakauf“ · 08.10. Papierberg · 09.10. Reel
Gartenschuppen → Innensauna · 11.10. Reel „Das Amt ruft an“ · 12.10. Karussell
Dämmsystem vs. Blockbohlen. Seit dem 12.10. kein neuer Beitrag.
