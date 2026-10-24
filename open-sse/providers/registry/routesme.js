export default {
  id: "routesme",
  alias: "routesme",
  uiAlias: "routesme",
  display: {
    name: "routesme",
    icon: "hub",
    color: "#6366F1",
    textIcon: "RO",
    notice: {}
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://routesme.online/v1/chat/completions",
    validateUrl: "https://routesme.online/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://routesme.online/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
