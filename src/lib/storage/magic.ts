/** Magic-byte verification for finalized uploads (Spec 3.14). */

import type { AllowedExtension } from "./constants";

function startsWith(buf: Buffer, sig: number[]): boolean {
  if (buf.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (buf[i] !== sig[i]) return false;
  }
  return true;
}

function isPng(buf: Buffer): boolean {
  return startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}
function isJpeg(buf: Buffer): boolean {
  return startsWith(buf, [0xff, 0xd8, 0xff]);
}
function isPdf(buf: Buffer): boolean {
  return buf.length >= 4 && buf.subarray(0, 4).toString("ascii") === "%PDF";
}
function isDwg(buf: Buffer): boolean {
  if (buf.length < 6) return false;
  return /^AC10\d{2}/.test(buf.subarray(0, 6).toString("ascii"));
}
function isOle(buf: Buffer): boolean {
  return startsWith(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
}
function isZip(buf: Buffer): boolean {
  return (
    startsWith(buf, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWith(buf, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWith(buf, [0x50, 0x4b, 0x07, 0x08])
  );
}
function isCsv(buf: Buffer): boolean {
  if (buf.includes(0x00)) return false;
  try {
    const text = buf.toString("utf8");
    const bad = (text.match(/\uFFFD/g) || []).length;
    return bad <= 2;
  } catch {
    return false;
  }
}

export function verifyMagicBytes(sample: Buffer, ext: AllowedExtension): boolean {
  switch (ext) {
    case "png": return isPng(sample);
    case "jpg":
    case "jpeg": return isJpeg(sample);
    case "pdf": return isPdf(sample);
    case "dwg": return isDwg(sample);
    case "doc":
    case "xls": return isOle(sample);
    case "docx":
    case "xlsx": return isZip(sample);
    case "csv": return isCsv(sample);
    default: return false;
  }
}

export function contentTypeForVerified(ext: AllowedExtension): {
  contentType: string;
  inlineAllowed: boolean;
} {
  if (ext === "png") return { contentType: "image/png", inlineAllowed: true };
  if (ext === "jpg" || ext === "jpeg") return { contentType: "image/jpeg", inlineAllowed: true };
  return { contentType: "application/octet-stream", inlineAllowed: false };
}

export const MAGIC_SAMPLE_BYTES = 32;
