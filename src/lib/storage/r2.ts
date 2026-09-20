/**
 * Cloudflare R2 driver (S3-compatible).
 * Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 */

import {
  S3Client, PutObjectCommand, CreateMultipartUploadCommand, UploadPartCommand,
  CompleteMultipartUploadCommand, AbortMultipartUploadCommand, HeadObjectCommand,
  GetObjectCommand, DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { MultipartPart, PresignedGetOptions, PresignedPutResult, StorageProvider } from "./types";
import {
  contentDispositionAttachment, PRESIGN_GET_EXPIRES_SEC, PRESIGN_PART_EXPIRES_SEC, PRESIGN_PUT_EXPIRES_SEC,
} from "./constants";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`R2 driver requires ${name}`);
  return v;
}

function createClient(): { client: S3Client; bucket: string } {
  const accountId = requireEnv("R2_ACCOUNT_ID");
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");
  const bucket = requireEnv("R2_BUCKET");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return { client, bucket };
}

export function createR2Provider(): StorageProvider {
  const { client, bucket } = createClient();
  return {
    async createPresignedPut(key, contentType, contentLength): Promise<PresignedPutResult> {
      const command = new PutObjectCommand({
        Bucket: bucket, Key: key, ContentType: contentType, ContentLength: contentLength,
      });
      const url = await getSignedUrl(client, command, { expiresIn: PRESIGN_PUT_EXPIRES_SEC });
      return {
        mode: "put", key, url,
        headers: { "Content-Type": contentType, "Content-Length": String(contentLength) },
        expiresIn: PRESIGN_PUT_EXPIRES_SEC,
      };
    },
    async createMultipart(key, contentType) {
      const res = await client.send(new CreateMultipartUploadCommand({
        Bucket: bucket, Key: key, ContentType: contentType,
      }));
      if (!res.UploadId) throw new Error("R2 createMultipart: missing UploadId");
      return { uploadId: res.UploadId, key };
    },
    async presignPart(key, uploadId, partNumber) {
      const command = new UploadPartCommand({
        Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: partNumber,
      });
      const url = await getSignedUrl(client, command, { expiresIn: PRESIGN_PART_EXPIRES_SEC });
      return { url, headers: {}, expiresIn: PRESIGN_PART_EXPIRES_SEC };
    },
    async completeMultipart(key, uploadId, parts: MultipartPart[]) {
      await client.send(new CompleteMultipartUploadCommand({
        Bucket: bucket, Key: key, UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.slice().sort((a, b) => a.partNumber - b.partNumber).map((p) => ({
            ETag: p.etag, PartNumber: p.partNumber,
          })),
        },
      }));
    },
    async abortMultipart(key, uploadId) {
      await client.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }));
    },
    async head(key) {
      try {
        const res = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return { size: res.ContentLength ?? 0, contentType: res.ContentType, etag: res.ETag };
      } catch (e: unknown) {
        const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
        if (err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) return null;
        throw e;
      }
    },
    async rangedGet(key, start, end) {
      const res = await client.send(new GetObjectCommand({
        Bucket: bucket, Key: key, Range: `bytes=${start}-${end}`,
      }));
      const body = res.Body;
      if (!body) return Buffer.alloc(0);
      const bytes = await body.transformToByteArray();
      return Buffer.from(bytes);
    },
    async presignedGet(key, opts: PresignedGetOptions) {
      const expiresIn = opts.expiresIn ?? PRESIGN_GET_EXPIRES_SEC;
      const command = new GetObjectCommand({
        Bucket: bucket, Key: key,
        ResponseContentDisposition: contentDispositionAttachment(opts.filename),
        ResponseContentType: opts.contentType,
      });
      const url = await getSignedUrl(client, command, { expiresIn });
      return { url, expiresIn };
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}
