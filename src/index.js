import express from "express";
import { config } from "./config.js";
import {
  verifySignature,
  extractIncomingMessage,
  sendTextMessage,
  markMessageAsRead,
} from "./whatsapp.js";
import { getClaudeReply } from "./claude.js";

const app = express();

// Keep the raw body around for HMAC signature verification, while still
// parsing JSON for normal use.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Meta calls this once, synchronously, when you save the webhook config.
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === config.whatsapp.verifyToken) {
    console.log("[webhook] Verifizierung erfolgreich.");
    res.status(200).send(challenge);
  } else {
    console.warn("[webhook] Verifizierung fehlgeschlagen.");
    res.sendStatus(403);
  }
});

// Meta calls this for every message/status update on the subscribed number.
app.post("/webhook", async (req, res) => {
  const signature = req.get("X-Hub-Signature-256");
  if (!verifySignature(req.rawBody, signature)) {
    console.warn("[webhook] Ungueltige Signatur, Anfrage abgelehnt.");
    return res.sendStatus(401);
  }

  // Always ack quickly: Meta retries aggressively if it doesn't get a fast 200.
  res.sendStatus(200);

  const incoming = extractIncomingMessage(req.body);
  if (!incoming || !incoming.text) {
    return; // status callbacks (delivered/read) or unsupported message types
  }

  try {
    await markMessageAsRead(incoming.id);
    const reply = await getClaudeReply(incoming.from, incoming.text);
    await sendTextMessage(incoming.from, reply || "(keine Antwort erhalten)");
  } catch (error) {
    console.error("[webhook] Fehler bei der Verarbeitung:", error);
    try {
      await sendTextMessage(
        incoming.from,
        "Entschuldigung, es gab einen internen Fehler. Bitte versuche es spaeter erneut."
      );
    } catch (sendError) {
      console.error("[webhook] Konnte Fehlermeldung nicht senden:", sendError);
    }
  }
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(config.port, () => {
  console.log(`WhatsApp-Claude-Bridge laeuft auf Port ${config.port}`);
});
