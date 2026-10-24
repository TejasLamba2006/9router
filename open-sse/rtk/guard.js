// Protected-tools guard shared by RTK and Headroom: never shorten output that
// Edit-style tools need verbatim (line numbers, exact strings) or error traces.
export const PROTECTED_TOOLS = new Set([
  "read", "read_file", "view", "edit", "multi_edit", "multiedit", "write", "write_file",
  "notebookedit", "notebook_edit", "grep", "patch", "apply_patch", "anchor",
]);

export function normalizeToolName(name) {
  let n = String(name || "").trim().toLowerCase();
  const m = n.match(/^mcp__.*__(.+)$/);
  if (m) n = m[1];
  return n.replace(/_client$/, "");
}

export function isProtectedToolName(name) {
  return PROTECTED_TOOLS.has(normalizeToolName(name));
}

// toolCallId -> toolName across OpenAI, Claude and Responses shapes
export function buildToolNameMap(body) {
  const map = new Map();
  const items = Array.isArray(body?.messages) ? body.messages : Array.isArray(body?.input) ? body.input : [];
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    if (it.role === "assistant" && Array.isArray(it.tool_calls)) {
      for (const tc of it.tool_calls) {
        const name = tc?.function?.name || tc?.name;
        if (tc?.id && name) map.set(tc.id, name);
      }
    }
    if (Array.isArray(it.content)) {
      for (const b of it.content) {
        if (b?.type === "tool_use" && b.id && b.name) map.set(b.id, b.name);
      }
    }
    if ((it.type === "function_call" || it.type === "custom_tool_call") && it.name) {
      const id = it.call_id || it.id;
      if (id) map.set(id, it.name);
    }
  }
  return map;
}

const isErrFlag = (o) => o?.is_error === true || o?.isError === true || o?.status === "error";

function textOf(c) {
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((p) => (typeof p?.text === "string" ? p.text : "")).join("");
  return "";
}

// Error flag, JSON {"error":...} body, or non-zero "Exit code N" prefix
export function isErrorContent(content) {
  const t = textOf(content).trimStart();
  if (/^\{\s*"error"\s*:/.test(t)) return true;
  const m = t.match(/^Exit code (\d+)/);
  return !!m && m[1] !== "0";
}

// True when this tool result must be left verbatim. `holder` is the result
// message/block/item, `id` its call id, `content` its payload.
export function shouldSkipResult(holder, id, content, names) {
  return isErrFlag(holder) || isErrorContent(content) || isProtectedToolName(names.get(id));
}

function resultIdOf(o) {
  return o.tool_call_id || o.tool_use_id || o.call_id || o.id;
}

// Visit every tool result in body: fn(holder, key, id) where holder[key] is the payload.
export function forEachToolResult(body, fn) {
  const items = Array.isArray(body?.messages) ? body.messages : Array.isArray(body?.input) ? body.input : [];
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    if (it.type === "function_call_output" || it.type === "custom_tool_call_output") fn(it, "output", resultIdOf(it));
    else if (it.role === "tool") fn(it, "content", resultIdOf(it));
    else if (Array.isArray(it.content)) {
      for (const b of it.content) if (b?.type === "tool_result") fn(b, "content", resultIdOf(b), it);
    }
  }
}
