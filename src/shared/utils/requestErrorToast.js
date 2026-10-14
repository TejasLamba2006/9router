// Copy for the top-right toast shown when an upstream request fails. Shows the exact
// status and provider text so a 403/404/409 is visible without opening the logs.
export function formatRequestErrorToast(event) {
  const target = [event?.provider, event?.model].filter(Boolean).join("/");
  const head = event?.status ? String(event.status) : "Request failed";
  return {
    title: target ? `${head} · ${target}` : head,
    message: event?.message || "No error body returned by the provider",
  };
}

// One poll of /api/usage/errors. `state.since` is the server clock of the previous poll
// and `state.seen` de-dupes ids, so each failure is toasted once, including ones that
// happened while the tab was in the background or reloading.
export async function pollRequestErrors(state, onEvent, fetchImpl = fetch) {
  const res = await fetchImpl(`/api/usage/errors?since=${state.since}`, { cache: "no-store" });
  if (!res.ok) return;
  const { events = [], now } = await res.json();
  for (const event of events) {
    if (state.seen.has(event.id)) continue;
    state.seen.add(event.id);
    onEvent(event);
  }
  if (Number.isFinite(now)) state.since = Math.max(0, now - 1000);
  if (state.seen.size > 200) state.seen = new Set([...state.seen].slice(-100));
}
