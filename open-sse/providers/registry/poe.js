export default {
  id: "poe",
  alias: "poe",
  uiAlias: "poe",
  display: {
    name: "Poe",
    icon: "hub",
    color: "#F97316",
    textIcon: "PO",
    website: "https://creator.poe.com/api-reference",
    notice: {
      apiKeyUrl: "https://creator.poe.com/api-reference"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.poe.com/v1/chat/completions",
    validateUrl: "https://api.poe.com/v1/models"
  },
  models: [
    { id: "gpt-5.2", name: "GPT-5.2" },
    { id: "claude-opus-4.8", name: "Claude Opus 4.8" },
    { id: "gemini-3.0-pro", name: "Gemini 3.0 Pro" }
  ],
  modelsFetcher: {
    url: "https://api.poe.com/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
