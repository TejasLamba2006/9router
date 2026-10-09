import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";

const CAPABILITIES = new Set(["text", "vision", "tools", "structuredOutput", "reasoning"]);
const OUTCOMES = new Set(["verified", "unsupported", "inconclusive", "transient_failure"]);

function validate(row) {
  if (!row || typeof row !== "object") throw new Error("Invalid capability evidence");
  if (typeof row.provider !== "string" || !row.provider || row.provider.length > 256) throw new Error("Invalid provider");
  if (typeof row.model !== "string" || !row.model || row.model.length > 512) throw new Error("Invalid model");
  if (typeof row.connectionId !== "string" || !row.connectionId || row.connectionId.length > 128) throw new Error("Invalid connectionId");
  if (!CAPABILITIES.has(row.capability)) throw new Error("Invalid capability");
  if (!OUTCOMES.has(row.outcome)) throw new Error("Invalid outcome");
  if (!Number.isInteger(row.probeVersion) || row.probeVersion < 1) throw new Error("Invalid probeVersion");
  const evidence = stringifyJson(row.evidence || {});
  if (evidence.length > 2000) throw new Error("Evidence is too large");
  return { ...row, evidence };
}

export async function upsertModelCapabilityEvidence(rows) {
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 10) throw new Error("Invalid capability evidence rows");
  const normalized = rows.map(validate);
  const db = await getAdapter();
  db.transaction(() => {
    for (const row of normalized) {
      db.run(
        `INSERT INTO modelCapabilityEvidence(provider, model, connectionId, capability, outcome, checkedAt, latencyMs, status, evidence, probeVersion)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(provider, model, connectionId, capability) DO UPDATE SET
           outcome = excluded.outcome, checkedAt = excluded.checkedAt, latencyMs = excluded.latencyMs,
           status = excluded.status, evidence = excluded.evidence, probeVersion = excluded.probeVersion`,
        [row.provider, row.model, row.connectionId, row.capability, row.outcome, row.checkedAt,
          row.latencyMs ?? null, row.status ?? null, row.evidence, row.probeVersion]
      );
    }
  });
  return normalized.length;
}

export async function getModelCapabilityEvidence({ provider, model, connectionId } = {}) {
  const db = await getAdapter();
  const conditions = [];
  const params = [];
  if (provider) { conditions.push("provider = ?"); params.push(provider); }
  if (model) { conditions.push("model = ?"); params.push(model); }
  if (connectionId) { conditions.push("connectionId = ?"); params.push(connectionId); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return db.all(`SELECT provider, model, connectionId, capability, outcome, checkedAt, latencyMs, status, evidence, probeVersion FROM modelCapabilityEvidence ${where} ORDER BY model, capability`, params)
    .map((row) => ({ ...row, evidence: parseJson(row.evidence, {}) }));
}

export async function deleteModelCapabilityEvidence({ provider, model, connectionId } = {}) {
  const db = await getAdapter();
  const conditions = [];
  const params = [];
  if (provider) { conditions.push("provider = ?"); params.push(provider); }
  if (model) { conditions.push("model = ?"); params.push(model); }
  if (connectionId) { conditions.push("connectionId = ?"); params.push(connectionId); }
  if (!conditions.length) throw new Error("Capability evidence delete requires a filter");
  db.run(`DELETE FROM modelCapabilityEvidence WHERE ${conditions.join(" AND ")}`, params);
}
