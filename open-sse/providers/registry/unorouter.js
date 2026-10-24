export default {
  id: "unorouter",
  alias: "unorouter",
  uiAlias: "unorouter",
  display: {
    name: "UnoRouter",
    icon: "unorouter",
    color: "#8B5CF6",
    textIcon: "UR",
    website: "https://unorouter.ai",
    notice: {
      text: "Models with the :free suffix do not debit balance; limit is 1 request/minute per free model per user.",
      apiKeyUrl: "https://unorouter.ai"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.unorouter.com/v1/chat/completions",
    validateUrl: "https://api.unorouter.com/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://api.unorouter.com/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
