export default {
  id: "x5lab",
  alias: "x5lab",
  uiAlias: "x5lab",
  display: {
    name: "X5Lab",
    icon: "router",
    color: "#7C3AED",
    textIcon: "X5",
    website: "https://x5lab.dev",
    notice: {
      apiKeyUrl: "https://x5lab.dev"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.x5lab.dev/v1/chat/completions",
    validateUrl: "https://api.x5lab.dev/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://api.x5lab.dev/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
