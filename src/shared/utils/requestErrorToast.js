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
