/** Attachment upload limits and abuse controls (Spec 3.13–3.17). */

export const ALLOWED_EXTENSIONS = [
  "png", "jpg", "jpeg", "pdf", "dwg", "doc", "docx", "xls", "xlsx", "csv",
] as const;

export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

export const ALLOWED_MIME_TYPES: Record<string, AllowedExtension[]> = {
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/jpg": ["jpg", "jpeg"],
  "application/pdf": ["pdf"],
  "application/acad": ["dwg"],
  "application/x-acad": ["dwg"],
  "application/dwg": ["dwg"],
  "image/vnd.dwg": ["dwg"],
  "application/msword": ["doc"],
  "application/vnd.ms-excel": ["xls"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "text/csv": ["csv"],
  "application/csv": ["csv"],
  "text/plain": ["csv"],
};

export const SIZE_LIMITS_BYTES: Record<AllowedExtension, number> = {
  png: 25 * 1024 * 1024,
  jpg: 25 * 1024 * 1024,
  jpeg: 25 * 1024 * 1024,
  pdf: 25 * 1024 * 1024,
  doc: 25 * 1024 * 1024,
  docx: 25 * 1024 * 1024,
  xls: 25 * 1024 * 1024,
  xlsx: 25 * 1024 * 1024,
  csv: 25 * 1024 * 1024,
  dwg: 200 * 1024 * 1024,
};

export const MULTIPART_THRESHOLD_BYTES = 25 * 1024 * 1024;
export const MULTIPART_PART_SIZE_BYTES = 10 * 1024 * 1024;
export const ORG_STORAGE_QUOTA_BYTES = 5 * 1024 * 1024 * 1024;
export const UPLOAD_REQUEST_LIMIT = 30;
export const UPLOAD_REQUEST_WINDOW_MS = 60 * 60 * 1000;
export const FINALIZE_REQUEST_LIMIT = 60;
export const FINALIZE_REQUEST_WINDOW_MS = 60 * 60 * 1000;
export const PENDING_ATTACHMENT_TTL_MS = 24 * 60 * 60 * 1000;
export const PRESIGN_PUT_EXPIRES_SEC = 15 * 60;
export const PRESIGN_GET_EXPIRES_SEC = 5 * 60;
export const PRESIGN_PART_EXPIRES_SEC = 15 * 60;

export function extensionOf(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  const i = base.lastIndexOf(".");
  if (i < 0) return "";
  return base.slice(i + 1).toLowerCase();
}

export function sizeLimitFor(ext: string): number | null {
  if ((ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return SIZE_LIMITS_BYTES[ext as AllowedExtension];
  }
  return null;
}

export function sanitizeFilename(name: string): string {
  let base = name.split(/[/\\]/).pop() ?? name;
  base = base.replace(/[\x00-\x1f\x7f"<>|:*?]/g, "_").trim();
  if (!base || base === "." || base === "..") base = "file";
  if (base.length > 180) {
    const ext = extensionOf(base);
    const stem = base.slice(0, 160);
    base = ext ? `${stem}.${ext}` : stem;
  }
  return base;
}

export function contentDispositionAttachment(filename: string): string {
  const safe = sanitizeFilename(filename);
  const encoded = encodeURIComponent(safe).replace(/['()]/g, escape);
  return `attachment; filename="${safe.replace(/"/g, "")}"; filename*=UTF-8''${encoded}`;
}
