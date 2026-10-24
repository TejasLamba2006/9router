export default {
  id: "agnes-cn",
  alias: "agnes-cn",
  aliases: [
    "agnescn"
  ],
  uiAlias: "agnes-cn",
  display: {
    name: "Agnes AI (China)",
    icon: "auto_awesome",
    color: "#047857",
    textIcon: "AC",
    website: "https://api.agnes-ai.cn",
    notice: {
      text: "Permanently free, no API credit card required.",
      apiKeyUrl: "https://api.agnes-ai.cn"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.agnes-ai.cn/v1/chat/completions",
    validateUrl: "https://api.agnes-ai.cn/v1/models"
  },
  models: [
    { id: "agnes-2.0-flash", name: "Agnes 2.0 Flash", contextLength: 262144 },
    { id: "agnes-2.5-flash", name: "Agnes 2.5 Flash", contextLength: 524288 },
    { id: "agnes-3.0-flash", name: "Agnes 3.0 Flash", contextLength: 524288 }
  ],
  modelsFetcher: {
    url: "https://api.agnes-ai.cn/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
