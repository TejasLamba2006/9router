export default {
  id: "volcengine-coding-plan",
  alias: "volcengine-coding-plan",
  aliases: [
    "vecp"
  ],
  uiAlias: "volcengine-coding-plan",
  display: {
    name: "Volcengine Ark Coding Plan",
    icon: "code",
    color: "#FF6A00",
    textIcon: "VC",
    website: "https://console.volcengine.com/ark/region:cn-beijing/subscription/coding-plan",
    notice: {
      apiKeyUrl: "https://console.volcengine.com/ark/region:cn-beijing/subscription/coding-plan"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions",
    validateUrl: "/models"
  },
  models: [
    { id: "doubao-seed-2-1-turbo", name: "Doubao Seed 2.1 Turbo (Coding Plan)", contextLength: 262144 },
    { id: "doubao-seed-2.0-lite", name: "Doubao Seed 2.0 Lite (Coding Plan)", contextLength: 262144 },
    { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash (Coding Plan)", contextLength: 1048576 },
    { id: "glm-5.2", name: "GLM 5.2 (Coding Plan)", contextLength: 1048576 },
    { id: "kimi-k2.7-code", name: "Kimi K2.7 Code (Coding Plan)", contextLength: 1048576 },
    { id: "minimax-m3", name: "MiniMax M3 (Coding Plan)", contextLength: 1048576 },
    { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro (Coding Plan)", contextLength: 1048576 },
    { id: "minimax-m2.7", name: "MiniMax M2.7 (Coding Plan)", contextLength: 1048576 },
    { id: "kimi-k2.6", name: "Kimi K2.6 (Coding Plan)", contextLength: 1048576 }
  ],
  modelsFetcher: {
    url: "/models",
    type: "openai"
  }
};
