export default {
  id: "llm-kiwi",
  alias: "llm-kiwi",
  aliases: [
    "llmkiwi"
  ],
  uiAlias: "llm-kiwi",
  display: {
    name: "LLM.Kiwi",
    icon: "hub",
    color: "#84CC16",
    textIcon: "LK",
    website: "https://llm.kiwi",
    notice: {
      text: "Free plan exposes auto and hrLLM; the published 40 requests/hour limit applies to hrLLM.",
      apiKeyUrl: "https://llm.kiwi"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.llm.kiwi/v1/chat/completions",
    validateUrl: "https://api.llm.kiwi/v1/models"
  },
  models: [
    { id: "auto", name: "Auto" },
    { id: "hrLLM", name: "hrLLM" }
  ],
  modelsFetcher: {
    url: "https://api.llm.kiwi/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
