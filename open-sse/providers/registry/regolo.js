export default {
  id: "regolo",
  alias: "regolo",
  uiAlias: "regolo",
  display: {
    name: "Regolo AI",
    icon: "hub",
    color: "#6366F1",
    textIcon: "RG",
    website: "https://regolo.ai",
    notice: {
      apiKeyUrl: "https://regolo.ai"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.regolo.ai/v1/chat/completions",
    validateUrl: "https://api.regolo.ai/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://api.regolo.ai/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
