export default {
  id: "codestral",
  alias: "codestral",
  uiAlias: "codestral",
  display: {
    name: "Codestral",
    icon: "terminal",
    color: "#FF7000",
    textIcon: "CS",
    website: "https://mistral.ai",
    notice: {
      apiKeyUrl: "https://mistral.ai"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://codestral.mistral.ai/v1/chat/completions"
  },
  models: [
    { id: "codestral-2508", name: "codestral-2508" },
    { id: "codestral-latest", name: "codestral-latest" }
  ]
};
