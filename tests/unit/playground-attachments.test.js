import { describe, it, expect, vi } from "vitest";
import {
  ATTACHMENT_LIMITS,
  classifyAttachment,
  validateAttachmentBatch,
  extractAttachmentText,
  createAttachmentRecord,
} from "../../src/shared/utils/playgroundAttachments.js";

const MB = 1024 * 1024;
const file = (name, type = "", body = "x") => new File([body], name, { type });
// Size-only stand-in so limit tests don't allocate 20MB+.
const sized = (name, type, size) => ({ name, type, size });

describe("classifyAttachment", () => {
  it.each([
    ["a.png", "image/png", "image"],
    ["a.webp", "", "image"],
    ["a.mp3", "audio/mpeg", "audio"],
    ["a.wav", "", "audio"],
    ["a.pdf", "application/pdf", "pdf"],
    ["a.ts", "", "text"],
    ["notes.md", "text/markdown", "text"],
    ["data.json", "application/json", "text"],
    ["Dockerfile", "", "text"],
    ["icon.svg", "image/svg+xml", "text"],
    ["a.docx", "", "docx"],
    ["a.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
    ["a.pptx", "", "pptx"],
  ])("%s (%s) -> %s", (name, type, kind) => {
    expect(classifyAttachment({ name, type })).toEqual({ ok: true, kind });
  });

  it.each([
    ["a.doc", "application/msword"],
    ["a.xls", ""],
    ["a.ppt", "application/vnd.ms-powerpoint"],
  ])("rejects legacy office %s", (name, type) => {
    expect(classifyAttachment({ name, type })).toEqual({ ok: false, reason: "legacy-office" });
  });

  it.each([
    ["a.exe", "application/x-msdownload"],
    ["blob.bin", "application/octet-stream"],
    ["mystery", ""],
    ["a.zip", "application/zip"],
  ])("rejects unknown binary %s", (name, type) => {
    expect(classifyAttachment({ name, type })).toEqual({ ok: false, reason: "unsupported-type" });
  });
});

describe("validateAttachmentBatch", () => {
  it("accepts within limits and reports rejections", () => {
    const { accepted, rejected } = validateAttachmentBatch([
      sized("a.png", "image/png", 1 * MB),
      sized("a.doc", "", 10),
      sized("huge.pdf", "application/pdf", 21 * MB),
    ]);
    expect(accepted.map((f) => f.name)).toEqual(["a.png"]);
    expect(accepted[0].kind).toBe("image");
    expect(rejected).toEqual([
      { name: "a.doc", reason: "legacy-office" },
      { name: "huge.pdf", reason: "file-too-large" },
    ]);
  });

  it("caps file count including existing attachments", () => {
    const existing = Array.from({ length: 9 }, (_, i) => ({ size: 1, name: `e${i}` }));
    const { accepted, rejected } = validateAttachmentBatch(
      [sized("a.txt", "text/plain", 1), sized("b.txt", "text/plain", 1)],
      existing,
    );
    expect(accepted).toHaveLength(1);
    expect(rejected).toEqual([{ name: "b.txt", reason: "too-many-files" }]);
  });

  it("caps aggregate size at 50MB", () => {
    const { accepted, rejected } = validateAttachmentBatch([
      sized("1.pdf", "application/pdf", 20 * MB),
      sized("2.pdf", "application/pdf", 20 * MB),
      sized("3.pdf", "application/pdf", 11 * MB),
      sized("4.txt", "text/plain", 5 * MB),
    ]);
    expect(accepted.map((f) => f.name)).toEqual(["1.pdf", "2.pdf", "4.txt"]);
    expect(rejected).toEqual([{ name: "3.pdf", reason: "total-too-large" }]);
  });

  it("exposes the agreed limits", () => {
    expect(ATTACHMENT_LIMITS).toEqual({
      maxFiles: 10,
      maxFileBytes: 20 * MB,
      maxTotalBytes: 50 * MB,
      maxTextBytes: 200 * 1024,
    });
  });
});

describe("extractAttachmentText", () => {
  it("reads UTF-8 text directly", async () => {
    const result = await extractAttachmentText(file("a.py", "", "print('héllo')"), { kind: "text" });
    expect(result).toEqual({ text: "print('héllo')", truncated: false });
  });

  it("caps text at 200KB with truncation metadata and no broken trailing char", async () => {
    const body = "a".repeat(200 * 1024 - 1) + "é" + "tail";
    const result = await extractAttachmentText(file("big.txt", "text/plain", body), { kind: "text" });
    expect(result.truncated).toBe(true);
    expect(result.originalBytes).toBe(new TextEncoder().encode(body).length);
    expect(result.text).toBe("a".repeat(200 * 1024 - 1));
  });

  it("rejects text files that contain NUL bytes", async () => {
    await expect(
      extractAttachmentText(file("a.txt", "text/plain", "ab\u0000cd"), { kind: "text" }),
    ).rejects.toThrow(/binary/);
  });

  it("lazy-loads the office parser with safe options and the abort signal", async () => {
    const to = vi.fn(async () => ({ value: "Hello doc" }));
    const parseOffice = vi.fn(async () => ({ to }));
    const loadParser = vi.fn(async () => parseOffice);
    const controller = new AbortController();

    const result = await extractAttachmentText(file("a.docx", "", "PK"), {
      kind: "docx",
      signal: controller.signal,
      loadParser,
    });

    expect(result).toEqual({ text: "Hello doc", truncated: false });
    expect(loadParser).toHaveBeenCalledTimes(1);
    const [input, config] = parseOffice.mock.calls[0];
    expect(input).toBeInstanceOf(Uint8Array);
    expect(config).toMatchObject({
      fileType: "docx",
      ocr: false,
      extractAttachments: false,
      includeRawContent: false,
      abortSignal: controller.signal,
    });
    expect(config.decompressionLimits.maxUncompressedBytes).toBeGreaterThan(0);
    expect(config.decompressionLimits.maxZipEntries).toBeGreaterThan(0);
    expect(to).toHaveBeenCalledWith("text");
  });

  it("caps parser output too", async () => {
    const parseOffice = async () => ({ to: async () => ({ value: "z".repeat(300 * 1024) }) });
    const result = await extractAttachmentText(file("a.pdf", "application/pdf"), {
      kind: "pdf",
      loadParser: async () => parseOffice,
    });
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBe(200 * 1024);
  });

  it("never loads the parser when already aborted", async () => {
    const loadParser = vi.fn();
    const controller = new AbortController();
    controller.abort();
    await expect(
      extractAttachmentText(file("a.pdf", "application/pdf"), { kind: "pdf", signal: controller.signal, loadParser }),
    ).rejects.toThrow();
    expect(loadParser).not.toHaveBeenCalled();
  });

  it("returns null text for image and audio", async () => {
    expect(await extractAttachmentText(file("a.png", "image/png"), { kind: "image" })).toEqual({ text: null, truncated: false });
  });
});

describe("createAttachmentRecord", () => {
  it("builds a record with no data URL", async () => {
    const record = await createAttachmentRecord(file("a.png", "image/png", "img"), { id: "att1", now: () => 42 });
    expect(record).toEqual({
      id: "att1",
      name: "a.png",
      mimeType: "image/png",
      size: 3,
      kind: "image",
      previewable: true,
      text: null,
      truncated: false,
      createdAt: 42,
    });
    expect(JSON.stringify(record)).not.toMatch(/data:/);
  });

  it("marks SVG as non-previewable text", async () => {
    const record = await createAttachmentRecord(file("x.svg", "image/svg+xml", "<svg/>"), { id: "s" });
    expect(record.kind).toBe("text");
    expect(record.previewable).toBe(false);
    expect(record.text).toBe("<svg/>");
  });

  it("throws for rejected files", async () => {
    await expect(createAttachmentRecord(file("a.doc", "application/msword"), {})).rejects.toThrow(/legacy-office/);
  });
});
