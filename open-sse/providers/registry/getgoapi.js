export default {
  id: "getgoapi",
  alias: "getgoapi",
  aliases: [
    "ggo"
  ],
  uiAlias: "getgoapi",
  display: {
    name: "GoAPI",
    icon: "rocket_launch",
    color: "#FF6D00",
    textIcon: "GO",
    website: "https://api.getgoapi.com",
    notice: {
      apiKeyUrl: "https://api.getgoapi.com"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.getgoapi.com/v1/chat/completions",
    validateUrl: "https://api.getgoapi.com/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://api.getgoapi.com/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
