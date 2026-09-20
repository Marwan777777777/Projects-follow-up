/**
 * StorageProvider factory. Business logic imports only from here / types.
 */

import type { StorageProvider } from "./types";

export type {
  StorageProvider,
  MultipartPart,
  PresignedPutResult,
  MultipartPlan,
  HeadResult,
  PresignedGetOptions,
} from "./types";
export * from "./constants";
export * from "./magic";

let cached: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (cached) return cached;
  const driver = (process.env.STORAGE_DRIVER || "dev").toLowerCase();
  if (driver === "r2") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createR2Provider } = require("./r2") as typeof import("./r2");
    cached = createR2Provider();
    return cached;
  }
  if (driver === "dev") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createDevProvider } = require("./dev") as typeof import("./dev");
    cached = createDevProvider();
    return cached;
  }
  throw new Error(`Unknown STORAGE_DRIVER="${driver}". Use "r2" or "dev".`);
}

export function resetStorageProviderCache() {
  cached = null;
}
