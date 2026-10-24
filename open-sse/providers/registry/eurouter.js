export default {
  id: "eurouter",
  alias: "eurouter",
  uiAlias: "eurouter",
  display: {
    name: "EURouter",
    icon: "router",
    color: "#1D4ED8",
    textIcon: "EUR",
    website: "https://eurouter.ai",
    notice: {
      apiKeyUrl: "https://eurouter.ai"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.eurouter.ai/v1/chat/completions",
    validateUrl: "https://api.eurouter.ai/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://api.eurouter.ai/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
