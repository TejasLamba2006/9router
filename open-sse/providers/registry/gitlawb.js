export default {
  id: "gitlawb",
  alias: "gitlawb",
  aliases: [
    "glb"
  ],
  uiAlias: "gitlawb",
  display: {
    name: "Gitlawb Opengateway (MiMo)",
    icon: "hub",
    color: "#10B981",
    textIcon: "GLB",
    website: "https://opengateway.gitlawb.com",
    notice: {
      text: "Free MiMo (xiaomi/mimo-v2.5) revoked 2026-05, Opengateway is now a pay-as-you-go credit gateway; no recurring free model.",
      apiKeyUrl: "https://opengateway.gitlawb.com"
    }
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://opengateway.gitlawb.com/v1/xiaomi-mimo",
    headers: {
      "User-Agent": "OpenClaude/1.0 (linux; x86_64)",
      "X-Title": "OpenClaude CLI",
      "HTTP-Referer": "https://github.com/Gitlawb/openclaude"
    }
  },
  models: [
    { id: "mimo-v2.5-pro", name: "MiMo-V2.5-Pro", contextLength: 1048576 },
    { id: "mimo-v2.5", name: "MiMo-V2.5", contextLength: 1048576 },
    { id: "mimo-v2-pro", name: "MiMo-V2-Pro", contextLength: 262144 },
    { id: "mimo-v2-omni", name: "MiMo-V2-Omni", contextLength: 262144 },
    { id: "mimo-v2-flash", name: "MiMo-V2-Flash", contextLength: 262144 }
  ]
};
