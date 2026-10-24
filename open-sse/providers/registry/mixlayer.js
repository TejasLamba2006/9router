export default {
  id: "mixlayer",
  alias: "mixlayer",
  uiAlias: "mixlayer",
  display: {
    name: "Mixlayer",
    icon: "router",
    color: "#0EA5E9",
    textIcon: "MX",
    website: "https://www.mixlayer.com",
    notice: {
      text: "The qwen/qwen3.5-4b-free model is free for prototyping and rate-limited; no fixed public RPM or daily quota is confirmed.",
      apiKeyUrl: "https://www.mixlayer.com"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://models.mixlayer.ai/v1/chat/completions",
    validateUrl: "https://models.mixlayer.ai/v1/models"
  },
  models: [
    { id: "qwen/qwen3.5-4b-free", name: "Qwen 3.5 4B (free)" }
  ],
  modelsFetcher: {
    url: "https://models.mixlayer.ai/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
