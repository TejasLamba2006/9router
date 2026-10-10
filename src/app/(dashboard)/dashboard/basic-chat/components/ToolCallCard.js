"use client";

import { useState } from "react";

function prettyArgs(args) {
  try { return JSON.stringify(JSON.parse(args), null, 2); } catch { return String(args || ""); }
}

/** One tool call from the model. When `onSubmit` is set the user can type the result manually. */
export default function ToolCallCard({ call, onSubmit, disabled }) {
  const [result, setResult] = useState("");
  const inputId = `tool-result-${call.id}`;
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
      <div className="flex items-center gap-2 text-text-main">
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">build</span>
        <span className="font-mono font-medium">{call.function?.name || "tool"}</span>
        <span className="truncate text-xs text-text-subtle">{call.id}</span>
      </div>
      <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded bg-surface p-2 font-mono text-xs text-text-main">
        {prettyArgs(call.function?.arguments)}
      </pre>
      {onSubmit ? (
        <form
          className="mt-2 space-y-2"
          onSubmit={(e) => { e.preventDefault(); onSubmit(call.id, result); setResult(""); }}
        >
          <label htmlFor={inputId} className="block text-xs text-text-muted">Tool result</label>
          <textarea
            id={inputId}
            value={result}
            onChange={(e) => setResult(e.target.value)}
            rows={3}
            placeholder='e.g. {"temperature": 21}'
            className="w-full rounded border border-border bg-surface p-2 font-mono text-xs text-text-main outline-none focus:border-primary"
          />
          <button type="submit" disabled={disabled} className="rounded-md bg-primary px-3 py-1.5 text-xs text-white hover:bg-primary-hover disabled:opacity-50">
            Send result
          </button>
        </form>
      ) : null}
    </div>
  );
}
