export default {
  id: "apinex",
  alias: "apinex",
  uiAlias: "apinex",
  display: {
    name: "apinex",
    icon: "hub",
    color: "#6366F1",
    textIcon: "AP",
    notice: {}
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.apinex.bond/v1/chat/completions",
    validateUrl: "https://api.apinex.bond/v1/models"
  },
  models: [
    { id: "claude-fable-5.1", name: "claude-fable-5.1" },
    { id: "claude-opus-5", name: "claude-opus-5" },
    { id: "claude-opus-5.5", name: "claude-opus-5.5" },
    { id: "claude-sonnet-5", name: "claude-sonnet-5" },
    { id: "claude-sonnet-5.5", name: "claude-sonnet-5.5" },
    { id: "deepseek-v4-flash", name: "deepseek-v4-flash" },
    { id: "deepseek-v4-pro", name: "deepseek-v4-pro" },
    { id: "deepseek-v4.1-flash", name: "deepseek-v4.1-flash" },
    { id: "free/claude-opus-4.6", name: "free/claude-opus-4.6" },
    { id: "free/claude-sonnet-4.6", name: "free/claude-sonnet-4.6" },
    { id: "free/deepseek-v4-flash-0731", name: "free/deepseek-v4-flash-0731" },
    { id: "free/deepseek-v4-pro-0813", name: "free/deepseek-v4-pro-0813" },
    { id: "free/deepseek-v4.1-flash", name: "free/deepseek-v4.1-flash" },
    { id: "free/glm-5.3-flash", name: "free/glm-5.3-flash" },
    { id: "free/gemini-3.1-pro", name: "free/gemini-3.1-pro" },
    { id: "free/gemini-3.8-flash", name: "free/gemini-3.8-flash" },
    { id: "free/gpt-6-luna", name: "free/gpt-6-luna" },
    { id: "free/hy4", name: "free/hy4" },
    { id: "free/kimi-k2.8", name: "free/kimi-k2.8" },
    { id: "free/kimi-k3", name: "free/kimi-k3" },
    { id: "free/mimo-v2.6-flash", name: "free/mimo-v2.6-flash" },
    { id: "free/mimo-v2.6-pro", name: "free/mimo-v2.6-pro" },
    { id: "free/minimax-m3", name: "free/minimax-m3" },
    { id: "free/minimax-m3.1", name: "free/minimax-m3.1" },
    { id: "free/muse-spark-1.3", name: "free/muse-spark-1.3" },
    { id: "free/qwen-3.8-max", name: "free/qwen-3.8-max" },
    { id: "glm-5.3", name: "glm-5.3" },
    { id: "glm-5.3-flash", name: "glm-5.3-flash" },
    { id: "gpt-5.6-terra", name: "gpt-5.6-terra" },
    { id: "gpt-6-astra", name: "gpt-6-astra" },
    { id: "gpt-6-luna", name: "gpt-6-luna" },
    { id: "gpt-6.1-sol", name: "gpt-6.1-sol" },
    { id: "gemini-3.1-pro", name: "gemini-3.1-pro" },
    { id: "gemini-3.8-flash", name: "gemini-3.8-flash" },
    { id: "grok-4.7", name: "grok-4.7" },
    { id: "kimi-k3", name: "kimi-k3" }
  ],
  modelsFetcher: {
    url: "https://api.apinex.bond/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
