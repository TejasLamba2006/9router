const CAPABILITIES = ["text", "vision", "tools", "structuredOutput", "reasoning"];

function reportedValue(capability, reported) {
  if (!reported) return null;
  if (capability === "text") {
    const input = reported.modalities?.input;
    return Array.isArray(input) ? input.includes("text") : null;
  }
  if (capability === "vision") {
    const input = reported.modalities?.input;
    if (reported.capabilities?.attachment === true || input?.includes?.("image")) return true;
    if (reported.capabilities?.attachment === false && Array.isArray(input)) return false;
    return null;
  }
  const key = capability === "tools" ? "tools" : capability;
  return typeof reported.capabilities?.[key] === "boolean" ? reported.capabilities[key] : null;
}

function booleanOrNull(value) {
  return typeof value === "boolean" ? value : null;
}

export function resolveCapabilityProvenance({ evidence = [], reported = null, builtin = {}, user = {}, currentProbeVersion }) {
  const byCapability = new Map(evidence.map((row) => [row.capability, row]));
  return Object.fromEntries(CAPABILITIES.map((capability) => {
    const row = byCapability.get(capability);
    const verified = row ? {
      outcome: row.outcome,
      checkedAt: row.checkedAt,
      connectionId: row.connectionId,
      probeVersion: row.probeVersion,
      stale: row.probeVersion !== currentProbeVersion,
    } : null;
    return [capability, {
      verified,
      reported: reportedValue(capability, reported),
      builtin: booleanOrNull(builtin?.[capability === "structuredOutput" ? "structuredOutput" : capability]),
      user: booleanOrNull(user?.[capability]),
    }];
  }));
}
