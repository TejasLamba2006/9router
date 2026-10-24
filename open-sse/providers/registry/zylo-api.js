export default {
  id: "zylo-api",
  alias: "zylo-api",
  aliases: [
    "zylo"
  ],
  uiAlias: "zylo-api",
  display: {
    name: "Zylo API",
    icon: "hub",
    color: "#2563EB",
    textIcon: "ZY",
    website: "https://zyloai.net",
    notice: {
      text: "Basic plan: 10 RPM, 7,200 requests/day and 200,000 tokens/day; limited to Basic text models.",
      apiKeyUrl: "https://zyloai.net"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.zyloai.net/v1/chat/completions",
    validateUrl: "https://api.zyloai.net/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://api.zyloai.net/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
