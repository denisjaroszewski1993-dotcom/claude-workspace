# claude-workspace

Webhook-Bridge, die dein **WhatsApp Business Konto** (über die offizielle
Meta WhatsApp Cloud API) mit **Claude** verbindet. Eingehende WhatsApp-
Nachrichten werden an Claude geschickt, die Antwort wird automatisch als
WhatsApp-Nachricht zurückgesendet.

Es gibt (Stand jetzt) keinen fertigen "1-Klick"-Connector für WhatsApp
Business bei Claude — eine echte Anbindung läuft immer über einen eigenen
Webhook-Server wie diesen hier plus deine eigenen API-Zugangsdaten.

## Architektur

```
WhatsApp-Nutzer  →  Meta WhatsApp Cloud API  →  dein Webhook (dieser Server)
                                                        │
                                                        ▼
                                                  Claude API (Anthropic)
                                                        │
                                                        ▼
                                    Meta WhatsApp Cloud API  →  Antwort per WhatsApp
```

## Voraussetzungen

1. **Meta Developer Account & App**
   - Auf https://developers.facebook.com ein Konto anlegen (falls noch nicht vorhanden).
   - Eine neue App vom Typ "Business" erstellen.
   - Das Produkt **WhatsApp** zur App hinzufügen.
2. **WhatsApp Business Konto**
   - Im Meta App Dashboard unter "WhatsApp → API-Setup" wird automatisch eine
     Test-Telefonnummer bereitgestellt, mit der du sofort loslegen kannst.
   - Für den produktiven Einsatz mit deiner echten Geschäftsnummer: dein
     WhatsApp Business Konto (WABA) mit der App verknüpfen und die Nummer
     registrieren (Meta führt dich durch diesen Ablauf im Dashboard).
3. **Zugangsdaten besorgen** (alle im Meta App Dashboard zu finden):
   - `WHATSAPP_ACCESS_TOKEN` — temporäres Token reicht zum Testen (24h
     gültig); für den Dauerbetrieb ein permanentes Token über einen
     System-User unter "Business-Einstellungen → System-User" erzeugen.
   - `WHATSAPP_PHONE_NUMBER_ID` — steht unter "WhatsApp → API-Setup".
   - `WHATSAPP_APP_SECRET` — unter "Einstellungen → Basis".
   - `WHATSAPP_VERIFY_TOKEN` — ein beliebiger, selbst ausgedachter String
     (z. B. per `openssl rand -hex 16`), den du gleich beim Webhook in Meta
     einträgst.
4. **Anthropic API Key**
   - Unter https://console.anthropic.com erstellen → `ANTHROPIC_API_KEY`.
5. **Öffentlich erreichbare HTTPS-URL** für den Webhook. Zum lokalen Testen
   eignet sich z. B. `ngrok http 3000`; für den Dauerbetrieb ein echtes
   Hosting (z. B. ein kleiner VPS, Render, Fly.io, etc.).

## Einrichtung

```bash
npm install
cp .env.example .env
# .env mit deinen echten Werten befüllen
npm start
```

Der Server läuft danach auf `http://localhost:3000` mit zwei Routen:

- `GET /webhook` — für die einmalige Verifizierung durch Meta.
- `POST /webhook` — empfängt eingehende Nachrichten/Status-Updates.
- `GET /health` — einfacher Health-Check.

## Webhook bei Meta registrieren

1. Server öffentlich erreichbar machen, z. B. `ngrok http 3000` → du erhältst
   eine URL wie `https://abcd1234.ngrok.app`.
2. Im Meta App Dashboard: **WhatsApp → Konfiguration → Webhook bearbeiten**.
3. Callback-URL: `https://<deine-domain>/webhook`
4. Verify Token: derselbe Wert wie `WHATSAPP_VERIFY_TOKEN` in deiner `.env`.
5. Auf "Verifizieren und speichern" klicken — Meta ruft `GET /webhook` auf.
6. Unter "Webhook-Felder" das Feld **messages** abonnieren.

Ab jetzt landen eingehende WhatsApp-Nachrichten an deine Nummer als POST-
Request in deinem Server, werden an Claude weitergereicht und die Antwort
geht automatisch per WhatsApp zurück.

## Sicherheit

- Jede eingehende Anfrage wird per HMAC-SHA256 (`X-Hub-Signature-256`,
  signiert mit `WHATSAPP_APP_SECRET`) geprüft, bevor sie verarbeitet wird.
- `.env` liegt in `.gitignore` — niemals Zugangsdaten committen.

## Bekannte Grenzen dieses Starters

- Der Gesprächsverlauf pro Telefonnummer liegt nur im Arbeitsspeicher
  (`src/claude.js`) und geht bei einem Neustart verloren. Für produktiven
  Dauerbetrieb durch einen persistenten Speicher (Redis, Datenbank) ersetzen.
- Es wird nur Text verarbeitet (keine Bilder, Sprachnachrichten, Dokumente).
- Kein Rate-Limiting eingebaut — bei hohem Aufkommen ergänzen.
