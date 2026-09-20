/**
 * StorageProvider interface — business logic must only depend on this.
 * Drivers: r2 (Cloudflare R2) | dev (temporary in-process placeholder)
 */

export type MultipartPart = {
  partNumber: number;
  etag: string;
};

export type PresignedPutResult = {
  mode: "put";
  key: string;
  url: string;
  headers: Record<string, string>;
  expiresIn: number;
};

export type MultipartPlan = {
  mode: "multipart";
  key: string;
  uploadId: string;
  partSize: number;
  partCount: number;
  expiresIn: number;
};

export type HeadResult = {
  size: number;
  contentType?: string;
  etag?: string;
};

export type PresignedGetOptions = {
  filename: string;
  contentType: string;
  expiresIn?: number;
};

export interface StorageProvider {
  createPresignedPut(
    key: string,
    contentType: string,
    contentLength: number
  ): Promise<PresignedPutResult>;

  createMultipart(
    key: string,
    contentType: string
  ): Promise<{ uploadId: string; key: string }>;

  presignPart(
    key: string,
    uploadId: string,
    partNumber: number
  ): Promise<{ url: string; headers: Record<string, string>; expiresIn: number }>;

  completeMultipart(
    key: string,
    uploadId: string,
    parts: MultipartPart[]
  ): Promise<void>;

  abortMultipart(key: string, uploadId: string): Promise<void>;

  head(key: string): Promise<HeadResult | null>;

  rangedGet(key: string, start: number, end: number): Promise<Buffer>;

  presignedGet(
    key: string,
    opts: PresignedGetOptions
  ): Promise<{ url: string; expiresIn: number }>;

  delete(key: string): Promise<void>;
}
