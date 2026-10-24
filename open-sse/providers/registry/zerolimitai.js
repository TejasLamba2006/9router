export default {
  id: "zerolimitai",
  alias: "zerolimitai",
  uiAlias: "zerolimitai",
  display: {
    name: "ZeroLimitAI",
    icon: "router",
    color: "#475569",
    textIcon: "ZL",
    website: "https://www.zerolimitai.com",
    notice: {
      text: "Temporary free trial is advertised, but official pages conflict between 3 and 7 days; a 100-calls/day claim is not treated as permanent.",
      apiKeyUrl: "https://www.zerolimitai.com"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://www.zerolimitai.com/api/v1/chat/completions",
    validateUrl: "https://www.zerolimitai.com/api/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://www.zerolimitai.com/api/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
