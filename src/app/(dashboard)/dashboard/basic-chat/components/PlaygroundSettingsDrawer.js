"use client";

import Drawer from "@/shared/components/Drawer";
import { getDefaultSettings } from "@/shared/utils/playgroundRequest";

function Field({ label, children, hint }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-text-main">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-text-subtle">{hint}</span> : null}
    </label>
  );
}

const inputClass = "w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text-main outline-none focus:border-primary";

function CommonNumber({ label, name, value, onChange, min, max, step = 1, hint }) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="number"
        name={name}
        value={value ?? ""}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(name, event.target.value === "" ? null : Number(event.target.value))}
        className={inputClass}
      />
    </Field>
  );
}

export default function PlaygroundSettingsDrawer({
  isOpen,
  onClose,
  mode,
  settings,
  advanced,
  tools,
  caps,
  thinkingLevels,
  onSettingsChange,
  onAdvancedChange,
  onToolsChange,
  errors = {},
}) {
  const update = (name, value) => onSettingsChange({ ...settings, [name]: value });
  const reset = () => onSettingsChange(getDefaultSettings(mode));

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Playground settings" width="md" className="max-w-full">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-text-subtle">{mode}</p>
          <button type="button" onClick={reset} className="text-xs text-primary hover:underline">Reset</button>
        </div>

        {mode === "chat" ? (
          <>
            <Field label="System prompt">
              <textarea value={settings.system || ""} onChange={(event) => update("system", event.target.value)} rows={4} className={inputClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <CommonNumber label="Temperature" name="temperature" value={settings.temperature} onChange={update} min={0} max={2} step={0.1} hint="Provider-dependent" />
              <CommonNumber label="Top P" name="top_p" value={settings.top_p} onChange={update} min={0} max={1} step={0.05} hint="Provider-dependent" />
              <CommonNumber label="Max tokens" name="max_tokens" value={settings.max_tokens} onChange={update} min={1} max={caps?.maxOutput || undefined} hint={caps?.maxOutput ? `Model maximum: ${caps.maxOutput}` : "Provider-dependent"} />
              <CommonNumber label="Seed" name="seed" value={settings.seed} onChange={update} step={1} />
              <CommonNumber label="Presence penalty" name="presence_penalty" value={settings.presence_penalty} onChange={update} min={-2} max={2} step={0.1} />
              <CommonNumber label="Frequency penalty" name="frequency_penalty" value={settings.frequency_penalty} onChange={update} min={-2} max={2} step={0.1} />
            </div>
            <Field label="Stop sequences" hint="Comma-separated">
              <input value={Array.isArray(settings.stop) ? settings.stop.join(", ") : settings.stop || ""} onChange={(event) => update("stop", event.target.value.split(",").map((value) => value.trim()).filter(Boolean))} className={inputClass} />
            </Field>
            <Field label="Response format">
              <select value={settings.response_format?.type || "text"} onChange={(event) => update("response_format", { type: event.target.value })} className={inputClass}>
                <option value="text">Text</option>
                <option value="json_object">JSON object</option>
              </select>
            </Field>
            {caps?.reasoning ? (
              <>
                <Field label="Reasoning effort">
                  <select value={settings.reasoning_effort || ""} onChange={(event) => update("reasoning_effort", event.target.value || null)} className={inputClass}>
                    <option value="">Provider default</option>
                    {(thinkingLevels || []).map((level) => <option key={level} value={level}>{level}</option>)}
                  </select>
                </Field>
                {caps.thinkingRange ? (
                  <CommonNumber label="Thinking budget" name="thinking_budget" value={settings.thinking_budget} onChange={(name, value) => onSettingsChange({ ...settings, enable_thinking: value == null ? null : true, [name]: value })} min={caps.thinkingRange.min || 1} max={caps.thinkingRange.max} hint="Provider-dependent token budget" />
                ) : null}
              </>
            ) : null}
            <label className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text-main">
              Stream response
              <input type="checkbox" checked={settings.stream !== false} onChange={(event) => update("stream", event.target.checked)} />
            </label>
            <Field label="Tools JSON" hint="OpenAI function-tool array. Results are entered manually.">
              <textarea value={tools} onChange={(event) => onToolsChange(event.target.value)} rows={9} spellCheck={false} className={`${inputClass} font-mono text-xs`} />
              {errors.tools ? <span className="block text-xs text-danger">{errors.tools}</span> : null}
            </Field>
            {tools.trim() ? (
              <Field label="Tool choice">
                <select value={settings.tool_choice || "auto"} onChange={(event) => update("tool_choice", event.target.value)} className={inputClass}>
                  <option value="auto">Auto</option>
                  <option value="required">Required</option>
                  <option value="none">None</option>
                </select>
              </Field>
            ) : null}
          </>
        ) : null}

        {mode === "image" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <CommonNumber label="Images" name="n" value={settings.n} onChange={update} min={1} max={4} />
            <Field label="Size"><select value={settings.size || "1024x1024"} onChange={(event) => update("size", event.target.value)} className={inputClass}>{["auto", "1024x1024", "1024x1536", "1536x1024", "1024x1792", "1792x1024"].map((v) => <option key={v}>{v}</option>)}</select></Field>
            <Field label="Quality"><select value={settings.quality || "auto"} onChange={(event) => update("quality", event.target.value)} className={inputClass}>{["auto", "low", "medium", "high", "standard", "hd"].map((v) => <option key={v}>{v}</option>)}</select></Field>
            <Field label="Style"><select value={settings.style || ""} onChange={(event) => update("style", event.target.value || null)} className={inputClass}><option value="">Default</option><option>vivid</option><option>natural</option></select></Field>
            <Field label="Background"><select value={settings.background || "auto"} onChange={(event) => update("background", event.target.value)} className={inputClass}>{["auto", "transparent", "opaque"].map((v) => <option key={v}>{v}</option>)}</select></Field>
            <Field label="Output format"><select value={settings.output_format || "png"} onChange={(event) => update("output_format", event.target.value)} className={inputClass}>{["png", "jpeg", "webp"].map((v) => <option key={v}>{v}</option>)}</select></Field>
          </div>
        ) : null}

        {mode === "tts" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Voice"><input value={settings.voice || ""} onChange={(event) => update("voice", event.target.value)} className={inputClass} /></Field>
            <Field label="Format"><select value={settings.response_format || "mp3"} onChange={(event) => update("response_format", event.target.value)} className={inputClass}>{["mp3", "wav", "opus", "aac", "flac"].map((v) => <option key={v}>{v}</option>)}</select></Field>
            <CommonNumber label="Speed" name="speed" value={settings.speed} onChange={update} min={0.25} max={4} step={0.05} />
            <Field label="Language"><input value={settings.language || ""} onChange={(event) => update("language", event.target.value)} className={inputClass} /></Field>
            <Field label="Style"><input value={settings.style || ""} onChange={(event) => update("style", event.target.value)} className={inputClass} /></Field>
          </div>
        ) : null}

        {mode === "stt" ? (
          <div className="space-y-4">
            <Field label="Language"><input value={settings.language || ""} onChange={(event) => update("language", event.target.value)} className={inputClass} /></Field>
            <Field label="Prompt"><textarea value={settings.prompt || ""} onChange={(event) => update("prompt", event.target.value)} rows={3} className={inputClass} /></Field>
            <Field label="Response format"><select value={settings.response_format || "json"} onChange={(event) => update("response_format", event.target.value)} className={inputClass}>{["json", "text", "verbose_json", "srt", "vtt"].map((v) => <option key={v}>{v}</option>)}</select></Field>
          </div>
        ) : null}

        {mode === "embedding" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Encoding"><select value={settings.encoding_format || "float"} onChange={(event) => update("encoding_format", event.target.value)} className={inputClass}><option>float</option><option>base64</option></select></Field>
            <CommonNumber label="Dimensions" name="dimensions" value={settings.dimensions} onChange={update} min={1} />
          </div>
        ) : null}

        {mode === "video" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <CommonNumber label="Duration" name="duration" value={settings.duration} onChange={update} min={1} max={60} />
            <Field label="Aspect ratio"><select value={settings.aspect_ratio || "16:9"} onChange={(event) => update("aspect_ratio", event.target.value)} className={inputClass}>{["16:9", "9:16", "1:1", "4:3", "3:4"].map((v) => <option key={v}>{v}</option>)}</select></Field>
          </div>
        ) : null}

        <Field label="Advanced JSON" hint="Core inputs, auth, routing, model and stream fields are protected.">
          <textarea value={advanced} onChange={(event) => onAdvancedChange(event.target.value)} rows={10} spellCheck={false} placeholder="{}" className={`${inputClass} font-mono text-xs`} />
          {errors.advanced ? <span className="block text-xs text-danger">{errors.advanced}</span> : null}
        </Field>
      </div>
    </Drawer>
  );
}
