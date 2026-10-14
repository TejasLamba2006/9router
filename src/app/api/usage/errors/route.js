import { getRequestErrors } from "@/lib/usageDb";

export const dynamic = "force-dynamic";

// Failed upstream requests (exact status + provider text) newer than ?since, oldest first.
// The dashboard polls this for its error toasts. /api/usage is behind the dashboard auth guard.
export async function GET(request) {
  const since = Number(new URL(request.url).searchParams.get("since"));
  return Response.json(
    { events: getRequestErrors(Number.isFinite(since) ? since : 0), now: Date.now() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
