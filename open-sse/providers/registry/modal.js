export default {
  id: "modal",
  alias: "modal",
  aliases: [
    "mdl"
  ],
  uiAlias: "modal",
  display: {
    name: "Modal",
    icon: "cloud_queue",
    color: "#7C3AED",
    textIcon: "MDL",
    website: "https://modal.com/docs",
    notice: {
      text: "$30/month free credits for new accounts",
      apiKeyUrl: "https://modal.com/docs"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.modal.ai/v1/chat/completions"
  },
  models: [
    { id: "google/gemini-2.0-flash", name: "Gemini 2.0 Flash" }
  ]
};
