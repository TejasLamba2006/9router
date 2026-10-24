export default {
  id: "lyceum",
  alias: "lyceum",
  uiAlias: "lyceum",
  display: {
    name: "Lyceum",
    icon: "router",
    color: "#4F46E5",
    textIcon: "LY",
    website: "https://lyceum.technology",
    notice: {
      text: "Includes monthly free credits toward serverless inference usage.",
      apiKeyUrl: "https://lyceum.technology"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.lyceum.technology/openai/v1/chat/completions",
    validateUrl: "https://api.lyceum.technology/openai/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://api.lyceum.technology/openai/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
