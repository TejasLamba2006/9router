export function getCapabilityBadgeStates(value) {
  const states = [];
  if (value?.verified && !value.verified.stale) states.push(value.verified.outcome);
  if (value?.user === true) states.push("user");
  if (value?.reported === true) states.push("reported");
  if (value?.builtin === true) states.push("builtin");
  return states;
}

export function getCapabilityBadgeState(value) {
  return getCapabilityBadgeStates(value)[0] || null;
}
