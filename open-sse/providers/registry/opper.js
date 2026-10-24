export default {
  id: "opper",
  alias: "opper",
  uiAlias: "opper",
  display: {
    name: "Opper",
    icon: "router",
    color: "#6366F1",
    textIcon: "OP",
    website: "https://opper.ai",
    notice: {
      apiKeyUrl: "https://opper.ai"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.opper.ai/v3/compat/chat/completions",
    validateUrl: "https://api.opper.ai/v3/compat/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://api.opper.ai/v3/compat/models",
    type: "openai"
  },
  passthroughModels: true
};
