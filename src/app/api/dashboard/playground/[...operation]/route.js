import { dispatchPlaygroundRequest } from "@/lib/playgroundGateway.js";

export const maxDuration = 300;

async function dispatch(request, { params }) {
  const { operation } = await params;
  return dispatchPlaygroundRequest(request, operation);
}

export const POST = dispatch;
export const GET = dispatch;
