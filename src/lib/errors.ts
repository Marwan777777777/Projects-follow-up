export class AppError extends Error {
  status: number;
  payload?: unknown;

  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export function jsonError(e: unknown, fallback = "Request failed") {
  if (e instanceof AppError) {
    return {
      status: e.status,
      body: { error: e.message, ...(e.payload ? { details: e.payload } : {}) },
    };
  }
  const msg = e instanceof Error ? e.message : fallback;
  const status =
    msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 400;
  return { status, body: { error: msg } };
}
