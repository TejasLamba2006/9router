export default {
  id: "ai21",
  alias: "ai21",
  uiAlias: "ai21",
  display: {
    name: "AI21 Labs",
    icon: "psychology_alt",
    color: "#0284C7",
    textIcon: "AI21",
    website: "https://www.ai21.com",
    notice: {
      text: "$10 trial credits on signup (valid 3 months), no credit card required",
      apiKeyUrl: "https://www.ai21.com"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.ai21.com/studio/v1/chat/completions"
  },
  models: [
    { id: "jamba-large-1.7", name: "jamba-large-1.7" },
    { id: "jamba-mini-2", name: "jamba-mini-2" }
  ]
};
