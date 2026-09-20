/**
 * Local file storage — replaces Supabase Storage entirely (Phase 2).
 * Files are written under data/uploads/<category>/<uuid><ext> on disk
 * (mounted as a persistent Docker volume — see docker-compose.yml).
 *
 * Server-only module (touches node:fs). Anything that imports this from a
 * *.functions.ts file MUST do so with a dynamic `await import(...)` inside a
 * createServerFn `.handler()` callback (never a static top-level import) --
 * a static import pulls `node:fs` into the client bundle and crashes with
 * "Module node:fs has been externalized for browser compatibility" the
 * moment any page importing that module renders. See auth-middleware.ts for
 * the same pattern with auth-server.ts.
 */
import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export type UploadCategory = "package-images" | "attachments" | "company-assets";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // 15MB (PDF or photo)

const IMAGE_MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const ATTACHMENT_MIME_EXT: Record<string, string> = {
  ...IMAGE_MIME_EXT,
  "application/pdf": ".pdf",
};

export const IMAGE_UPLOAD_OPTS = { allowed: IMAGE_MIME_EXT, maxBytes: MAX_IMAGE_BYTES };
export const ATTACHMENT_UPLOAD_OPTS = { allowed: ATTACHMENT_MIME_EXT, maxBytes: MAX_ATTACHMENT_BYTES };

function uploadRoot(): string {
  return process.env["UPLOAD_DIR"] ?? path.join(process.cwd(), "data", "uploads");
}

function extFor(mime: string, allowed: Record<string, string>, originalName: string): string {
  if (allowed[mime]) return allowed[mime];
  const fromName = path.extname(originalName).toLowerCase();
  return fromName || "";
}

function decodeDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("صيغة الملف غير صالحة");
  return { mime: match[1]!, buffer: Buffer.from(match[2]!, "base64") };
}

/**
 * Decodes a data: URL and writes it to disk under the given category,
 * returning the relative path (e.g. "package-images/<uuid>.jpg") to store
 * in the DB.
 */
export async function writeUpload(
  category: UploadCategory,
  dataUrl: string,
  originalName: string,
  opts: { allowed: Record<string, string>; maxBytes: number },
): Promise<{ relativePath: string; mime: string; size: number }> {
  const { mime, buffer } = decodeDataUrl(dataUrl);
  if (!opts.allowed[mime]) {
    throw new Error("صيغة الملف غير مدعومة");
  }
  if (buffer.length > opts.maxBytes) {
    throw new Error(`الملف أكبر من الحد المسموح (${Math.round(opts.maxBytes / 1024 / 1024)} م.ب)`);
  }
  const dir = path.join(uploadRoot(), category);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${crypto.randomUUID()}${extFor(mime, opts.allowed, originalName)}`;
  await fs.writeFile(path.join(dir, filename), buffer);
  return { relativePath: `${category}/${filename}`, mime, size: buffer.length };
}

/** Reads a previously-written upload back off disk. */
export async function readUpload(relativePath: string): Promise<{ buffer: Buffer } | null> {
  const root = uploadRoot();
  const full = path.join(root, relativePath);
  // Guard against path traversal — the resolved path must stay under root.
  if (!full.startsWith(path.join(root, path.sep)) && full !== root) return null;
  try {
    const buffer = await fs.readFile(full);
    return { buffer };
  } catch {
    return null;
  }
}

export async function deleteUpload(relativePath: string): Promise<void> {
  const root = uploadRoot();
  const full = path.join(root, relativePath);
  if (!full.startsWith(path.join(root, path.sep))) return;
  await fs.unlink(full).catch(() => {});
}
