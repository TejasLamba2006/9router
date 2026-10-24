import { CLAUDE_API_HEADERS } from "../shared.js";

export default {
  id: "tabitoken",
  alias: "tabitoken",
  uiAlias: "tabitoken",
  display: {
    name: "TabiToken",
    icon: "hub",
    color: "#F97316",
    textIcon: "TT",
    website: "https://tabitoken.com",
    notice: {
      apiKeyUrl: "https://tabitoken.com"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://tabitoken.com/v1/messages",
    validateUrl: "https://tabitoken.com/v1/models",
    format: "claude",
    headers: { ...CLAUDE_API_HEADERS },
    auth: {
      combined: true,
      header: "x-api-key",
      scheme: "raw"
    }
  },
  models: [
    { id: "claude-opus-5", name: "Claude Opus 5" },
    { id: "claude-opus-5-thinking", name: "Claude Opus 5 (Thinking)" },
    { id: "claude-opus-4-8", name: "Claude Opus 4.8" },
    { id: "claude-opus-4-8-thinking", name: "Claude Opus 4.8 (Thinking)" }
  ],
  modelsFetcher: {
    url: "https://tabitoken.com/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
