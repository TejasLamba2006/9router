export default {
  id: "oneminai",
  alias: "oneminai",
  aliases: [
    "1min"
  ],
  uiAlias: "oneminai",
  display: {
    name: "1min.AI",
    icon: "hub",
    color: "#6366F1",
    textIcon: "1M",
    website: "https://1min.ai",
    notice: {
      apiKeyUrl: "https://1min.ai"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.1min.ai/api/chat-with-ai",
    auth: {
      combined: true,
      header: "api-key",
      scheme: "raw"
    }
  },
  models: [
    { id: "gpt-4o-mini", name: "GPT-4o Mini" }
  ],
  passthroughModels: true
};
