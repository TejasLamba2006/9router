export default {
  id: "dgrid",
  alias: "dgrid",
  uiAlias: "dgrid",
  display: {
    name: "DGrid",
    icon: "router",
    color: "#65A30D",
    textIcon: "DG",
    website: "https://dgrid.ai",
    notice: {
      text: "DGrid Free Models Router: 10 requests/minute and 100 requests/day. A $5 lifetime top-up unlocks up to 20 requests/minute and 1,000 requests/day.",
      apiKeyUrl: "https://dgrid.ai"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.dgrid.ai/v1/chat/completions",
    validateUrl: "https://api.dgrid.ai/v1/models"
  },
  models: [
    { id: "dgridai/free", name: "DGrid Free Models Router" }
  ],
  modelsFetcher: {
    url: "https://api.dgrid.ai/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
