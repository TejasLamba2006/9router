export default {
  id: "void-ai",
  alias: "void-ai",
  uiAlias: "void-ai",
  display: {
    name: "Void AI",
    icon: "science",
    color: "#111827",
    textIcon: "VA",
    website: "https://voidai.app",
    notice: {
      text: "The public model catalog marks some models with a free plan requirement, but access is conditional and no numeric quota is confirmed.",
      apiKeyUrl: "https://voidai.app"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.voidai.app/v1/chat/completions",
    validateUrl: "https://api.voidai.app/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://api.voidai.app/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
