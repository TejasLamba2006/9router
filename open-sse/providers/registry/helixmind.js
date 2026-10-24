export default {
  id: "helixmind",
  alias: "helixmind",
  uiAlias: "helixmind",
  display: {
    name: "HelixMind",
    icon: "hub",
    color: "#4F46E5",
    textIcon: "HM",
    website: "https://helixmind.online",
    notice: {
      text: "Previously circulated 3 RPM/50 RPD and no-card claims were not confirmed during the 2026-08-02 audit; current quota and billing require account verification.",
      apiKeyUrl: "https://helixmind.online"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://helixmind.online/v1/chat/completions",
    validateUrl: "https://helixmind.online/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://helixmind.online/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
