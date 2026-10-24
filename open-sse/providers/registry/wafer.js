export default {
  id: "wafer",
  alias: "wafer",
  uiAlias: "wafer",
  display: {
    name: "Wafer AI",
    icon: "layers",
    color: "#6366F1",
    textIcon: "WF",
    website: "https://wafer.ai",
    notice: {
      apiKeyUrl: "https://wafer.ai"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://wafer.ai/v1/chat/completions",
    validateUrl: "https://wafer.ai/v1/models"
  },
  models: [
    { id: "DeepSeek-V4-Pro", name: "DeepSeek V4 Pro" },
    { id: "MiniMax-M2.7", name: "MiniMax M2.7" },
    { id: "Qwen3.5-397B-A17B", name: "Qwen3.5 397B A17B" },
    { id: "GLM-5.1", name: "GLM 5.1" }
  ],
  modelsFetcher: {
    url: "https://wafer.ai/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
