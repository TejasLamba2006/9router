export default {
  id: "volcengine-agent-plan",
  alias: "volcengine-agent-plan",
  aliases: [
    "veap"
  ],
  uiAlias: "volcengine-agent-plan",
  display: {
    name: "Volcengine Ark Agent Plan",
    icon: "local_fire_department",
    color: "#DC2626",
    textIcon: "VA",
    website: "https://console.volcengine.com/ark/region:cn-beijing/subscription/agent-plan",
    notice: {
      apiKeyUrl: "https://console.volcengine.com/ark/region:cn-beijing/subscription/agent-plan"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://ark.cn-beijing.volces.com/api/plan/v3/chat/completions"
  },
  models: [
    { id: "doubao-seed-evolving", name: "Doubao Seed Evolving (Agent Plan)", contextLength: 1048576 },
    { id: "doubao-seed-2-1-turbo-260628", name: "Doubao Seed 2.1 Turbo (Agent Plan)", contextLength: 262144 },
    { id: "doubao-seed-2-0-lite-260215", name: "Doubao Seed 2.0 Lite (Agent Plan)", contextLength: 262144 },
    { id: "doubao-seed-2-0-mini-260215", name: "Doubao Seed 2.0 Mini (Agent Plan)", contextLength: 262144 },
    { id: "deepseek-v4-flash-ga-260731", name: "DeepSeek V4 Flash GA (Agent Plan)", contextLength: 1048576 },
    { id: "kimi-k3", name: "Kimi K3 (Agent Plan)", contextLength: 1048576 },
    { id: "glm-5-2-260617", name: "GLM 5.2 (Agent Plan)", contextLength: 1048576 },
    { id: "kimi-k2.7-code", name: "Kimi K2.7 Code (Agent Plan)", contextLength: 1048576 },
    { id: "minimax-m3", name: "MiniMax M3 (Agent Plan)", contextLength: 1048576 },
    { id: "deepseek-v4-pro-260425", name: "DeepSeek V4 Pro (Agent Plan)", contextLength: 1048576 },
    { id: "minimax-m2.7", name: "MiniMax M2.7 (Agent Plan)", contextLength: 1048576 },
    { id: "kimi-k2.6", name: "Kimi K2.6 (Agent Plan)", contextLength: 1048576 }
  ]
};
