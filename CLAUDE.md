# Arbeitsregeln für Claude (Denis Jaroszewski, Mobile Sauna Hamburg)

## E-Mails an Kunden: Absender ist immer info@mobilesauna-hamburg.de

Geschäftliche E-Mails (Kunden, Lieferanten, Versicherung, Vereine) müssen von
**info@mobilesauna-hamburg.de** kommen, niemals von denisjaroszewski1993@gmail.com.

Der angebundene Gmail-Connector kann die Absenderadresse nicht setzen. Er sendet
immer von der Hauptadresse des Kontos (denisjaroszewski1993@gmail.com), auch wenn
info@ in Gmail als Alias eingerichtet ist. Das gilt für `send_message`, `reply`
und `create_draft` gleichermaßen.

Deshalb gilt:

1. Geschäftliche Mails **nicht** direkt mit `send_message` oder `reply` verschicken.
2. Stattdessen mit `create_draft` einen Entwurf im richtigen Thread anlegen
   (`replyToMessageId` setzen, damit die Mail im Thread bleibt).
3. Denis Bescheid geben, dass der Entwurf bereitliegt. Er wählt in Gmail den
   Absender info@mobilesauna-hamburg.de aus und sendet selbst.
4. Direkt senden nur, wenn Denis im Gespräch ausdrücklich sagt, dass die
   Gmail-Adresse als Absender in Ordnung ist.

Hintergrund: Am 14.10.2026 ging eine Antwort an Thomas Lorenzen (KMTV Kiel,
Thema „Defekte Fliesen“) versehentlich von der Gmail-Adresse raus. Das soll
nicht wieder vorkommen.

## Ton in Kunden-Mails

Denis schreibt norddeutsch locker: „Moin“, Du-Form bei bekannten Kunden,
Schluss mit „LG“ oder „Viele Grüße“ und „Denis Jaroszewski“. Vorherige Mails
im Thread lesen und den Ton übernehmen.
