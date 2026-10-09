"use client";

import PropTypes from "prop-types";
import { getCapabilityBadgeStates } from "@/shared/utils/modelCapabilityBadges.js";

const LABELS = {
  text: "Text",
  vision: "Vision",
  tools: "Tools",
  structuredOutput: "JSON",
  reasoning: "Reasoning",
};

const COLORS = {
  verified: "bg-green-500/10 text-green-600",
  unsupported: "bg-red-500/10 text-red-500",
  inconclusive: "bg-amber-500/10 text-amber-600",
  transient_failure: "bg-amber-500/10 text-amber-600",
  user: "bg-purple-500/10 text-purple-600",
  reported: "bg-blue-500/10 text-blue-600",
  builtin: "bg-gray-500/10 text-gray-600",
};

export default function ModelCapabilityBadges({ capabilities }) {
  if (!capabilities) return null;
  return Object.entries(LABELS).flatMap(([capability, label]) => {
    const value = capabilities[capability];
    return getCapabilityBadgeStates(value).map((state) => {
      const title = state === value?.verified?.outcome
        ? `${state}${value.verified.checkedAt ? ` · ${new Date(value.verified.checkedAt).toLocaleString()}` : ""}`
        : state;
      return <span key={`${capability}-${state}`} title={title} className={`rounded px-1 py-0.5 text-[9px] ${COLORS[state]}`}>{label} · {state}</span>;
    });
  });
}

ModelCapabilityBadges.propTypes = {
  capabilities: PropTypes.object,
};
