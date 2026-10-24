export default {
  id: "plamo",
  alias: "plamo",
  uiAlias: "plamo",
  display: {
    name: "PLaMo",
    icon: "public",
    color: "#DC2626",
    textIcon: "PL",
    website: "https://plamo.preferredai.jp/api",
    notice: {
      apiKeyUrl: "https://plamo.preferredai.jp/api"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.platform.preferredai.jp/v1/chat/completions"
  },
  models: [
    { id: "plamo-3.0-prime", name: "PLaMo 3.0 Prime", contextLength: 262144 }
  ]
};
