export default {
  id: "qwen-cloud-token-plan",
  alias: "qwen-cloud-token-plan",
  aliases: [
    "qct"
  ],
  uiAlias: "qwen-cloud-token-plan",
  display: {
    name: "Qwen Cloud Token Plan",
    icon: "cloud",
    color: "#615CED",
    textIcon: "QCT",
    website: "https://www.qwencloud.com/pricing/token-plan",
    notice: {
      apiKeyUrl: "https://www.qwencloud.com/pricing/token-plan"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions",
    validateUrl: "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/models"
  },
  models: [
    { id: "qwen3.8-max", name: "Qwen3.8 Max", contextLength: 1000000 },
    { id: "qwen3.7-max", name: "Qwen3.7 Max", contextLength: 1000000 },
    { id: "qwen3.7-plus", name: "Qwen3.7 Plus", contextLength: 1000000 },
    { id: "qwen3.8-flash", name: "Qwen3.8 Flash", contextLength: 1000000 },
    { id: "qwen3.6-flash", name: "Qwen3.6 Flash", contextLength: 1000000 },
    { id: "glm-5.2", name: "GLM 5.2", contextLength: 1000000 },
    { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", contextLength: 1000000 },
    { id: "deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash", contextLength: 1000000 },
    { id: "deepseek-v4-flash-0731", name: "DeepSeek V4 Flash", contextLength: 1000000 }
  ],
  modelsFetcher: {
    url: "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/models",
    type: "openai"
  }
};
