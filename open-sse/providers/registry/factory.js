export default {
  id: "factory",
  alias: "factory",
  uiAlias: "factory",
  display: {
    name: "Factory",
    icon: "smart_toy",
    color: "#0F172A",
    textIcon: "FA",
    website: "https://factory.ai",
    notice: {
      apiKeyUrl: "https://factory.ai"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.factory.ai/v1/chat/completions"
  },
  models: [
    { id: "auto", name: "Factory Auto (best model)" }
  ]
};
