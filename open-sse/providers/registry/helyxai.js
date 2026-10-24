export default {
  id: "helyxai",
  alias: "helyxai",
  uiAlias: "helyxai",
  display: {
    name: "Helyx AI",
    icon: "hub",
    color: "#7C3AED",
    textIcon: "HX",
    website: "https://helyxai.space",
    notice: {
      text: "Operational Free plan documents 100,000 tokens/day; the site's separate 2M+ marketing claim conflicts and is not treated as a quota guarantee.",
      apiKeyUrl: "https://helyxai.space"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://helyxai.space/v1/chat/completions",
    validateUrl: "https://helyxai.space/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://helyxai.space/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
