export default {
  id: "chatanywhere",
  alias: "chatanywhere",
  uiAlias: "chatanywhere",
  display: {
    name: "ChatAnywhere",
    icon: "router",
    color: "#2563EB",
    textIcon: "CA",
    website: "https://chatanywhere.tech",
    notice: {
      text: "Personal, educational or research use only: public documentation cites 10,000 points/day and 200 requests/day per IP/key; do not use for commercial traffic.",
      apiKeyUrl: "https://chatanywhere.tech"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.chatanywhere.org/v1/chat/completions",
    validateUrl: "https://api.chatanywhere.org/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://api.chatanywhere.org/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
