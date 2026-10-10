"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, ConfirmModal, ModelSelectModal } from "@/shared/components";
import { useModelCaps } from "@/shared/hooks/useModelCaps";
import { getThinkingLevels } from "open-sse/providers/thinkingLevels.js";
import {
  buildPlaygroundRequest,
  buildToolResultMessage,
  buildVideoPollRequest,
  createStreamState,
  normalizeResponse,
  parseAdvancedJson,
  reduceSseBuffer,
  toFormData,
} from "@/shared/utils/playgroundRequest";
import {
  BLOB_BUDGET_BYTES,
  evictBlobs,
  loadSessions,
  migrateBasicChatSessions,
  openBlobStore,
  releaseSessionBlobs,
  saveSessions,
} from "@/shared/utils/playgroundStorage";
import ConversationRail from "./components/ConversationRail";
import PlaygroundModeTabs from "./components/PlaygroundModeTabs";
import PlaygroundResult from "./components/PlaygroundResult";
import PlaygroundSettingsDrawer from "./components/PlaygroundSettingsDrawer";
import {
  applyToolResult,
  createSession,
  needsConfirmation,
  newId,
  normalizeLoadedSession,
  parseToolsJson,
  pendingToolCalls,
  pendingVideoJobs,
  persistGeneratedResult,
  preparePlaygroundAttachments,
  primaryInputForMode,
  sessionTitle,
  tabFor,
  toApiMessages,
  trimTrailingAssistant,
  toDashboardPath,
  toolContinuationMessageId,
  trimFromUserMessage,
  validateChatAttachments,
} from "./playgroundUi";

const ACTIVE_SESSION_KEY = "playground.v1.activeSessionId";
const POLL_DELAYS = [1500, 2500, 4000, 6000, 10000];

function errorText(value) {
  if (typeof value === "string") return value;
  return value?.error?.message || value?.error || value?.message || "Request failed";
}

async function parseError(response) {
  const raw = await response.text().catch(() => "");
  let body = raw;
  try { body = raw ? JSON.parse(raw) : ""; } catch {}
  return errorText(body) || `Request failed (${response.status})`;
}

async function blobToDataUrl(blob) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read attachment"));
    reader.readAsDataURL(blob);
  });
}


function inputPlaceholder(mode) {
  if (mode === "image") return "Describe an image to generate";
  if (mode === "tts") return "Text to speak";
  if (mode === "stt") return "Attach one audio file";
  if (mode === "embedding") return "Text to embed";
  if (mode === "video") return "Describe a video to generate";
  return "Message model";
}

function inputAccept(mode) {
  return mode === "stt" ? "audio/*" : "image/*,audio/*,.pdf,.txt,.md,.csv,.json,.yaml,.yml,.xml,.html,.css,.js,.jsx,.ts,.tsx,.py,.java,.go,.rs,.c,.cpp,.h,.docx,.xlsx,.pptx";
}

export default function BasicChatPageClient() {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [activeProviders, setActiveProviders] = useState([]);
  const [modelAliases, setModelAliases] = useState({});
  const [modelOpen, setModelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirmRun, setConfirmRun] = useState(null);
  const [validation, setValidation] = useState({});
  const [currentEmbeddingVectors, setCurrentEmbeddingVectors] = useState(null);
  const blobStoreRef = useRef(null);
  const abortRef = useRef(null);
  const pollControllersRef = useRef(new Map());
  const fileInputRef = useRef(null);
  const { getCaps } = useModelCaps();

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) || sessions[0] || null,
    [sessions, activeSessionId],
  );
  const mode = activeSession?.mode || "chat";
  const currentTab = tabFor(mode);
  const caps = getCaps(activeSession?.model);
  const [selectedProvider, selectedModel] = String(activeSession?.model || "").split(/\/(.+)/);
  const thinkingLevels = caps?.reasoning ? getThinkingLevels(selectedProvider, selectedModel) : null;
  const pendingCalls = useMemo(() => new Set(pendingToolCalls(activeSession?.messages).map((call) => call.id)), [activeSession?.messages]);
  const continuationMessageId = useMemo(() => toolContinuationMessageId(activeSession?.messages), [activeSession?.messages]);
  const sortedSessions = useMemo(() => [...sessions].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)), [sessions]);

  const patchSession = useCallback((sessionId, patch) => {
    setSessions((current) => current.map((session) => session.id === sessionId
      ? { ...session, ...(typeof patch === "function" ? patch(session) : patch), updatedAt: Date.now() }
      : session));
  }, []);

  const patchMessage = useCallback((sessionId, messageId, patch) => {
    patchSession(sessionId, (session) => ({
      messages: session.messages.map((message) => message.id === messageId
        ? { ...message, ...(typeof patch === "function" ? patch(message) : patch) }
        : message),
    }));
  }, [patchSession]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (activeSessionId) {
      patchSession(activeSessionId, (session) => ({
        messages: session.messages.map((message) => ["streaming", "running"].includes(message.status)
          ? { ...message, status: "stopped" }
          : message),
      }));
    }
    setBusy(false);
  }, [activeSessionId, patchSession]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const blobStore = await openBlobStore();
      if (cancelled) return;
      blobStoreRef.current = blobStore;
      await migrateBasicChatSessions({ blobStore });
      const loaded = loadSessions().map(normalizeLoadedSession);
      const first = loaded[0] || createSession({ mode: "chat" });
      const savedActive = globalThis.localStorage.getItem(ACTIVE_SESSION_KEY);
      setSessions(loaded.length ? loaded : [first]);
      setActiveSessionId(loaded.some((session) => session.id === savedActive) ? savedActive : first.id);
      setReady(true);
      await evictBlobs({ blobStore, sessions: loaded, maxBytes: BLOB_BUDGET_BYTES });
    })().catch((error) => setNotice(errorText(error)));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/providers", { cache: "no-store" }).then((response) => response.ok ? response.json() : {}),
      fetch("/api/models/alias", { cache: "no-store" }).then((response) => response.ok ? response.json() : {}),
    ]).then(([providers, aliases]) => {
      if (cancelled) return;
      setActiveProviders((providers.connections || []).filter((connection) => connection.isActive !== false));
      setModelAliases(aliases.aliases || {});
    }).catch((error) => { if (!cancelled) setNotice(errorText(error)); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!saveSessions(sessions)) setNotice("Browser storage is full. Conversation metadata was not saved.");
    if (activeSessionId) globalThis.localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);
  }, [sessions, activeSessionId, ready]);

  const pollVideo = useCallback(async ({ sessionId, messageId, jobId, pollToken }) => {
    if (!jobId || !pollToken || pollControllersRef.current.has(messageId)) return;
    const controller = new AbortController();
    pollControllersRef.current.set(messageId, controller);
    let attempt = 0;
    try {
      while (!controller.signal.aborted) {
        const spec = buildVideoPollRequest(jobId, pollToken);
        const response = await fetch(toDashboardPath(spec.path), { method: "GET", headers: spec.headers, signal: controller.signal });
        if (!response.ok) throw new Error(await parseError(response));
        let result = normalizeResponse("video", await response.json());
        if (result.kind !== "error" && result.done) result = await persistGeneratedResult(result, blobStoreRef.current);
        patchMessage(sessionId, messageId, {
          result,
          status: result.kind === "error" ? "error" : result.done ? "done" : "polling",
          error: result.kind === "error" ? result.message : null,
          ...(result.done ? { job: null } : {}),
        });
        if (result.kind === "error" || result.done) break;
        const delay = POLL_DELAYS[Math.min(attempt, POLL_DELAYS.length - 1)];
        attempt += 1;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } catch (error) {
      if (error.name !== "AbortError") patchMessage(sessionId, messageId, { status: "error", error: errorText(error) });
    } finally {
      pollControllersRef.current.delete(messageId);
    }
  }, [patchMessage]);

  useEffect(() => {
    if (!ready) return;
    for (const job of pendingVideoJobs(sessions)) pollVideo(job);
  }, [ready, sessions, pollVideo]);

  useEffect(() => () => {
    abortRef.current?.abort();
    for (const controller of pollControllersRef.current.values()) controller.abort();
  }, []);

  const loadNativeAttachments = useCallback(async (records) => {
    const dataUrls = {};
    for (const record of records) {
      if (!["image", "audio", "pdf"].includes(record.kind) || record.native === false) continue;
      const blob = await blobStoreRef.current?.get(record.id);
      if (blob) dataUrls[record.id] = await blobToDataUrl(blob);
    }
    return dataUrls;
  }, []);

  const execute = useCallback(async ({ session, userText, composerAttachments, retryMessages } = {}) => {
    if (!session?.model) { setNotice("Select a model first."); return; }
    const sessionId = session.id;
    const runMode = session.mode;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setBusy(true);
    setNotice("");

    let requestMessages = retryMessages;
    let userMessage = null;
    let runAttachments = composerAttachments || [];
    const titleSeed = userText || inputPlaceholder(runMode);

    try {
      if (runMode === "chat" && !requestMessages) {
        const checked = validateChatAttachments(runAttachments, getCaps(session.model) || {});
        if (checked.errors.length) throw new Error(checked.errors.join("\n"));
        runAttachments = checked.attachments;
        userMessage = { id: newId(), role: "user", content: userText, attachments: runAttachments, createdAt: Date.now() };
        const nextHistory = [...session.messages, userMessage];
        const dataUrls = await loadNativeAttachments(nextHistory.flatMap((message) => message.attachments || []));
        requestMessages = toApiMessages(nextHistory, dataUrls);
      }

      const tools = parseToolsJson(session.tools);
      if (!tools.ok) { setValidation({ tools: tools.error }); throw new Error(tools.error); }
      const advanced = parseAdvancedJson(session.advanced);
      if (!advanced.ok) { setValidation({ advanced: advanced.error }); throw new Error(advanced.error); }
      setValidation({});

      let input;
      if (runMode === "chat") input = { messages: requestMessages };
      else if (runMode === "stt") {
        const audio = runAttachments.find((attachment) => attachment.kind === "audio");
        const blob = audio ? await blobStoreRef.current?.get(audio.id) : null;
        input = primaryInputForMode(runMode, userText, audio && blob ? [{ ...audio, blob }] : []);
      } else input = primaryInputForMode(runMode, userText, runAttachments);

      const advancedValue = { ...advanced.value };
      if (runMode === "chat" && tools.value) advancedValue.tools = tools.value;
      const requestModel = runMode === "tts" && session.settings.voice
        ? `${session.model}/${session.settings.voice}`
        : session.model;
      const requestSettings = runMode === "tts"
        ? Object.fromEntries(Object.entries(session.settings).filter(([key]) => key !== "voice"))
        : session.settings;
      const spec = buildPlaygroundRequest({
        mode: runMode,
        model: requestModel,
        settings: requestSettings,
        input,
        advanced: advancedValue,
        limits: getCaps(session.model) || {},
      });
      const path = toDashboardPath(spec.path);
      const assistantId = newId();
      const displayUser = userMessage || (runMode !== "chat" ? { id: newId(), role: "user", content: userText, attachments: runAttachments, createdAt: Date.now() } : null);
      const pending = { id: assistantId, role: "assistant", content: "", status: spec.responseType === "sse" ? "streaming" : "running", createdAt: Date.now() };
      patchSession(sessionId, (current) => ({
        title: current.messages.length ? current.title : sessionTitle(titleSeed),
        messages: [...current.messages, ...(displayUser ? [displayUser] : []), pending],
      }));
      setDraft("");
      setAttachments([]);

      const response = await fetch(path, {
        method: spec.method,
        headers: spec.headers,
        body: spec.bodyType === "form" ? toFormData(spec.formFields) : JSON.stringify(spec.body),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(await parseError(response));

      if (spec.responseType === "sse") {
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Streaming response has no body");
        const decoder = new TextDecoder();
        let buffer = "";
        let state = createStreamState();
        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
          const reduced = reduceSseBuffer(state, buffer, done);
          state = reduced.state;
          buffer = reduced.rest;
          patchMessage(sessionId, assistantId, {
            content: state.content,
            reasoning_content: state.reasoningContent,
            tool_calls: state.toolCalls,
            usage: state.usage,
            finish_reason: state.finishReason,
            status: "streaming",
          });
          if (done) break;
        }
        if (state.error) throw new Error(state.error);
        const normalized = normalizeResponse("chat", state);
        patchMessage(sessionId, assistantId, { ...normalized.message, result: normalized, usage: normalized.usage, finish_reason: normalized.finishReason, status: "done" });
      } else {
        const payload = spec.responseType === "blob" ? await response.blob() : await response.json();
        let result = normalizeResponse(runMode, payload);
        if (result.kind === "error") throw new Error(result.message);
        result = await persistGeneratedResult(result, blobStoreRef.current);
        const pollToken = response.headers.get("x-playground-video-token");
        if (result.kind === "video" && result.id && !result.done && !pollToken) {
          throw new Error("Video gateway did not return a polling token");
        }
        if (result.kind === "embedding") setCurrentEmbeddingVectors(result.vectors.map((vector) => vector.values));
        const storedResult = result.kind === "embedding"
          ? { ...result, vectors: result.vectors.map(({ values, ...vector }) => vector) }
          : result;
        const patch = { result: storedResult, status: result.kind === "video" && !result.done ? "polling" : "done" };
        if (result.kind === "chat") Object.assign(patch, result.message, { usage: result.usage, finish_reason: result.finishReason });
        if (result.kind === "text") patch.content = result.text;
        if (result.kind === "video" && result.id) patch.job = { id: result.id, pollToken };
        patchMessage(sessionId, assistantId, patch);
        const generatedIds = [
          result.blobId,
          ...(result.images || []).map((item) => item.blobId),
          ...(result.videos || []).map((item) => item?.blobId),
        ].filter(Boolean);
        const eviction = await evictBlobs({ blobStore: blobStoreRef.current, sessions, keepIds: generatedIds });
        if (eviction.overBudget) setNotice("Playground media storage exceeds 500 MB because referenced outputs are retained.");
        if (result.kind === "video" && result.id && !result.done) pollVideo({ sessionId, messageId: assistantId, jobId: result.id, pollToken });
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        setNotice(errorText(error));
        setSessions((current) => current.map((item) => item.id !== sessionId ? item : {
          ...item,
          messages: item.messages.map((message) => message.status === "streaming" || message.status === "running"
            ? { ...message, status: "error", error: errorText(error) }
            : message),
        }));
      } else {
        setSessions((current) => current.map((item) => item.id !== sessionId ? item : {
          ...item,
          messages: item.messages.map((message) => message.status === "streaming" || message.status === "running"
            ? { ...message, status: "stopped" }
            : message),
        }));
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(false);
    }
  }, [getCaps, loadNativeAttachments, patchMessage, patchSession, pollVideo]);

  const requestRun = useCallback(() => {
    if (!activeSession || busy) return;
    if (activeSession.mode === "stt" && !attachments.some((attachment) => attachment.kind === "audio")) { setNotice("Attach one audio file."); return; }
    if (activeSession.mode !== "stt" && activeSession.mode !== "chat" && !draft.trim()) { setNotice("Enter input first."); return; }
    if (activeSession.mode === "chat" && !draft.trim() && attachments.length === 0) return;
    const run = (session = activeSession) => execute({ session, userText: draft.trim(), composerAttachments: attachments });
    if (needsConfirmation(activeSession)) setConfirmRun(() => () => run({ ...activeSession, confirmed: true }));
    else run();
  }, [activeSession, attachments, busy, draft, execute]);

  const addToolResult = useCallback((toolCallId, result) => {
    if (!activeSession || busy) return;
    const toolMessage = { id: newId(), ...buildToolResultMessage(toolCallId, result), createdAt: Date.now() };
    patchSession(activeSession.id, { messages: applyToolResult(activeSession.messages, toolMessage) });
  }, [activeSession, busy, patchSession]);

  const continueToolResults = useCallback(async () => {
    if (!activeSession || busy || pendingToolCalls(activeSession.messages).length) return;
    const dataUrls = await loadNativeAttachments(activeSession.messages.flatMap((message) => message.attachments || []));
    execute({ session: activeSession, userText: "", composerAttachments: [], retryMessages: toApiMessages(activeSession.messages, dataUrls) });
  }, [activeSession, busy, execute, loadNativeAttachments]);

  const regenerate = useCallback(async () => {
    if (!activeSession || busy || mode !== "chat") return;
    const messages = trimTrailingAssistant(activeSession.messages);
    if (!messages.some((message) => message.role === "user")) return;
    const dataUrls = await loadNativeAttachments(messages.flatMap((message) => message.attachments || []));
    patchSession(activeSession.id, { messages });
    execute({ session: { ...activeSession, messages }, userText: "", composerAttachments: [], retryMessages: toApiMessages(messages, dataUrls) });
  }, [activeSession, busy, execute, loadNativeAttachments, mode, patchSession]);

  const retryUserMessage = useCallback((message) => {
    if (!activeSession || busy || mode !== "chat") return;
    setDraft(message.content || "");
    setAttachments(message.attachments || []);
    patchSession(activeSession.id, { messages: trimFromUserMessage(activeSession.messages, message.id) });
  }, [activeSession, busy, mode, patchSession]);

  const handleFiles = async (event) => {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    if (!files.length || !blobStoreRef.current) return;
    try {
      const result = await preparePlaygroundAttachments(files, { blobStore: blobStoreRef.current, existing: attachments, only: mode === "stt" ? "audio" : undefined });
      setAttachments((current) => [...current, ...result.records]);
      const problems = [...result.rejected.map((item) => `${item.name}: ${item.reason}`), ...result.errors.map((item) => `${item.name}: ${item.message}`)];
      if (problems.length) setNotice(problems.join("\n"));
      await evictBlobs({ blobStore: blobStoreRef.current, sessions, keepIds: [...attachments, ...result.records].map((item) => item.id) });
    } catch (error) { setNotice(errorText(error)); }
  };

  const removeAttachment = async (id) => {
    setAttachments((current) => current.filter((attachment) => attachment.id !== id));
    await blobStoreRef.current?.delete(id);
  };

  const clearComposer = () => {
    const storedIds = new Set(activeSession?.messages.flatMap((message) => message.attachments?.map((attachment) => attachment.id) || []) || []);
    for (const attachment of attachments) if (!storedIds.has(attachment.id)) blobStoreRef.current?.delete(attachment.id);
    setAttachments([]);
    setDraft("");
  };

  const newConversation = (nextMode = mode) => {
    const session = createSession({ mode: nextMode });
    setSessions((current) => [session, ...current]);
    setActiveSessionId(session.id);
    setCurrentEmbeddingVectors(null);
    clearComposer();
  };

  const selectMode = (nextMode) => {
    if (!activeSession || busy || nextMode === activeSession.mode) return;
    if (activeSession.messages.length === 0) patchSession(activeSession.id, { mode: nextMode, settings: createSession({ mode: nextMode }).settings, title: `New ${tabFor(nextMode).label.toLowerCase()}`, model: "", confirmed: false });
    else { newConversation(nextMode); return; }
    clearComposer();
  };

  const selectSession = (sessionId) => {
    if (busy || sessionId === activeSessionId) return;
    stop();
    clearComposer();
    setCurrentEmbeddingVectors(null);
    setActiveSessionId(sessionId);
  };

  const deleteSession = async (sessionId) => {
    const session = sessions.find((item) => item.id === sessionId);
    const remaining = sessions.filter((item) => item.id !== sessionId);
    if (session) await releaseSessionBlobs({ blobStore: blobStoreRef.current, session, remainingSessions: remaining, keepIds: attachments.map((attachment) => attachment.id) });
    if (remaining.length) {
      setSessions(remaining);
      if (activeSessionId === sessionId) setActiveSessionId(remaining[0].id);
    } else {
      const replacement = createSession({ mode: "chat" });
      setSessions([replacement]);
      setActiveSessionId(replacement.id);
    }
  };

  if (!ready || !activeSession) return <div className="flex h-full items-center justify-center bg-bg text-text-muted">Loading Playground…</div>;

  return (
    <div className="flex h-full min-h-0 bg-bg text-text-main">
      <ConversationRail sessions={sortedSessions} activeId={activeSession.id} onSelect={selectSession} onNew={() => newConversation(mode)} onDelete={deleteSession} disabled={busy} mobileOpen={railOpen} onMobileClose={() => setRailOpen(false)} />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="space-y-3 border-b border-border-subtle bg-surface px-3 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setRailOpen(true)} className="rounded-lg p-2 text-text-muted hover:bg-surface-2 lg:hidden" aria-label="Open conversations"><span className="material-symbols-outlined">menu</span></button>
            <button type="button" onClick={() => setModelOpen(true)} className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-left hover:border-primary">
              <span className="block truncate text-sm font-medium text-text-main">{activeSession.model || "Select model"}</span>
              <span className="block text-xs text-text-subtle">{currentTab.label}</span>
            </button>
            <Button variant="ghost" size="sm" icon="tune" onClick={() => setSettingsOpen(true)}>Settings</Button>
          </div>
          <PlaygroundModeTabs mode={mode} onChange={selectMode} disabled={busy} />
        </header>

        {notice ? <div className="mx-3 mt-3 flex items-start justify-between gap-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger sm:mx-5"><p className="whitespace-pre-wrap">{notice}</p><button type="button" onClick={() => setNotice("")} aria-label="Dismiss"><span className="material-symbols-outlined text-[18px]">close</span></button></div> : null}

        <section className="flex-1 overflow-y-auto px-3 py-5 custom-scrollbar sm:px-5">
          <div className="mx-auto max-w-4xl space-y-6">
            {activeSession.messages.length === 0 ? (
              <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
                <span className="material-symbols-outlined text-5xl text-primary">{currentTab.icon}</span>
                <h2 className="text-xl font-semibold">{currentTab.label} Playground</h2>
                <p className="max-w-lg text-sm text-text-muted">Choose model, tune settings, then run. Conversations stay in this browser.</p>
              </div>
            ) : null}
            {activeSession.messages.map((message) => {
              const user = message.role === "user";
              return (
                <article key={message.id} className={`flex ${user ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[min(92%,52rem)] space-y-3 rounded-xl ${user ? "bg-primary/10 px-4 py-3" : "w-full"}`}>
                    <p className="text-xs font-medium text-text-subtle">{user ? "You" : message.role === "tool" ? "Tool result" : activeSession.model || "Model"}</p>
                    {user ? <p className="whitespace-pre-wrap break-words text-[15px] leading-7">{message.content}</p> : <PlaygroundResult message={message} pendingCallIds={pendingCalls} onToolResult={addToolResult} onContinueTools={message.id === continuationMessageId ? continueToolResults : null} blobStore={blobStoreRef.current} />}
                    {typeof message.content === "string" && message.content ? <div className="flex items-center gap-3"><button type="button" onClick={() => navigator.clipboard.writeText(message.content)} className="text-xs text-text-subtle hover:text-primary">Copy</button>{user && mode === "chat" ? <button type="button" onClick={() => retryUserMessage(message)} className="text-xs text-text-subtle hover:text-primary">Edit and retry</button> : null}</div> : null}
                    {message.attachments?.length ? <div className="flex flex-wrap gap-2">{message.attachments.map((attachment) => <span key={attachment.id} className="rounded-full border border-border bg-surface px-2 py-1 text-xs text-text-muted">{attachment.name}</span>)}</div> : null}
                    {!user && message.status && message.status !== "done" ? <p className="text-xs text-text-subtle">{message.status}</p> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <footer className="border-t border-border-subtle bg-surface p-3 sm:p-4">
          <div className="mx-auto max-w-4xl space-y-3">
            {attachments.length ? <div className="flex flex-wrap gap-2">{attachments.map((attachment) => <span key={attachment.id} className="flex max-w-full items-center gap-1 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs text-text-muted"><span className="truncate">{attachment.name}</span><button type="button" onClick={() => removeAttachment(attachment.id)} aria-label={`Remove ${attachment.name}`}><span className="material-symbols-outlined text-[16px]">close</span></button></span>)}</div> : null}
            <div className="rounded-xl border border-border bg-surface-2 p-2 focus-within:border-primary">
              {mode !== "stt" ? <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (mode === "chat" && event.key === "Enter" && !event.shiftKey) { event.preventDefault(); requestRun(); } }} rows={3} placeholder={inputPlaceholder(mode)} className="w-full resize-none bg-transparent px-2 py-1 text-sm text-text-main outline-none placeholder:text-text-subtle" /> : null}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {(mode === "chat" || mode === "stt") ? <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-lg p-2 text-text-muted hover:bg-surface hover:text-text-main" aria-label="Attach files"><span className="material-symbols-outlined text-[20px]">attach_file</span></button> : null}
                  {mode === "chat" && activeSession.messages.some((message) => message.role === "assistant") ? <button type="button" onClick={regenerate} disabled={busy} className="rounded-lg p-2 text-text-muted hover:bg-surface hover:text-text-main disabled:opacity-50" aria-label="Regenerate last response"><span className="material-symbols-outlined text-[20px]">refresh</span></button> : null}
                  <input ref={fileInputRef} type="file" multiple={mode !== "stt"} accept={inputAccept(mode)} className="hidden" onChange={handleFiles} />
                </div>
                {busy ? <Button variant="ghost" size="sm" icon="stop" onClick={stop}>Stop</Button> : <Button size="sm" icon="play_arrow" onClick={requestRun} disabled={!activeSession.model}>Run</Button>}
              </div>
            </div>
          </div>
        </footer>
      </main>

      {mode === "embedding" && currentEmbeddingVectors ? <button type="button" onClick={() => navigator.clipboard.writeText(JSON.stringify(currentEmbeddingVectors))} className="fixed bottom-24 right-5 z-20 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white shadow-[var(--shadow-elev)]">Copy current vectors</button> : null}
      <ModelSelectModal isOpen={modelOpen} onClose={() => setModelOpen(false)} onSelect={(model) => { patchSession(activeSession.id, { model: model.value || model.id || model.name }); setModelOpen(false); }} selectedModel={activeSession.model} activeProviders={activeProviders} modelAliases={modelAliases} kindFilter={currentTab.kindFilter} title={`Select ${currentTab.label} model`} />
      <PlaygroundSettingsDrawer isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} mode={mode} settings={activeSession.settings} advanced={activeSession.advanced} tools={activeSession.tools} caps={caps} thinkingLevels={thinkingLevels} onSettingsChange={(settings) => patchSession(activeSession.id, { settings })} onAdvancedChange={(advanced) => patchSession(activeSession.id, { advanced })} onToolsChange={(tools) => patchSession(activeSession.id, { tools })} errors={validation} />
      <ConfirmModal isOpen={Boolean(confirmRun)} onClose={() => setConfirmRun(null)} onConfirm={() => { const run = confirmRun; setConfirmRun(null); setSessions((current) => current.map((session) => session.id === activeSession.id ? { ...session, confirmed: true, updatedAt: Date.now() } : session)); run?.(); }} title={`Run ${currentTab.label}?`} message={`This ${currentTab.label.toLowerCase()} request may use billable provider credits${mode === "image" && activeSession.settings.n > 1 ? ` for ${activeSession.settings.n} outputs` : ""}. This warning appears once for this conversation.`} confirmText="Run" variant="primary" />
    </div>
  );
}
