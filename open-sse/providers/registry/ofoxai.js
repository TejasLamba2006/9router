export default {
  id: "ofoxai",
  alias: "ofoxai",
  uiAlias: "ofoxai",
  display: {
    name: "OfoxAI",
    icon: "router",
    color: "#0F766E",
    textIcon: "OF",
    website: "https://ofox.ai",
    notice: {
      text: "The current catalog advertises 10+ free models without a public numeric quota; review upstream provenance, retention and training terms before production use.",
      apiKeyUrl: "https://ofox.ai"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.ofox.ai/v1/chat/completions",
    validateUrl: "https://api.ofox.ai/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://api.ofox.ai/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
