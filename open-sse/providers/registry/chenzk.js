export default {
  id: "chenzk",
  alias: "chenzk",
  uiAlias: "chenzk",
  display: {
    name: "Chenzk API",
    icon: "hub",
    color: "#10B981",
    textIcon: "CZ",
    website: "https://chenzk.top",
    notice: {
      apiKeyUrl: "https://chenzk.top"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://chenzk.top/v1/chat/completions",
    validateUrl: "https://chenzk.top/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://chenzk.top/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
