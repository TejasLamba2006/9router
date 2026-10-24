export default {
  id: "openadapter",
  alias: "openadapter",
  aliases: [
    "oad"
  ],
  uiAlias: "openadapter",
  display: {
    name: "OpenAdapter",
    icon: "hub",
    color: "#10B981",
    textIcon: "OD",
    website: "https://openadapter.dev",
    notice: {
      text: "Free tier with a generous quota and no credit card, 15+ open-source models with daily quota. Get your API key at https://dashboard.openadapter.in.",
      apiKeyUrl: "https://openadapter.dev"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.openadapter.in/v1/chat/completions",
    validateUrl: "https://api.openadapter.in/v1/models"
  },
  models: [
    { id: "glm-4.7", name: "GLM 4.7 (OpenAdapter)", contextLength: 128000 }
  ],
  modelsFetcher: {
    url: "https://api.openadapter.in/v1/models",
    type: "openai"
  }
};
