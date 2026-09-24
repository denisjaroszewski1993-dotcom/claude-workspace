import "dotenv/config";

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.warn(`[config] Warnung: Umgebungsvariable ${name} ist nicht gesetzt.`);
  }
  return value;
}

export const config = {
  port: process.env.PORT || 3000,
  anthropicApiKey: required("ANTHROPIC_API_KEY"),
  claudeModel: process.env.CLAUDE_MODEL || "claude-sonnet-5",
  systemPrompt:
    process.env.SYSTEM_PROMPT || "Du bist ein hilfreicher WhatsApp-Assistent.",
  whatsapp: {
    accessToken: required("WHATSAPP_ACCESS_TOKEN"),
    phoneNumberId: required("WHATSAPP_PHONE_NUMBER_ID"),
    appSecret: required("WHATSAPP_APP_SECRET"),
    verifyToken: required("WHATSAPP_VERIFY_TOKEN"),
    apiVersion: process.env.WHATSAPP_API_VERSION || "v21.0",
  },
};
