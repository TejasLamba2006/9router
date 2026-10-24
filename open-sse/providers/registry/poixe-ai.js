export default {
  id: "poixe-ai",
  alias: "poixe-ai",
  uiAlias: "poixe-ai",
  display: {
    name: "Poixe AI",
    icon: "router",
    color: "#EA580C",
    textIcon: "PX",
    website: "https://poixe.com",
    notice: {
      text: "Current public free limits are small and model-group specific: 2 RPM/5 RPD for large-cup models and 20 RPM/50 RPD for small-cup models.",
      apiKeyUrl: "https://poixe.com"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.poixe.com/v1/chat/completions",
    validateUrl: "https://api.poixe.com/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://api.poixe.com/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
