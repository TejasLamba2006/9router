export default {
  id: "qiniu",
  alias: "qiniu",
  uiAlias: "qiniu",
  display: {
    name: "Qiniu",
    icon: "cloud",
    color: "#1E88E5",
    textIcon: "QN",
    website: "https://www.qiniu.com",
    notice: {
      apiKeyUrl: "https://www.qiniu.com"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.qnaigc.com/v1/chat/completions",
    validateUrl: "https://api.qnaigc.com/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://api.qnaigc.com/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
