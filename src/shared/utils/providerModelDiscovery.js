export function showsModelCatalog(providerInfo, isCompatible = false) {
  return isCompatible || (providerInfo?.serviceKinds ?? ["llm"]).includes("llm");
}

export function showsModelRefresh(providerInfo, hasActiveConnection) {
  return providerInfo?.modelDiscovery === "refresh" && hasActiveConnection;
}
