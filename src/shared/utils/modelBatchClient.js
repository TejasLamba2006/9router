export async function consumeModelBatchStream(body, onEvent) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  function flush(lines) {
    for (const raw of lines) {
      if (raw.trim()) onEvent(JSON.parse(raw));
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    flush(lines);
  }
  buffer += decoder.decode();
  flush([buffer]);
}
