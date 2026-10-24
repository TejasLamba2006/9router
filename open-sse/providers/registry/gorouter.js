export default {
  id: "gorouter",
  alias: "gorouter",
  uiAlias: "gorouter",
  display: {
    name: "gorouter",
    icon: "hub",
    color: "#6366F1",
    textIcon: "GO",
    notice: {}
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://gorouter.app/v1/chat/completions",
    validateUrl: "https://gorouter.app/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://gorouter.app/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
