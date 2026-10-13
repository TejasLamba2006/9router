// Ported from OmniRoute open-sse/services/webSearchFallback.ts (layer 1 of the native
// web_search redirect). Detects built-in server web-search tools (web_search,
// web_search_20250305, web_search_preview, ...) declared by clients like Claude Code and
// replaces them with a plain function tool that 9router executes itself through its /v1
// search providers instead of forwarding a server tool the upstream may not implement.
import { FORMATS } from "../translator/formats.js";
import { PROVIDERS } from "../config/providers.js";

export const NINEROUTER_WEB_SEARCH_FALLBACK_TOOL_NAME = "9router_web_search";
// Prefix match — Anthropic sends date-suffixed variants (web_search_20250305, ...).
const WEB_SEARCH_TOOL_TYPES = /^web_search/;
const SEARCH_CONTEXT_DEFAULTS = { low: 5, medium: 8, high: 10 };

function toRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function isBuiltInWebSearchTool(tool) {
  const toolRecord = toRecord(tool);
  const toolType = typeof toolRecord.type === "string" ? toolRecord.type : "";
  // A custom *function* tool that merely carries a `function` field is not the server tool.
  return WEB_SEARCH_TOOL_TYPES.test(toolType) && !toolRecord.function;
}

function isBuiltInWebSearchToolChoice(toolChoice) {
  const choice = toRecord(toolChoice);
  const toolType = typeof choice.type === "string" ? choice.type : "";
  return WEB_SEARCH_TOOL_TYPES.test(toolType);
}

function searchContextSize(tool) {
  return typeof tool.search_context_size === "string"
    ? tool.search_context_size.trim().toLowerCase()
    : "";
}

function buildFallbackDescription(tool) {
  // Tools with external_web_access:false are never converted (see prepareWebSearchFallbackBody),
  // so the description can always promise the public web.
  const defaultMaxResults =
    SEARCH_CONTEXT_DEFAULTS[searchContextSize(tool)] || SEARCH_CONTEXT_DEFAULTS.medium;
  return [
    "Search the public web for recent, factual information and return cited results.",
    "Use this when the answer depends on current events, external documents, or fresh facts.",
    `If max_results is omitted, prefer about ${defaultMaxResults} results.`,
  ].join(" ");
}

function buildFallbackParameters(tool) {
  const defaultMaxResults =
    SEARCH_CONTEXT_DEFAULTS[searchContextSize(tool)] || SEARCH_CONTEXT_DEFAULTS.medium;
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      query: { type: "string", description: "The web search query to execute." },
      search_type: {
        type: "string",
        enum: ["web", "news"],
        description: "Use 'news' for recent headlines or reporting; otherwise use 'web'.",
      },
      max_results: {
        type: "integer",
        minimum: 1,
        maximum: 20,
        default: defaultMaxResults,
        description: "Maximum number of results to retrieve.",
      },
      country: {
        type: "string",
        description: "Optional 2-letter country code for localization, e.g. US or BR.",
      },
      language: { type: "string", description: "Optional language code such as en or pt-BR." },
      time_range: {
        type: "string",
        enum: ["any", "day", "week", "month", "year"],
        description: "Optional recency filter.",
      },
      filters: {
        type: "object",
        additionalProperties: false,
        properties: {
          include_domains: {
            type: "array",
            items: { type: "string" },
            description: "Optional list of domains to include.",
          },
          exclude_domains: {
            type: "array",
            items: { type: "string" },
            description: "Optional list of domains to exclude.",
          },
        },
      },
    },
    required: ["query"],
  };
}

// This runs on the RAW client body before translation, so the injected tool must be built
// in the CLIENT (source) format shape — 9router translators do not understand server tools.
function buildFallbackTool(tool, sourceFormat) {
  const name = NINEROUTER_WEB_SEARCH_FALLBACK_TOOL_NAME;
  const description = buildFallbackDescription(tool);
  const parameters = buildFallbackParameters(tool);
  if (sourceFormat === FORMATS.CLAUDE) {
    return { name, description, input_schema: parameters };
  }
  // Responses API expects FLAT function tools, Chat Completions NESTED (OmniRoute #2390).
  if (sourceFormat === FORMATS.OPENAI_RESPONSES) {
    return { type: "function", name, description, parameters };
  }
  return { type: "function", function: { name, description, parameters } };
}

function buildToolChoiceReplacement(sourceFormat) {
  const name = NINEROUTER_WEB_SEARCH_FALLBACK_TOOL_NAME;
  if (sourceFormat === FORMATS.CLAUDE) {
    return { type: "tool", name };
  }
  if (sourceFormat === FORMATS.OPENAI_RESPONSES) {
    return { type: "function", name };
  }
  return { type: "function", function: { name } };
}

// True when the upstream natively runs the web_search server tool, so it must be forwarded
// untouched instead of converted to the 9router_web_search fallback.
export function supportsNativeWebSearchFallbackBypass({
  provider,
  sourceFormat,
  targetFormat,
  nativePassthrough,
}) {
  // Native client/provider passthrough (Claude Code -> Anthropic, Codex -> OpenAI): the
  // upstream runs web search itself.
  if (nativePassthrough) return true;
  // Deviation from OmniRoute: NO Gemini bypass — 9router's translator does not map the
  // built-in web_search tool to googleSearch, so Gemini targets get intercepted instead.
  // Claude -> Claude: Anthropic-format upstreams that actually implement typed server
  // tools (Anthropic itself, anthropic-compatible, or providers advertising the
  // claudeSupportedToolTypes quirk) run web_search_20250305 natively. Providers with a
  // Claude-format endpoint but no server-tool support (e.g. MiniMax 400s with error 2013)
  // must get the function fallback instead.
  if (sourceFormat === FORMATS.CLAUDE && targetFormat === FORMATS.CLAUDE) {
    if (provider === "anthropic" || (provider || "").startsWith("anthropic-compatible")) {
      return true;
    }
    const supportedTypes = PROVIDERS[provider]?.quirks?.claudeSupportedToolTypes;
    if (Array.isArray(supportedTypes) && supportedTypes.some((t) => WEB_SEARCH_TOOL_TYPES.test(String(t)))) {
      return true;
    }
    return false;
  }
  return false;
}

// Returns { body, fallback: { enabled, toolName, convertedToolCount} }. When enabled is
// true, `body` carries the rewritten tools/tool_choice and must replace the client body
// before translation; the caller also forces non-streaming so the intercept in
// chatCore/webSearchIntercept.js can rewrite the response.
export function prepareWebSearchFallbackBody(body, options) {
  const disabled = { enabled: false, toolName: null, convertedToolCount: 0 };
  const tools = Array.isArray(body.tools) ? body.tools : null;
  if (!tools || tools.length === 0) return { body, fallback: disabled };

  const builtInSearchTools = tools.filter(isBuiltInWebSearchTool);
  if (builtInSearchTools.length === 0) return { body, fallback: disabled };

  // A tool scoped with external_web_access:false asks for a non-public search; routing it
  // through our external providers would violate that scope, so we leave the request alone.
  if (builtInSearchTools.some((tool) => toRecord(tool).external_web_access === false)) {
    return { body, fallback: disabled };
  }

  if (supportsNativeWebSearchFallbackBypass(options)) return { body, fallback: disabled };

  const toolNames = new Set();
  const preservedTools = tools.filter((tool) => {
    if (isBuiltInWebSearchTool(tool)) return false;
    const toolRecord = toRecord(tool);
    const functionRecord = toRecord(toolRecord.function);
    const name =
      typeof functionRecord.name === "string"
        ? functionRecord.name
        : typeof toolRecord.name === "string"
          ? toolRecord.name
          : "";
    if (name.trim().length > 0) toolNames.add(name.trim());
    return true;
  });

  // The client already owns our reserved tool name: converting anyway would make the
  // interceptor execute the client's own tool calls as searches. Skip conversion entirely.
  if (toolNames.has(NINEROUTER_WEB_SEARCH_FALLBACK_TOOL_NAME)) {
    return { body, fallback: disabled };
  }
  preservedTools.unshift(buildFallbackTool(toRecord(builtInSearchTools[0]), options.sourceFormat));

  const nextBody = { ...body, tools: preservedTools };
  if (isBuiltInWebSearchToolChoice(body.tool_choice)) {
    nextBody.tool_choice = buildToolChoiceReplacement(options.sourceFormat);
  }

  return {
    body: nextBody,
    fallback: {
      enabled: true,
      toolName: NINEROUTER_WEB_SEARCH_FALLBACK_TOOL_NAME,
      convertedToolCount: builtInSearchTools.length,
    },
  };
}

// ---- Native web_fetch redirect (layer 1) ----
// Same shape as the web_search conversion above: Claude `web_fetch_*` server tools are
// swapped for a plain `url` function tool that 9router executes through /v1/web/fetch.
export const NINEROUTER_WEB_FETCH_FALLBACK_TOOL_NAME = "9router_web_fetch";
const WEB_FETCH_TOOL_TYPES = /^web_fetch/;
const URL_PATTERN = /https?:\/\/[^\s<>"'`)\]}]+/gi;

function isBuiltInWebFetchTool(tool) {
  const rec = toRecord(tool);
  return typeof rec.type === "string" && WEB_FETCH_TOOL_TYPES.test(rec.type) && !rec.function;
}

// Strip fragment and trailing sentence punctuation so "see https://a.com/x." matches.
export function normalizeFetchUrl(raw) {
  try {
    const url = new URL(String(raw).replace(/[.,;:!?]+$/, ""));
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function collectUrls(value, into) {
  if (typeof value === "string") {
    for (const m of value.match(URL_PATTERN) || []) {
      const n = normalizeFetchUrl(m);
      if (n) into.add(n);
    }
  } else if (Array.isArray(value)) {
    for (const v of value) collectUrls(v, into);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectUrls(v, into);
  }
}

// Anthropic only lets web_fetch use URLs that already appeared in the conversation:
// user messages, client tool results, and prior search/fetch results. Assistant text and
// the system prompt are deliberately excluded so the model cannot mint its own URLs.
function collectPriorUrls(messages) {
  const urls = new Set();
  for (const msg of Array.isArray(messages) ? messages : []) {
    if (msg?.role === "user") {
      if (typeof msg.content === "string") collectUrls(msg.content, urls);
      for (const block of Array.isArray(msg.content) ? msg.content : []) {
        if (block?.type === "text") collectUrls(block.text, urls);
        else if (block?.type === "tool_result") collectUrls(block.content, urls);
      }
    } else if (Array.isArray(msg?.content)) {
      for (const block of msg.content) {
        if (block?.type === "web_search_tool_result" || block?.type === "web_fetch_tool_result") {
          collectUrls(block.content, urls);
        }
      }
    }
  }
  return [...urls];
}

function stringList(v) {
  return Array.isArray(v) ? v.filter((d) => typeof d === "string" && d.trim()).map((d) => d.trim().toLowerCase()) : null;
}

function webFetchPolicy(tool) {
  const t = toRecord(tool);
  const allowed = stringList(t.allowed_domains);
  const blocked = stringList(t.blocked_domains);
  return {
    maxUses: Number.isInteger(t.max_uses) && t.max_uses > 0 ? t.max_uses : null,
    allowedDomains: allowed?.length ? allowed : null,
    blockedDomains: blocked?.length ? blocked : null,
    maxContentTokens: Number.isInteger(t.max_content_tokens) && t.max_content_tokens > 0 ? t.max_content_tokens : null,
    citations: toRecord(t.citations).enabled === true,
  };
}

function buildWebFetchTool() {
  return {
    name: NINEROUTER_WEB_FETCH_FALLBACK_TOOL_NAME,
    description: [
      "Fetch the full content of a web page or PDF at a URL.",
      "Only URLs the user provided, or that appeared in earlier tool or search results, can be fetched.",
    ].join(" "),
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: { url: { type: "string", description: "The exact URL to fetch (http or https)." } },
      required: ["url"],
    },
  };
}

// Claude -> Claude upstreams that actually run web_fetch natively keep the server tool.
export function supportsNativeWebFetchFallbackBypass({ provider, sourceFormat, targetFormat, nativePassthrough }) {
  if (nativePassthrough) return true;
  if (sourceFormat === FORMATS.CLAUDE && targetFormat === FORMATS.CLAUDE) {
    if (provider === "anthropic" || (provider || "").startsWith("anthropic-compatible")) return true;
    const supported = PROVIDERS[provider]?.quirks?.claudeSupportedToolTypes;
    return Array.isArray(supported) && supported.some((t) => WEB_FETCH_TOOL_TYPES.test(String(t)));
  }
  return false;
}

// Returns { body, fallback: { enabled, toolName, convertedToolCount, policy, priorUrls } }.
export function prepareWebFetchFallbackBody(body, options) {
  const disabled = { enabled: false, toolName: null, convertedToolCount: 0 };
  if (options.sourceFormat !== FORMATS.CLAUDE) return { body, fallback: disabled };
  const tools = Array.isArray(body?.tools) ? body.tools : null;
  if (!tools?.length) return { body, fallback: disabled };
  const builtIn = tools.filter(isBuiltInWebFetchTool);
  if (builtIn.length === 0) return { body, fallback: disabled };
  if (supportsNativeWebFetchFallbackBypass(options)) return { body, fallback: disabled };

  // Client already owns the reserved name: converting would run its own tool as a fetch.
  if (tools.some((t) => !isBuiltInWebFetchTool(t) && toRecord(t).name === NINEROUTER_WEB_FETCH_FALLBACK_TOOL_NAME)) {
    return { body, fallback: disabled };
  }

  const nextBody = { ...body, tools: [buildWebFetchTool(), ...tools.filter((t) => !isBuiltInWebFetchTool(t))] };
  const choice = toRecord(body.tool_choice);
  if (WEB_FETCH_TOOL_TYPES.test(String(choice.type || "")) || (choice.type === "tool" && choice.name === "web_fetch" && builtIn.length > 0)) {
    nextBody.tool_choice = { type: "tool", name: NINEROUTER_WEB_FETCH_FALLBACK_TOOL_NAME };
  }

  return {
    body: nextBody,
    fallback: {
      enabled: true,
      toolName: NINEROUTER_WEB_FETCH_FALLBACK_TOOL_NAME,
      convertedToolCount: builtIn.length,
      policy: webFetchPolicy(builtIn[0]),
      priorUrls: collectPriorUrls(body.messages),
    },
  };
}
