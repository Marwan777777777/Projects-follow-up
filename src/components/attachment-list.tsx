"use client";

import { useState } from "react";

type Attachment = {
  id: string;
  file_name: string;
  file_type: string;
  size_bytes: number | string;
  uploaded_at?: string | null;
  created_at?: string;
};

export function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  const [error, setError] = useState("");

  if (!attachments?.length) {
    return <p className="text-sm text-zinc-500">No attachments yet.</p>;
  }

  async function download(id: string) {
    setError("");
    try {
      const res = await fetch(`/api/attachments/${id}/download`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Download failed");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Download failed");
    }
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="space-y-2">
        {attachments.map((a) => (
          <li
            key={a.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            <span className="min-w-0 flex-1 truncate font-medium">{a.file_name}</span>
            <span className="text-xs text-zinc-500">
              .{a.file_type} · {Math.round(Number(a.size_bytes) / 1024)} KB
            </span>
            <button
              type="button"
              onClick={() => download(a.id)}
              className="min-h-11 rounded-lg border border-zinc-300 px-3 text-xs font-medium"
            >
              Download
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
