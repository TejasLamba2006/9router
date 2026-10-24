export default {
  id: "meganova-ai",
  alias: "meganova-ai",
  uiAlias: "meganova-ai",
  display: {
    name: "MegaNova AI",
    icon: "router",
    color: "#7C3AED",
    textIcon: "MN",
    website: "https://meganova.ai",
    notice: {
      text: "Free signup without a card. Published Tier 1 per-model quotas total 550 requests/day; they are not a shared global pool, and paid overage can apply if enabled.",
      apiKeyUrl: "https://meganova.ai"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.meganova.ai/v1/chat/completions",
    validateUrl: "https://api.meganova.ai/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://api.meganova.ai/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
