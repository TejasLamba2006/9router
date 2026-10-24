export default {
  id: "0w0",
  alias: "0w0",
  uiAlias: "0w0",
  display: {
    name: "0w0",
    icon: "hub",
    color: "#6366F1",
    textIcon: "0W",
    notice: {}
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://0w0.hk/v1/chat/completions",
    validateUrl: "https://0w0.hk/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://0w0.hk/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
