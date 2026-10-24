export default {
  id: "predibase",
  alias: "predibase",
  uiAlias: "predibase",
  display: {
    name: "Predibase",
    icon: "deployed_code_history",
    color: "#0F766E",
    textIcon: "PB",
    website: "https://predibase.com",
    notice: {
      text: "$25 free trial credits (30-day validity)",
      apiKeyUrl: "https://predibase.com"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://serving.app.predibase.com/v1/chat/completions"
  },
  models: [
    { id: "llama-3.3-70b", name: "llama-3.3-70b" }
  ]
};
