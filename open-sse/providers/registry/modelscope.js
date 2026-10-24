export default {
  id: "modelscope",
  alias: "modelscope",
  aliases: [
    "ms"
  ],
  uiAlias: "modelscope",
  display: {
    name: "ModelScope",
    icon: "cloud",
    color: "#FF6A00",
    textIcon: "MS",
    website: "https://modelscope.cn",
    notice: {
      text: "Free tier via ModelScope API-Inference, Alibaba account required.",
      apiKeyUrl: "https://modelscope.cn"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api-inference.modelscope.cn/v1/chat/completions",
    validateUrl: "https://api-inference.modelscope.cn/v1/models"
  },
  models: [],
  modelsFetcher: {
    url: "https://api-inference.modelscope.cn/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
