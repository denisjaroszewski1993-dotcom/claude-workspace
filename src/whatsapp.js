import crypto from "node:crypto";
import { config } from "./config.js";

const GRAPH_BASE = "https://graph.facebook.com";

/**
 * Meta signs every webhook body with the app secret. Verifying this before
 * touching req.body stops spoofed requests from reaching Claude or WhatsApp.
 */
export function verifySignature(rawBody, signatureHeader) {
  if (!config.whatsapp.appSecret) return true; // dev fallback, warned about at startup
  if (!signatureHeader) return false;

  const expected = crypto
    .createHmac("sha256", config.whatsapp.appSecret)
    .update(rawBody)
    .digest("hex");
  const provided = signatureHeader.replace("sha256=", "");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function extractIncomingMessage(webhookBody) {
  const value = webhookBody?.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  if (!message) return null;

  const text =
    message.text?.body ??
    message.button?.text ??
    message.interactive?.button_reply?.title ??
    message.interactive?.list_reply?.title ??
    null;

  return {
    from: message.from,
    id: message.id,
    type: message.type,
    text,
  };
}

async function callGraphApi(path, body) {
  const url = `${GRAPH_BASE}/${config.whatsapp.apiVersion}/${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.whatsapp.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`WhatsApp API Fehler (${response.status}): ${errorBody}`);
  }

  return response.json();
}

export function sendTextMessage(to, text) {
  return callGraphApi(`${config.whatsapp.phoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  });
}

export function markMessageAsRead(messageId) {
  return callGraphApi(`${config.whatsapp.phoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    status: "read",
    message_id: messageId,
  });
}
