export default {
  id: "tokenreply",
  alias: "tokenreply",
  uiAlias: "tokenreply",
  display: {
    name: "TokenReply",
    icon: "router",
    color: "#3B82F6",
    textIcon: "TR",
    website: "https://www.tokenreply.com",
    notice: {
      text: "Free-tagged models have model- and campaign-specific daily limits; no fixed global free quota is published.",
      apiKeyUrl: "https://www.tokenreply.com"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.tokenreply.com/v1/chat/completions",
    validateUrl: "https://api.tokenreply.com/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://api.tokenreply.com/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
