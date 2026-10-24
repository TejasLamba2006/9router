export default {
  id: "fastrouter",
  alias: "fastrouter",
  uiAlias: "fastrouter",
  display: {
    name: "FastRouter",
    icon: "speed",
    color: "#F97316",
    textIcon: "FR",
    website: "https://fastrouter.ai",
    notice: {
      text: "Models with the :free suffix allow 10 requests/day per organization and model; availability may change.",
      apiKeyUrl: "https://fastrouter.ai"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.fastrouter.ai/api/v1/chat/completions",
    validateUrl: "https://api.fastrouter.ai/api/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://api.fastrouter.ai/api/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
