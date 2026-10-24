export default {
  id: "evomap",
  alias: "evomap",
  uiAlias: "evomap",
  display: {
    name: "evomap",
    icon: "hub",
    color: "#6366F1",
    textIcon: "EV",
    notice: {}
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.evomap.ai/v1/chat/completions",
    validateUrl: "https://api.evomap.ai/v1/models"
  },
  models: [
    { id: "evomap-glm-5.2", name: "evomap-glm-5.2" },
    { id: "gpt-5.4", name: "gpt-5.4" },
    { id: "evomap-gemini-3.1-pro-preview", name: "evomap-gemini-3.1-pro-preview" },
    { id: "evomap-claude-opus-4-8", name: "evomap-claude-opus-4-8" },
    { id: "evomap-claude-opus-4-7", name: "evomap-claude-opus-4-7" },
    { id: "evomap-glm-5.1", name: "evomap-glm-5.1" },
    { id: "evomap-gpt-5.5", name: "evomap-gpt-5.5" },
    { id: "evomap-kimi-k2.6", name: "evomap-kimi-k2.6" }
  ],
  modelsFetcher: {
    url: "https://api.evomap.ai/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
