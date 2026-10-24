export default {
  id: "sumopod",
  alias: "sumopod",
  uiAlias: "sumopod",
  display: {
    name: "SumoPod",
    icon: "router",
    color: "#2563EB",
    textIcon: "SP",
    website: "https://ai.sumopod.com",
    notice: {
      apiKeyUrl: "https://ai.sumopod.com"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://ai.sumopod.com/v1/chat/completions",
    validateUrl: "https://ai.sumopod.com/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://ai.sumopod.com/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
