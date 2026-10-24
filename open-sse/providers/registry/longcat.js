export default {
  id: "longcat",
  alias: "longcat",
  aliases: [
    "lc"
  ],
  uiAlias: "longcat",
  display: {
    name: "LongCat AI",
    icon: "auto_awesome",
    color: "#FF6B9D",
    textIcon: "LC",
    website: "https://longcat.chat/platform/docs",
    notice: {
      text: "Free: one-time 10M-token grant after account signup + KYC verification (LongCat-2.0). One-time only, not a recurring daily/monthly allowance.",
      apiKeyUrl: "https://longcat.chat/platform/docs"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.longcat.chat/openai/v1/chat/completions",
    auth: {
      combined: true,
      header: "Authorization",
      scheme: "raw"
    }
  },
  models: [
    { id: "LongCat-2.0", name: "LongCat 2.0 (10M tok free 🆓)", contextLength: 1048576 }
  ]
};
