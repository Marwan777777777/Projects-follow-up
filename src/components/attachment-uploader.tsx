"use client";

import { useCallback, useState } from "react";

export type LocalAttachment = {
  localId: string;
  attachmentId?: string;
  fileName: string;
  sizeBytes: number;
  status: "queued" | "uploading" | "finalizing" | "ready" | "error";
  progress: number;
  error?: string;
};

type Props = {
  projectId: string;
  onReadyIdsChange: (ids: string[]) => void;
  lateArrival?: boolean;
};

function newLocalId() {
  return crypto.randomUUID();
}

export function AttachmentUploader({
  projectId,
  onReadyIdsChange,
  lateArrival = false,
}: Props) {
  const [items, setItems] = useState<LocalAttachment[]>([]);

  const publishReady = useCallback(
    (list: LocalAttachment[]) => {
      const ids = list
        .filter((i) => i.status === "ready" && i.attachmentId)
        .map((i) => i.attachmentId!);
      onReadyIdsChange(ids);
    },
    [onReadyIdsChange]
  );

  function updateItem(localId: string, patch: Partial<LocalAttachment>) {
    setItems((prev) => {
      const next = prev.map((i) =>
        i.localId === localId ? { ...i, ...patch } : i
      );
      publishReady(next);
      return next;
    });
  }

  function removeItem(localId: string) {
    setItems((prev) => {
      const next = prev.filter((i) => i.localId !== localId);
      publishReady(next);
      return next;
    });
  }

  async function uploadFile(file: File) {
    const localId = newLocalId();
    setItems((prev) => [
      ...prev,
      {
        localId,
        fileName: file.name,
        sizeBytes: file.size,
        status: "queued",
        progress: 0,
      },
    ]);

    try {
      updateItem(localId, { status: "uploading", progress: 5 });
      const reqRes = await fetch("/api/attachments/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        }),
      });
      const reqBody = await reqRes.json();
      if (!reqRes.ok) throw new Error(reqBody.error || "Upload request failed");
      const attachmentId = reqBody.attachmentId as string;
      updateItem(localId, { attachmentId, progress: 15 });

      if (reqBody.mode === "put") {
        const putRes = await fetch(reqBody.url, {
          method: "PUT",
          headers: reqBody.headers || { "Content-Type": file.type },
          body: file,
        });
        if (!putRes.ok) throw new Error("Direct upload failed");
        updateItem(localId, { progress: 80, status: "finalizing" });
      } else if (reqBody.mode === "multipart") {
        const partSize = reqBody.partSize as number;
        const partCount = reqBody.partCount as number;
        const parts: Array<{ partNumber: number; etag: string }> = [];
        for (let i = 0; i < partCount; i++) {
          const partNumber = i + 1;
          const start = i * partSize;
          const end = Math.min(file.size, start + partSize);
          const blob = file.slice(start, end);
          const partMeta = await fetch("/api/attachments/multipart-part", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attachmentId, partNumber }),
          });
          const partBody = await partMeta.json();
          if (!partMeta.ok) throw new Error(partBody.error || `Part ${partNumber} presign failed`);
          let lastErr: Error | null = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const up = await fetch(partBody.url, { method: "PUT", body: blob });
              if (!up.ok) throw new Error(`Part ${partNumber} upload failed`);
              const etag = up.headers.get("ETag") || up.headers.get("etag") || `"part-${partNumber}"`;
              parts.push({ partNumber, etag });
              lastErr = null;
              break;
            } catch (e) {
              lastErr = e instanceof Error ? e : new Error(String(e));
            }
          }
          if (lastErr) throw lastErr;
          updateItem(localId, { progress: 15 + Math.round(((i + 1) / partCount) * 65) });
        }
        updateItem(localId, { status: "finalizing", progress: 85 });
        const finRes = await fetch("/api/attachments/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attachmentId, parts, projectId, lateArrival }),
        });
        const finBody = await finRes.json();
        if (!finRes.ok) throw new Error(finBody.error || "Finalize failed");
        updateItem(localId, { status: "ready", progress: 100, attachmentId });
        return;
      }

      const finRes = await fetch("/api/attachments/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachmentId, projectId, lateArrival }),
      });
      const finBody = await finRes.json();
      if (!finRes.ok) throw new Error(finBody.error || "Finalize failed");
      updateItem(localId, { status: "ready", progress: 100, attachmentId });
    } catch (e) {
      updateItem(localId, {
        status: "error",
        error: e instanceof Error ? e.message : "Upload failed",
      });
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    Array.from(files).forEach((f) => { void uploadFile(f); });
    e.target.value = "";
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Attachments</label>
      <input
        type="file"
        multiple
        accept=".png,.jpg,.jpeg,.pdf,.dwg,.doc,.docx,.xls,.xlsx,.csv,image/*,application/pdf"
        capture="environment"
        onChange={onPick}
        className="block w-full text-sm file:me-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
      />
      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.localId}
              className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate font-medium">{item.fileName}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  item.status === "ready"
                    ? "bg-emerald-100 text-emerald-800"
                    : item.status === "error"
                      ? "bg-red-100 text-red-800"
                      : "bg-amber-100 text-amber-800"
                }`}
              >
                {item.status === "uploading" || item.status === "finalizing"
                  ? `${item.progress}%`
                  : item.status}
              </span>
              {item.error && <span className="w-full text-xs text-red-600">{item.error}</span>}
              <button type="button" onClick={() => removeItem(item.localId)} className="text-xs text-slate-600 underline">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-500">
        Uploads run independently. Save is never blocked by a failed or in-progress file.
      </p>
    </div>
  );
}
