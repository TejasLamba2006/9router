export default {
  id: "llmgateway",
  alias: "llmgateway",
  uiAlias: "llmgateway",
  display: {
    name: "LLM Gateway",
    icon: "router",
    color: "#6366F1",
    textIcon: "LG",
    website: "https://llmgateway.io",
    notice: {
      text: "Hosted Free plan: free-priced models are limited to 5 requests per 10 minutes when the account has no credits.",
      apiKeyUrl: "https://llmgateway.io"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.llmgateway.io/v1/chat/completions",
    validateUrl: "https://api.llmgateway.io/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://api.llmgateway.io/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
