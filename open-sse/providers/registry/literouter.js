export default {
  id: "literouter",
  alias: "literouter",
  uiAlias: "literouter",
  display: {
    name: "LiteRouter",
    icon: "router",
    color: "#2563EB",
    textIcon: "LR",
    website: "https://literouter.com",
    notice: {
      text: "Free model variants use the :free suffix; daily credit limits vary by model and free input is capped at 5,000 tokens.",
      apiKeyUrl: "https://literouter.com"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.literouter.com/v1/chat/completions",
    validateUrl: "https://api.literouter.com/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://api.literouter.com/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
