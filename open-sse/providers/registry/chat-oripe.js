export default {
  id: "chat-oripe",
  alias: "chat-oripe",
  uiAlias: "chat-oripe",
  display: {
    name: "Chat Oripe",
    icon: "router",
    color: "#64748B",
    textIcon: "CO",
    website: "https://api.oriper.com",
    notice: {
      text: "Official metadata advertises 2M tokens/month, but the public site and documentation were blocked during audit; treat the quota and brand mapping as unconfirmed.",
      apiKeyUrl: "https://api.oriper.com"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.oriper.com/v1/chat/completions",
    validateUrl: "https://api.oriper.com/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://api.oriper.com/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
