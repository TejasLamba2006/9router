import { statsEmitter } from "@/lib/usageDb";

export const dynamic = "force-dynamic";

// Server-sent stream of failed upstream requests (exact status + provider text) so the
// dashboard can raise a toast. /api/usage is already behind the dashboard auth guard.
export async function GET() {
  const encoder = new TextEncoder();
  const state = { closed: false, keepalive: null, onError: null };

  const cleanup = () => {
    state.closed = true;
    if (state.onError) statsEmitter.off("requestError", state.onError);
    clearInterval(state.keepalive);
  };

  const stream = new ReadableStream({
    start(controller) {
      state.onError = (event) => {
        if (state.closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          cleanup();
        }
      };
      statsEmitter.on("requestError", state.onError);

      controller.enqueue(encoder.encode(": ready\n\n"));
      state.keepalive = setInterval(() => {
        if (state.closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          cleanup();
        }
      }, 25000);
    },
    cancel: cleanup,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
