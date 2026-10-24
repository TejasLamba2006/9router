export default {
  id: "dit",
  alias: "dit",
  aliases: [
    "dai"
  ],
  uiAlias: "dit",
  display: {
    name: "DIT.ai",
    icon: "hub",
    color: "#0EA5E9",
    textIcon: "DT",
    website: "https://dit.ai",
    notice: {
      apiKeyUrl: "https://dit.ai"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.dit.ai/v1/chat/completions",
    validateUrl: "https://api.dit.ai/v1/models"
  },
  models: [
    { id: "gpt-5.4", name: "GPT-5.4 (DIT.ai)", contextLength: 400000 },
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6 (DIT.ai)", contextLength: 200000 }
  ],
  modelsFetcher: {
    url: "https://api.dit.ai/v1/models",
    type: "openai"
  }
};
