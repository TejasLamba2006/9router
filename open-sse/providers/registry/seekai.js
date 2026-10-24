export default {
  id: "seekai",
  alias: "seekai",
  aliases: [
    "ska"
  ],
  uiAlias: "seekai",
  display: {
    name: "SeekAi",
    icon: "hub",
    color: "#0D9488",
    textIcon: "SK",
    website: "https://seekai.cc",
    notice: {
      text: "Signup credit toward available models; amount and eligibility are set by SeekAi, not OmniRoute.",
      apiKeyUrl: "https://seekai.cc"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://seekai.cc/v1/chat/completions",
    validateUrl: "https://seekai.cc/v1/models"
  },
  models: [
    { id: "glm-5.3", name: "glm-5.3" },
    { id: "deepseek-ai/DeepSeek-V4-Flash-0731", name: "deepseek-ai/DeepSeek-V4-Flash-0731" },
    { id: "deepseek-v4-flash", name: "deepseek-v4-flash" },
    { id: "z-ai/glm-5.3", name: "z-ai/glm-5.3" },
    { id: "step-3.7-flash:free", name: "step-3.7-flash:free" },
    { id: "gpt-oss-120b", name: "gpt-oss-120b" },
    { id: "glm-5.3-flash-search:free", name: "glm-5.3-flash-search:free" },
    { id: "doubao-seed-2.0-code", name: "doubao-seed-2.0-code" },
    { id: "claude-sonnet-4-20250514", name: "claude-sonnet-4-20250514" },
    { id: "longcat-2.5-preview", name: "longcat-2.5-preview" },
    { id: "glm-5.3-flash", name: "glm-5.3-flash" },
    { id: "big-pickle", name: "big-pickle" },
    { id: "nemotron-3.5-lightning", name: "nemotron-3.5-lightning" },
    { id: "muse-spark-1.2-contributor", name: "muse-spark-1.2-contributor" },
    { id: "glm-4.7-flash", name: "glm-4.7-flash" },
    { id: "gpt-oss-20b", name: "gpt-oss-20b" },
    { id: "z-ai/glm-5.3-flash", name: "z-ai/glm-5.3-flash" },
    { id: "space-bunny-alpha:free", name: "space-bunny-alpha:free" },
    { id: "muse-spark-1.3-contributor", name: "muse-spark-1.3-contributor" },
    { id: "claude-sonnet", name: "claude-sonnet" },
    { id: "claude-sonnet-4-6", name: "claude-sonnet-4-6" },
    { id: "deepseek-v4-flash:free", name: "deepseek-v4-flash:free" },
    { id: "deepseek-v4.1-flash", name: "deepseek-v4.1-flash" },
    { id: "jev-1.13", name: "jev-1.13" },
    { id: "moonshotai/kimi-k3", name: "moonshotai/kimi-k3" },
    { id: "mimo-v2.6-flash", name: "mimo-v2.6-flash" },
    { id: "MiniMax-M2.7-highspeed", name: "MiniMax-M2.7-highspeed" },
    { id: "step-5-preview", name: "step-5-preview" },
    { id: "exo", name: "exo" },
    { id: "ling-3.0-flash-fin", name: "ling-3.0-flash-fin" },
    { id: "glm-5.3:free", name: "glm-5.3:free" },
    { id: "nemotron-3-ultra", name: "nemotron-3-ultra" },
    { id: "minimax-m2.7:free", name: "minimax-m2.7:free" },
    { id: "union-alpha", name: "union-alpha" }
  ],
  modelsFetcher: {
    url: "https://seekai.cc/v1/models",
    type: "openai"
  },
  passthroughModels: true
};
