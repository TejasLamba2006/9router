export default {
  id: "snowflake",
  alias: "snowflake",
  uiAlias: "snowflake",
  display: {
    name: "Snowflake Cortex",
    icon: "ac_unit",
    color: "#29B5E8",
    textIcon: "SF",
    website: "https://www.snowflake.com",
    notice: {
      apiKeyUrl: "https://www.snowflake.com"
    }
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey"
  ],
  transport: {
    baseUrl: "https://{account}.snowflakecomputing.com/api/v2"
  },
  models: [
    { id: "llama3.1-70b", name: "llama3.1-70b" },
    { id: "llama3.3-70b", name: "llama3.3-70b" },
    { id: "deepseek-r1", name: "deepseek-r1" },
    { id: "claude-3-5-sonnet", name: "claude-3-5-sonnet" }
  ]
};
