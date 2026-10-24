export default {
  id: "freeinference",
  alias: "freeinference",
  uiAlias: "freeinference",
  display: {
    name: "FreeInference",
    icon: "science",
    color: "#8B5CF6",
    textIcon: "FI",
    website: "https://freeinference.org",
    notice: {
      text: "Free research access without a card; non-Harvard applicants require manual approval and no numeric quota is publicly guaranteed.",
      apiKeyUrl: "https://freeinference.org"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://freeinference.org/v1/chat/completions",
    validateUrl: "https://freeinference.org/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://freeinference.org/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
