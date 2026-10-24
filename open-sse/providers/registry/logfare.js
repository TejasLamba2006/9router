export default {
  id: "logfare",
  alias: "logfare",
  uiAlias: "logfare",
  display: {
    name: "Logfare",
    icon: "auto_awesome",
    color: "#22C55E",
    textIcon: "LF",
    website: "https://logfare.ai",
    notice: {
      text: "Free OpenAI-compatible inference, no rate limits, no card. Logfare logs every request (prompts, completions, metadata) for internal research; opt out at /consent. Read https://logfare.ai/tos and https://logfare.ai/privacy before use.",
      apiKeyUrl: "https://logfare.ai"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://logfare.ai/v1/chat/completions",
    validateUrl: "https://logfare.ai/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://logfare.ai/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
