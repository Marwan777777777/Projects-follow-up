/**
 * TEMPORARY DEV PLACEHOLDER — remove after R2 goes live.
 * In-memory object store with multipart support for local tests.
 */

import { randomUUID } from "crypto";
import type {
  MultipartPart,
  PresignedGetOptions,
  PresignedPutResult,
  StorageProvider,
} from "./types";
import {
  PRESIGN_GET_EXPIRES_SEC,
  PRESIGN_PART_EXPIRES_SEC,
  PRESIGN_PUT_EXPIRES_SEC,
} from "./constants";

type StoredObject = { bytes: Buffer; contentType?: string };
type MultipartSession = { key: string; contentType: string; parts: Map<number, Buffer> };

const objects = new Map<string, StoredObject>();
const multiparts = new Map<string, MultipartSession>();
const putTokens = new Map<string, { key: string; contentType: string; contentLength: number; expires: number }>();
const getTokens = new Map<string, { key: string; filename: string; contentType: string; expires: number }>();
const partTokens = new Map<string, { key: string; uploadId: string; partNumber: number; expires: number }>();

function assertDevMode() {
  if (process.env.STORAGE_DRIVER !== "dev") {
    throw new Error("Dev storage driver refused to load: STORAGE_DRIVER is not 'dev'");
  }
}

function baseUrl(): string {
  const base = process.env.DEV_STORAGE_BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  return base.replace(/\/$/, "");
}

export function createDevProvider(): StorageProvider {
  assertDevMode();
  return {
    async createPresignedPut(key, contentType, contentLength): Promise<PresignedPutResult> {
      const token = randomUUID();
      putTokens.set(token, { key, contentType, contentLength, expires: Date.now() + PRESIGN_PUT_EXPIRES_SEC * 1000 });
      return {
        mode: "put",
        key,
        url: `${baseUrl()}/api/dev-storage/put?token=${token}`,
        headers: { "Content-Type": contentType, "Content-Length": String(contentLength) },
        expiresIn: PRESIGN_PUT_EXPIRES_SEC,
      };
    },
    async createMultipart(key, contentType) {
      const uploadId = randomUUID();
      multiparts.set(uploadId, { key, contentType, parts: new Map() });
      return { uploadId, key };
    },
    async presignPart(key, uploadId, partNumber) {
      if (!multiparts.has(uploadId)) throw new Error("Unknown multipart uploadId");
      const token = randomUUID();
      partTokens.set(token, { key, uploadId, partNumber, expires: Date.now() + PRESIGN_PART_EXPIRES_SEC * 1000 });
      return { url: `${baseUrl()}/api/dev-storage/part?token=${token}`, headers: {}, expiresIn: PRESIGN_PART_EXPIRES_SEC };
    },
    async completeMultipart(key, uploadId, parts: MultipartPart[]) {
      const session = multiparts.get(uploadId);
      if (!session) throw new Error("Unknown multipart uploadId");
      if (session.key !== key) throw new Error("Multipart key mismatch");
      const ordered = parts.slice().sort((a, b) => a.partNumber - b.partNumber);
      const chunks: Buffer[] = [];
      for (const p of ordered) {
        const buf = session.parts.get(p.partNumber);
        if (!buf) throw new Error(`Missing part ${p.partNumber}`);
        chunks.push(buf);
      }
      objects.set(key, { bytes: Buffer.concat(chunks), contentType: session.contentType });
      multiparts.delete(uploadId);
    },
    async abortMultipart(_key, uploadId) { multiparts.delete(uploadId); },
    async head(key) {
      const obj = objects.get(key);
      if (!obj) return null;
      return { size: obj.bytes.length, contentType: obj.contentType };
    },
    async rangedGet(key, start, end) {
      const obj = objects.get(key);
      if (!obj) throw new Error("Object not found");
      return obj.bytes.subarray(start, end + 1);
    },
    async presignedGet(key, opts: PresignedGetOptions) {
      if (!objects.has(key)) throw new Error("Object not found");
      const token = randomUUID();
      const expiresIn = opts.expiresIn ?? PRESIGN_GET_EXPIRES_SEC;
      getTokens.set(token, { key, filename: opts.filename, contentType: opts.contentType, expires: Date.now() + expiresIn * 1000 });
      return { url: `${baseUrl()}/api/dev-storage/get?token=${token}`, expiresIn };
    },
    async delete(key) { objects.delete(key); },
  };
}

export function devConsumePutToken(token: string) {
  const t = putTokens.get(token);
  if (!t || t.expires < Date.now()) { putTokens.delete(token); return null; }
  return t;
}
export function devStoreObject(key: string, bytes: Buffer, contentType?: string) {
  objects.set(key, { bytes, contentType });
}
export function devConsumePartToken(token: string) {
  const t = partTokens.get(token);
  if (!t || t.expires < Date.now()) { partTokens.delete(token); return null; }
  return t;
}
export function devStorePart(uploadId: string, partNumber: number, bytes: Buffer): string {
  const session = multiparts.get(uploadId);
  if (!session) throw new Error("Unknown multipart uploadId");
  session.parts.set(partNumber, bytes);
  return `"dev-part-${partNumber}-${bytes.length}"`;
}
export function devConsumeGetToken(token: string) {
  const t = getTokens.get(token);
  if (!t || t.expires < Date.now()) { getTokens.delete(token); return null; }
  return t;
}
export function devGetObject(key: string): StoredObject | null {
  return objects.get(key) ?? null;
}
export function devReset() {
  objects.clear(); multiparts.clear(); putTokens.clear(); getTokens.clear(); partTokens.clear();
}
