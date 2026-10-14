/**
 * Helpers for the OpenCode Zen free-tier client fingerprint.
 *
 * Live upstream probes show that free-tier requests must include the lowercase
 * file-search quartet (bash/glob/grep/read). Agent clients such as Claude Code
 * may declare the same tools with different casing, so those case variants must
 * be renamed instead of duplicated. The response side restores the caller's
 * original spelling so downstream clients still recognise their own tool calls.
 */

/** Canonical names required by the upstream free-tier gate. */
export const OPENCODE_FINGERPRINT_TOOLS = ["read", "shell"];

export const OPENCODE_CANONICAL_TOOL_DEFINITIONS = {
  read: {
    description: "Read the contents of a file or directory. Supports text files, images, and PDFs. Images and PDFs are presented directly to the model. Each text line is prefixed by its 1-based line number as <line>: <content>. The prefix is for reference and is not part of the file content. Directory entries are returned one per line. Use offset and limit to read large files or directories in sections. Prefer one larger read over many small slices, and use grep to find specific content in large files.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File or directory to read" },
      },
      required: ["path"],
    },
  },
  shell: {
    description: "Execute a shell command and return its output. Commands run on Windows using pwsh. Quote file paths containing spaces or special characters. Prefer dedicated tools over shell commands when possible. When output is large, the full result is saved to a file and a truncated preview is returned. Rely on automatic truncation unless filtering the output is more useful. Commands accept an optional timeout, background commands have no timeout by default. Background commands return immediately, and you will be notified when they complete.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command string to execute" },
      },
      required: ["command"],
    },
  },
};
const renamedToolNames = new WeakMap();

const KNOWN_FINGERPRINT_MEMBERS = ["read", "shell", "bash", "glob", "grep"];

/** Canonical lowercase name when `name` is a fingerprint member; "" otherwise. */
export function fingerprintToolKey(name) {
  const lower = String(name ?? "").trim().toLowerCase();
  return KNOWN_FINGERPRINT_MEMBERS.includes(lower) ? lower : "";
}

/** Read a tool name from either flat ({name}) or chat ({function:{name}}) shape. */
function toolNameOf(tool) {
  if (!tool || typeof tool !== "object" || Array.isArray(tool)) return "";
  if (typeof tool.name === "string" && tool.name.trim()) return tool.name.trim();
  const fn = tool.function;
  if (fn && typeof fn === "object" && !Array.isArray(fn) && typeof fn.name === "string") {
    return fn.name.trim();
  }
  return "";
}

/**
 * Zen answers 200 only when the exact canonical `read` and `shell` declarations are
 * present (name, description and schema). Client tools are therefore never rewritten
 * into those names: they stay verbatim and the canonical pair is appended next to them.
 * The one exception is a client tool already named exactly `read` or `shell`; it would
 * duplicate the canonical declaration (403), so it is renamed `<name>_client` and the
 * response side maps the name back.
 *
 * @param {Array} tools
 * @returns {{ tools: Array, map: Map<string,string> }} map: sent name -> original name
 */
export function concealFingerprintToolNames(tools) {
  const map = new Map();
  if (!Array.isArray(tools) || tools.length === 0) return { tools, map };

  const out = tools.map((tool) => {
    if (!tool || typeof tool !== "object" || Array.isArray(tool)) return tool;
    const current = toolNameOf(tool);
    if (!OPENCODE_FINGERPRINT_TOOLS.includes(current)) return tool;
    const renamed = `${current}_client`;
    map.set(renamed, current);
    const fn = tool.function && typeof tool.function === "object" && !Array.isArray(tool.function)
      ? tool.function
      : null;
    return fn ? { ...tool, function: { ...fn, name: renamed } } : { ...tool, name: renamed };
  });
  return { tools: out, map };
}

/** Append only genuinely missing fingerprint declarations. */
export function appendMissingFingerprintTools(tools, flat) {
  const list = Array.isArray(tools) ? tools : [];
  for (const name of OPENCODE_FINGERPRINT_TOOLS) {
    if (list.some((tool) => toolNameOf(tool) === name)) continue;
    const def = OPENCODE_CANONICAL_TOOL_DEFINITIONS[name];
    list.push(flat ? {
      type: "function",
      name,
      description: def.description,
      parameters: def.parameters,
    } : {
      type: "function",
      function: {
        name,
        description: def.description,
        parameters: def.parameters,
      },
    });
  }
  return list;
}

/** Point an explicit tool_choice at the client tool that was renamed out of the way. */
export function retargetToolChoice(body, map) {
  if (!body || typeof body !== "object" || !map?.size) return;
  const choice = body.tool_choice;
  if (!choice || typeof choice !== "object" || Array.isArray(choice)) return;
  const sentNameFor = (original) => [...map].find(([, orig]) => orig === original)?.[0];

  if (typeof choice.name === "string") {
    const sent = sentNameFor(choice.name);
    if (sent) body.tool_choice = { ...choice, name: sent };
    return;
  }
  const fn = choice.function;
  if (fn && typeof fn === "object" && !Array.isArray(fn) && typeof fn.name === "string") {
    const sent = sentNameFor(fn.name);
    if (sent) body.tool_choice = { ...choice, function: { ...fn, name: sent } };
  }
}

/**
 * Full request-side pass: canonicalise quartet case variants, remove duplicate
 * quartet declarations, append missing members and preserve the legacy
 * tool_choice defaults used by the OpenCode executor.
 *
 * @param {object} body
 * @param {boolean} flat - true for Responses tools ({name}), false for chat tools
 * @returns {Map<string,string>} map: sent name -> original name
 */
export function applyFingerprintTools(body, flat) {
  if (!body || typeof body !== "object") return new Map();

  const hadClientTools = Array.isArray(body.tools) && body.tools.length > 0;
  const { tools, map } = concealFingerprintToolNames(body.tools);
  body.tools = appendMissingFingerprintTools(tools, flat);
  retargetToolChoice(body, map);

  // Preserve the existing executor semantics. Responses uses auto when the
  // Free-tier responses API requires tool_choice to be auto when tools are declared.
  // Upstream rejects tool_choice: "none" with FreeTierError (403), so omit tool_choice
  // for chat completions when the client provided no tools.
  if (!body.tool_choice && flat) {
    body.tool_choice = "auto";
  }
  recordRenamedToolNames(body, map);
  return map;
}

/** Store the rename map for `body`. */
export function recordRenamedToolNames(body, map) {
  if (!body || typeof body !== "object" || !map?.size) return;
  renamedToolNames.set(body, map);
}

/** Retrieve the rename map for `body`. */
export function takeRenamedToolNames(body) {
  if (!body || typeof body !== "object") return null;
  return renamedToolNames.get(body) || null;
}

// Response side -------------------------------------------------------------

/** Restore caller tool spellings in supported response/event shapes. */
export function restoreToolNames(payload, map) {
  if (!map?.size || !payload) return payload;
  if (Array.isArray(payload)) return payload.map((item) => restoreToolNames(item, map));
  if (typeof payload !== "object") return payload;

  let out = payload;
  const put = (key, value) => {
    if (out === payload) out = { ...payload };
    out[key] = value;
  };

  // Claude streaming content_block_start event.
  if (payload.type === "content_block_start") {
    const block = payload.content_block;
    if (block?.type === "tool_use" && typeof block.name === "string" && map.has(block.name)) {
      put("content_block", { ...block, name: map.get(block.name) });
    }
  }

  // Claude non-streaming message body.
  if (Array.isArray(payload.content)) {
    put("content", payload.content.map((block) =>
      block?.type === "tool_use" && typeof block.name === "string" && map.has(block.name)
        ? { ...block, name: map.get(block.name) }
        : block));
  }

  // OpenAI Chat Completions, both streaming delta and JSON message shapes.
  if (Array.isArray(payload.choices)) {
    put("choices", payload.choices.map((choice) => {
      let changed = false;
      const next = { ...choice };
      for (const holder of ["delta", "message"]) {
        const value = choice?.[holder];
        if (!value || !Array.isArray(value.tool_calls) || value.tool_calls.length === 0) continue;
        const calls = value.tool_calls.map((call) => {
          const name = call?.function?.name;
          if (typeof name === "string" && map.has(name)) {
            changed = true;
            return { ...call, function: { ...call.function, name: map.get(name) } };
          }
          return call;
        });
        next[holder] = { ...value, tool_calls: calls };
      }
      return changed ? next : choice;
    }));
  }

  // OpenAI Responses final JSON body.
  if (Array.isArray(payload.output)) {
    put("output", payload.output.map((item) =>
      item?.type === "function_call" && typeof item.name === "string" && map.has(item.name)
        ? { ...item, name: map.get(item.name) }
        : item));
  }

  // OpenAI Responses SSE events such as response.output_item.added/done.
  const item = payload.item;
  if (item?.type === "function_call" && typeof item.name === "string" && map.has(item.name)) {
    put("item", { ...item, name: map.get(item.name) });
  }

  return out;
}
