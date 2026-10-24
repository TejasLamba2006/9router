export default {
  id: "kenari",
  alias: "kenari",
  uiAlias: "kenari",
  display: {
    name: "Kenari",
    icon: "hub",
    color: "#B5362A",
    textIcon: "KN",
    website: "https://kenari.id",
    notice: {
      apiKeyUrl: "https://kenari.id"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://kenari.id/v1/chat/completions",
    validateUrl: "https://kenari.id/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://kenari.id/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
