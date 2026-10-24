export default {
  id: "naga-ai",
  alias: "naga-ai",
  uiAlias: "naga-ai",
  display: {
    name: "Naga AI",
    icon: "router",
    color: "#059669",
    textIcon: "NA",
    website: "https://naga.ac",
    notice: {
      text: "Models marked :free are publicly listed, but no numeric quota is confirmed. Naga's policy warns that free-tier prompts and outputs may be collected or used for training.",
      apiKeyUrl: "https://naga.ac"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.naga.ac/v1/chat/completions",
    validateUrl: "https://api.naga.ac/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://api.naga.ac/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
