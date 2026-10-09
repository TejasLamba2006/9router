import { NextResponse } from "next/server";
import { refreshProviderModels } from "@/lib/providerModelRefresh";

// POST /api/providers/refresh-models  { connectionId? } - fetch live model lists now.
// Without connectionId every active provider is refreshed.
export async function POST(request) {
  try {
    const { connectionId } = await request.json().catch(() => ({}));
    if (connectionId !== undefined && (typeof connectionId !== "string" || !connectionId.trim() || connectionId.length > 128)) {
      return NextResponse.json({ error: "Invalid connectionId" }, { status: 400 });
    }
    const results = await refreshProviderModels({ connectionId: connectionId?.trim(), signal: request.signal });
    const added = results.reduce((n, r) => n + r.added, 0);
    return NextResponse.json({ success: true, added, results });
  } catch (error) {
    console.log("Error refreshing provider models:", error);
    return NextResponse.json({ error: "Failed to refresh models" }, { status: 500 });
  }
}
