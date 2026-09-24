import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

const MAX_HISTORY_MESSAGES = 20;

// In-memory only: history is lost on restart and never shared across
// instances. Swap for a real store (Redis, a DB table) before scaling past
// a single process or needing durability.
const conversations = new Map();

function getHistory(phoneNumber) {
  if (!conversations.has(phoneNumber)) {
    conversations.set(phoneNumber, []);
  }
  return conversations.get(phoneNumber);
}

export async function getClaudeReply(phoneNumber, incomingText) {
  const history = getHistory(phoneNumber);

  history.push({ role: "user", content: incomingText });

  const response = await anthropic.messages.create({
    model: config.claudeModel,
    max_tokens: 1024,
    system: config.systemPrompt,
    messages: history,
  });

  const replyText = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  history.push({ role: "assistant", content: replyText });

  while (history.length > MAX_HISTORY_MESSAGES) {
    history.shift();
  }

  return replyText;
}
