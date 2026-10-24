export default {
  id: "speka",
  alias: "speka",
  uiAlias: "speka",
  display: {
    name: "Speka AI",
    icon: "router",
    color: "#DB2777",
    textIcon: "SP",
    website: "https://speka.me",
    notice: {
      text: "Free plan: $1 monthly usage, 10 RPM, one API key and access to open models and the playground; no card required.",
      apiKeyUrl: "https://speka.me"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://speka.me/v1/chat/completions",
    validateUrl: "https://speka.me/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://speka.me/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
