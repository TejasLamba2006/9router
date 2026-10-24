export default {
  id: "nube",
  alias: "nube",
  uiAlias: "nube",
  display: {
    name: "Nube.sh",
    icon: "cloud",
    color: "#2563EB",
    textIcon: "NB",
    website: "https://nube.sh",
    notice: {
      apiKeyUrl: "https://nube.sh"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://ai.nube.sh/api/v1/chat/completions",
    validateUrl: "https://ai.nube.sh/api/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://ai.nube.sh/api/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
