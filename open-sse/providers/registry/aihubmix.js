export default {
  id: "aihubmix",
  alias: "aihubmix",
  uiAlias: "aihubmix",
  display: {
    name: "aihubmix",
    icon: "hub",
    color: "#6366F1",
    textIcon: "AI",
    notice: {}
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://aihubmix.com/v1/chat/completions",
    validateUrl: "https://aihubmix.com/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://aihubmix.com/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
