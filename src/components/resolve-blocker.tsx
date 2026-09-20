"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResolveBlocker({ blockerId }: { blockerId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    await fetch("/api/blockers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockerId, resolutionNote: note }),
    });
    setLoading(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-10 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white"
      >
        Resolve
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Resolution note (optional)"
        className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
        rows={2}
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={submit}
          className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
        >
          Confirm
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-zinc-500">
          Cancel
        </button>
      </div>
    </div>
  );
}
