export default {
  id: "anyapi",
  alias: "anyapi",
  uiAlias: "anyapi",
  display: {
    name: "AnyAPI AI",
    icon: "hub",
    color: "#0EA5E9",
    textIcon: "AA",
    website: "https://anyapi.ai",
    notice: {
      text: "Free plan: 100,000 ANY Tokens/day and 100 RPM for eligible Free/Basic models; no credit card required.",
      apiKeyUrl: "https://anyapi.ai"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.anyapi.ai/v1/chat/completions",
    validateUrl: "https://api.anyapi.ai/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://api.anyapi.ai/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
