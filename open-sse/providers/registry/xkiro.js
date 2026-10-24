export default {
  id: "xkiro",
  alias: "xkiro",
  uiAlias: "xkiro",
  display: {
    name: "xKiro",
    icon: "hub",
    color: "#0EA5E9",
    textIcon: "XK",
    website: "https://xkiro.com",
    notice: {
      text: "Free plan: 5M tokens/day per account across 40 upstream free models, 39 pinned here (Qwen, MiniMax, DeepSeek, Mistral, SenseNova), no card; past the daily allowance free requests get a 429 until the reset. RPM not published.",
      apiKeyUrl: "https://xkiro.com"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://api.xkiro.com/v1/chat/completions"
  },
  models: [
    { id: "qwen/qwen3-vl-plus:free", name: "Qwen3 VL Plus", contextLength: 262144 },
    { id: "sensenova/sensenova-6.8-flash-lite", name: "SenseNova 6.8 Flash-Lite", contextLength: 262144 },
    { id: "minimax/minimax-m2.7:free", name: "MiniMax M2.7", contextLength: 204800 },
    { id: "minimax/minimax-m2.7-highspeed:free", name: "MiniMax M2.7 Highspeed", contextLength: 204800 },
    { id: "minimax/minimax-m2.5:free", name: "MiniMax M2.5", contextLength: 204800 },
    { id: "minimax/minimax-m3:free", name: "MiniMax M3", contextLength: 1000000 },
    { id: "minimax/minimax-m2.1-highspeed:free", name: "MiniMax M2.1 Highspeed", contextLength: 204800 },
    { id: "minimax/minimax-m2.5-highspeed:free", name: "MiniMax M2.5 Highspeed", contextLength: 204800 },
    { id: "minimax/minimax-m2.1:free", name: "MiniMax M2.1", contextLength: 204800 },
    { id: "minimax/minimax-m2:free", name: "MiniMax M2", contextLength: 204800 },
    { id: "qwen/qwen3.5-flash:free", name: "Qwen3.5 Flash", contextLength: 1000000 },
    { id: "qwen/qwen3.6-plus:free", name: "Qwen3.6 Plus", contextLength: 1000000 },
    { id: "qwen/qwen3.5-397b-a17b:free", name: "Qwen3.5 397B A17B", contextLength: 262144 },
    { id: "qwen/qwen3.5-omni-flash:free", name: "Qwen3.5 Omni Flash", contextLength: 262144 },
    { id: "mistralai/mistral-large-2512", name: "Mistral Large 3", contextLength: 256000 },
    { id: "mistralai/mistral-medium-3.5", name: "Mistral Medium 3.5", contextLength: 256000 },
    { id: "mistralai/mistral-small-2603", name: "Mistral Small 4", contextLength: 256000 },
    { id: "mistralai/codestral-2508", name: "Codestral", contextLength: 256000 },
    { id: "mistralai/devstral-medium", name: "Devstral 2", contextLength: 256000 },
    { id: "mistralai/ministral-8b", name: "Ministral 3 8B", contextLength: 256000 },
    { id: "mistralai/ministral-3b", name: "Ministral 3 3B", contextLength: 128000 },
    { id: "deepseek/deepseek-v4-pro", name: "DeepSeek V4 Pro", contextLength: 1048576 },
    { id: "deepseek/deepseek-v3.2", name: "DeepSeek V3.2", contextLength: 131072 },
    { id: "deepseek/deepseek-chat-v3.1", name: "DeepSeek V3.1", contextLength: 163840 },
    { id: "qwen/qwen3.7-plus:free", name: "Qwen3.7 Plus", contextLength: 1000000 },
    { id: "mistralai/ministral-14b", name: "Ministral 3 14B", contextLength: 256000 },
    { id: "qwen/qwen3.6-max-preview:free", name: "Qwen3.6 Max Preview", contextLength: 262144 },
    { id: "qwen/qwen3.5-plus:free", name: "Qwen3.5 Plus", contextLength: 1000000 },
    { id: "qwen/qwen3.5-omni-plus:free", name: "Qwen3.5 Omni Plus", contextLength: 262144 },
    { id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4 Flash", contextLength: 1048576 },
    { id: "sensenova/sensenova-6.7-flash-lite", name: "SenseNova 6.7 Flash-Lite", contextLength: 262144 },
    { id: "qwen/qwen3.8-max:free", name: "Qwen3.8 Max", contextLength: 1000000 },
    { id: "qwen/qwen3.7-max:free", name: "Qwen3.7 Max", contextLength: 1000000 },
    { id: "qwen/qwen3.6-27b:free", name: "Qwen3.6 27B", contextLength: 262144 },
    { id: "qwen/qwen3.6-35b-a3b:free", name: "Qwen3.6 35B A3B", contextLength: 262144 },
    { id: "qwen/qwen3-max:free", name: "Qwen3 Max", contextLength: 262144 },
    { id: "qwen/qwen3-coder-plus:free", name: "Qwen3 Coder Plus", contextLength: 1048576 },
    { id: "qwen/qwen-plus-2025-07-28:free", name: "Qwen Plus 0728", contextLength: 131072 },
    { id: "qwen/qwen3-omni-flash:free", name: "Qwen3 Omni Flash", contextLength: 262144 }
  ]
};
