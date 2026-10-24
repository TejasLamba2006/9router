export default {
  id: "electronhub",
  alias: "electronhub",
  uiAlias: "electronhub",
  display: {
    name: "Electron Hub",
    icon: "hub",
    color: "#22C55E",
    textIcon: "EH",
    website: "https://www.electronhub.ai",
    notice: {
      text: "Free plan: 5 RPM, $0.25 weekly credits and 10 Neutrinos/day for :free models; family budgets also apply.",
      apiKeyUrl: "https://www.electronhub.ai"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.electronhub.ai/v1/chat/completions",
    validateUrl: "https://api.electronhub.ai/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://api.electronhub.ai/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
