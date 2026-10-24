export default {
  id: "v0-vercel",
  alias: "v0-vercel",
  aliases: [
    "v0"
  ],
  uiAlias: "v0-vercel",
  display: {
    name: "v0 (Vercel)",
    icon: "code_blocks",
    color: "#111827",
    textIcon: "V0",
    website: "https://v0.dev",
    notice: {
      apiKeyUrl: "https://v0.dev"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.v0.dev/v1/chat/completions",
    validateUrl: "https://api.v0.dev/v1/models"
  },
  models: [
    { id: "v0-1.0-md", name: "v0-1.0-md" },
    { id: "v0-1.5-lg", name: "v0-1.5-lg" },
    { id: "v0-1.5-md", name: "v0-1.5-md" }
  ],
  modelsFetcher: {
    url: "https://api.v0.dev/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
