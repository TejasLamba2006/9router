export default {
  id: "digitalocean",
  alias: "digitalocean",
  uiAlias: "digitalocean",
  display: {
    name: "DigitalOcean",
    icon: "cloud",
    color: "#0060FF",
    textIcon: "DO",
    website: "https://docs.digitalocean.com/products/ai-platform/",
    notice: {
      apiKeyUrl: "https://docs.digitalocean.com/products/ai-platform/"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://inference.do-ai.run/v1/chat/completions",
    validateUrl: "https://inference.do-ai.run/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://inference.do-ai.run/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
