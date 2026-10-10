"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import ToolCallCard from "./ToolCallCard";
import { hydrateGeneratedResult, safeMediaSrc } from "../playgroundUi";

function Json({ value }) {
  return <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-2 p-3 font-mono text-xs text-text-main">{JSON.stringify(value, null, 2)}</pre>;
}

export default function PlaygroundResult({ message, pendingCallIds, onToolResult, onContinueTools, blobStore }) {
  const [result, setResult] = useState(message.result);

  useEffect(() => {
    let active = true;
    const urls = [];
    hydrateGeneratedResult(message.result, blobStore, (blob) => {
      const url = URL.createObjectURL(blob);
      urls.push(url);
      return url;
    }).then((hydrated) => { if (active) setResult(hydrated); });
    return () => {
      active = false;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [message.result, blobStore]);

  if (message.status === "error") return <p className="whitespace-pre-wrap text-sm text-danger">{message.error || message.content || "Request failed"}</p>;

  if (message.role === "tool") return <pre className="whitespace-pre-wrap break-words font-mono text-xs text-text-main">{message.content}</pre>;

  if (!result || result.kind === "chat") {
    return (
      <div className="space-y-3">
        {message.reasoning_content ? (
          <details className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
            <summary className="cursor-pointer text-text-muted">Reasoning</summary>
            <p className="mt-2 whitespace-pre-wrap break-words text-text-muted">{message.reasoning_content}</p>
          </details>
        ) : null}
        {message.content ? <p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-text-main">{message.content}</p> : null}
        {(message.tool_calls || []).map((call) => (
          <ToolCallCard
            key={call.id}
            call={call}
            onSubmit={pendingCallIds?.has(call.id) ? onToolResult : undefined}
            disabled={message.status === "streaming"}
          />
        ))}
        {message.tool_calls?.length && pendingCallIds?.size === 0 && onContinueTools ? (
          <button type="button" onClick={onContinueTools} className="rounded-md bg-primary px-3 py-1.5 text-xs text-white hover:bg-primary-hover">
            Continue with tool results
          </button>
        ) : null}
      </div>
    );
  }

  if (result.kind === "image") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {result.images.map((image, index) => {
          const src = safeMediaSrc(image.src);
          return src ? (
            <figure key={`${src}-${index}`} className="overflow-hidden rounded-xl border border-border bg-surface-2">
              <Image src={src} alt={image.revisedPrompt || `Generated image ${index + 1}`} width={1024} height={1024} unoptimized crossOrigin="anonymous" referrerPolicy="no-referrer" className="h-auto w-full object-contain" />
              <figcaption className="flex items-center justify-between gap-2 p-2 text-xs text-text-muted">
                <span className="line-clamp-2">{image.revisedPrompt || `Image ${index + 1}`}</span>
                <a href={src} download={`playground-image-${index + 1}`} referrerPolicy="no-referrer" className="text-primary hover:underline">Download</a>
              </figcaption>
            </figure>
          ) : null;
        })}
      </div>
    );
  }

  if (result.kind === "audio") {
    const src = safeMediaSrc(result.src);
    return src ? <div className="space-y-2"><audio src={src} controls crossOrigin="anonymous" className="w-full" /><a href={src} download="playground-audio" referrerPolicy="no-referrer" className="text-sm text-primary hover:underline">Download audio</a></div> : null;
  }

  if (result.kind === "text") return <p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-text-main">{result.text}</p>;

  if (result.kind === "embedding") {
    return (
      <div className="space-y-2">
        {result.vectors.map((vector) => <div key={vector.index} className="rounded-lg border border-border bg-surface-2 p-3"><p className="text-sm text-text-main">Vector {vector.index}: {vector.dimensions ?? "encoded"} dimensions</p><p className="mt-1 break-all font-mono text-xs text-text-muted">{JSON.stringify(vector.preview)}</p></div>)}
        {result.usage ? <p className="text-xs text-text-subtle">Usage: {JSON.stringify(result.usage)}</p> : null}
      </div>
    );
  }

  if (result.kind === "video") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-text-muted">Status: {result.status}</p>
        {result.videos.map((video, index) => {
          const src = safeMediaSrc(video);
          return src ? <div key={`${src}-${index}`} className="space-y-2"><video src={src} controls crossOrigin="anonymous" className="max-h-[32rem] w-full rounded-xl bg-black" /><a href={src} download={`playground-video-${index + 1}`} referrerPolicy="no-referrer" className="text-sm text-primary hover:underline">Download video</a></div> : null;
        })}
      </div>
    );
  }

  return <Json value={result.data ?? result} />;
}
