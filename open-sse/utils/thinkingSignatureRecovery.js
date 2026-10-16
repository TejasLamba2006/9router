// One-shot recovery for Anthropic 400 "Invalid signature in thinking block".
// Leaves thinking / redacted_thinking blocks untouched on normal turns so prompt
// caching and latest-turn validation hold; only when Anthropic rejects a signature
// (after a mid-session account or model switch) strips historical thinking blocks
// outside the active tool_use/tool_result chain and retries once.

function isThinkingBlock(block) {
  if (!block || typeof block !== "object") return false;
  return block.type === "thinking" || block.type === "redacted_thinking";
}

function hasBlock(message, type) {
  return (
    !!message &&
    Array.isArray(message.content) &&
    message.content.some((block) => !!block && typeof block === "object" && block.type === type)
  );
}

export function isAnthropicThinkingSignatureError({ provider, status, message } = {}) {
  const isAnthropicTarget =
    provider === "claude" ||
    (typeof provider === "string" && provider.startsWith("anthropic-compatible-"));
  if (!isAnthropicTarget || status !== 400 || typeof message !== "string") return false;
  return /invalid\s+[`'"]?signature[`'"]?\s+in\s+[`'"]?thinking[`'"]?\s+block/i.test(message);
}

export function stripHistoricalThinkingForSignatureRecovery(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  if (!Array.isArray(body.messages)) return body;

  const messages = body.messages;
  const protectedAssistantIndexes = new Set();
  let cursor = messages.length - 1;

  if (cursor >= 0 && messages[cursor]?.role === "assistant" && hasBlock(messages[cursor], "tool_use")) {
    protectedAssistantIndexes.add(cursor);
    cursor -= 1;
  }

  while (cursor >= 0 && messages[cursor]?.role === "user" && hasBlock(messages[cursor], "tool_result")) {
    cursor -= 1;
    while (cursor >= 0 && messages[cursor]?.role !== "assistant") cursor -= 1;
    if (cursor < 0 || !hasBlock(messages[cursor], "tool_use")) break;
    protectedAssistantIndexes.add(cursor);
    cursor -= 1;
  }

  let changed = false;
  const recoveredMessages = messages.map((message, index) => {
    if (!message || message.role !== "assistant" || !Array.isArray(message.content) || protectedAssistantIndexes.has(index)) {
      return message;
    }
    const content = message.content.filter((block) => !isThinkingBlock(block));
    if (content.length === message.content.length) return message;
    changed = true;
    return { ...message, content };
  });

  if (!changed) return body;
  return { ...body, messages: recoveredMessages };
}
