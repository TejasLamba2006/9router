export default {
  id: "auriko",
  alias: "auriko",
  uiAlias: "auriko",
  display: {
    name: "Auriko",
    icon: "hub",
    color: "#0891B2",
    textIcon: "AU",
    website: "https://www.auriko.ai",
    notice: {
      text: "Free plan publishes 1,000 Platform RPM and 10,000 BYOK RPM. Platform inference still passes through provider cost; this is not a free-token pool or unlimited free inference.",
      apiKeyUrl: "https://www.auriko.ai"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.auriko.ai/v1/chat/completions",
    validateUrl: "https://api.auriko.ai/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://api.auriko.ai/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
