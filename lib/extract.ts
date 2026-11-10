// Server-side text extraction for uploaded files. Everything runs locally (no external service).
// Returns "" for files THEO can't read (images, archives, unknown binaries) — they're still stored.

export const MAX_TEXT_CHARS = 100_000;

const TEXT_EXT = new Set(["txt", "md", "markdown", "csv", "tsv", "json", "log", "ics", "xml", "yaml", "yml", "ini", "rtf", "tex", "eml"]);
const HTML_EXT = new Set(["html", "htm"]);

const ext = (name: string) => (name.split(".").pop() ?? "").toLowerCase();

function decodeText(buf: Buffer): string {
  const t = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  // Mostly replacement characters / NULs → it's binary, not text.
  const bad = (t.match(/[�\u0000]/g) ?? []).length;
  return bad > t.length * 0.02 ? "" : t;
}

function tidy(s: string): string {
  return s.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_TEXT_CHARS);
}

function stripHtml(h: string): string {
  return h
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|br)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([p, new Promise<T>((_, rej) => { timer = setTimeout(() => rej(new Error("timeout")), ms); })]).finally(() => clearTimeout(timer));
}

export async function extractText(name: string, mime: string, buf: Buffer): Promise<string> {
  const e = ext(name);
  try {
    if (e === "pdf" || mime === "application/pdf") {
      const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
      const pdf = await withTimeout(getDocumentProxy(new Uint8Array(buf)), 15_000);
      const { text } = await withTimeout(pdfText(pdf, { mergePages: true }), 15_000);
      return tidy(String(text));
    }
    if (e === "docx") {
      const mammoth = (await import("mammoth")).default;
      const { value } = await withTimeout(mammoth.extractRawText({ buffer: buf }), 15_000);
      return tidy(value);
    }
    if (HTML_EXT.has(e) || mime === "text/html") return tidy(stripHtml(decodeText(buf)));
    if (TEXT_EXT.has(e) || mime.startsWith("text/") || mime === "application/json") return tidy(decodeText(buf));
  } catch (err) {
    console.error(`extractText failed for ${name}:`, err instanceof Error ? err.message : err);
  }
  return "";
}
