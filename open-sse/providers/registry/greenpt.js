export default {
  id: "greenpt",
  alias: "greenpt",
  uiAlias: "greenpt",
  display: {
    name: "GreenPT",
    icon: "eco",
    color: "#15803D",
    textIcon: "GPT",
    website: "https://greenpt.com",
    notice: {
      text: "API subscription is free to create; inference is billed per token. No free inference allowance is published.",
      apiKeyUrl: "https://greenpt.com"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.greenpt.ai/v1/chat/completions",
    validateUrl: "https://api.greenpt.ai/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://api.greenpt.ai/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
