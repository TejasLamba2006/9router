export default {
  id: "free-ai",
  alias: "free-ai",
  uiAlias: "free-ai",
  display: {
    name: "Free.ai",
    icon: "hub",
    color: "#16A34A",
    textIcon: "FA",
    website: "https://free.ai",
    notice: {
      text: "30,000 tokens/day cover self-hosted models after email verification. Usage beyond the pool can bill at raw cost, and premium external models are paid.",
      apiKeyUrl: "https://free.ai"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.free.ai/v1/chat/",
    validateUrl: "https://api.free.ai/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://api.free.ai/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
