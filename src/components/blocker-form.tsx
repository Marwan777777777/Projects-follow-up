"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AttachmentUploader } from "@/components/attachment-uploader";

export function BlockerForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"Low" | "Medium" | "High">("Medium");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/blockers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, description, severity, attachmentIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed");
        setLoading(false);
        return;
      }
      setDescription("");
      setAttachmentIds([]);
      setOpen(false);
      router.refresh();
    } catch {
      setError("Something went wrong");
    }
    setLoading(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 w-full rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700"
      >
        Report a blocker
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="fixed inset-0 z-40 bg-white p-4 lg:static lg:rounded-xl lg:border lg:border-zinc-200 lg:p-4">
      <div className="mx-auto flex h-full max-w-lg flex-col">
        <h2 className="text-lg font-semibold">Report a blocker</h2>
        <label className="mt-4 block text-sm">
          What is blocking work?
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
          />
        </label>
        <div className="mt-4 flex gap-2">
          {(["Low", "Medium", "High"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSeverity(s)}
              className={`min-h-11 flex-1 rounded-lg border text-sm font-medium ${
                severity === s ? "border-blue-600 bg-blue-50 text-blue-700" : "border-zinc-300"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <AttachmentUploader projectId={projectId} onReadyIdsChange={setAttachmentIds} />
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-auto flex gap-2 pt-6 lg:mt-6">
          <button
            type="submit"
            disabled={loading}
            className="min-h-11 flex-1 rounded-lg bg-red-600 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Sending…" : "Submit blocker"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="min-h-11 rounded-lg border border-zinc-300 px-4 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
