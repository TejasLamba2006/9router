export default {
  id: "mnn-ai",
  alias: "mnn-ai",
  uiAlias: "mnn-ai",
  display: {
    name: "MNN AI",
    icon: "hub",
    color: "#0F766E",
    textIcon: "MNN",
    website: "https://mnnai.ru",
    notice: {
      text: "Free plan: $1 monthly credits, 10 RPM and access only to models marked Free.",
      apiKeyUrl: "https://mnnai.ru"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.mnnai.ru/v1/chat/completions",
    validateUrl: "https://api.mnnai.ru/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://api.mnnai.ru/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
