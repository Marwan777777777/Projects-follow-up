"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AttachmentUploader } from "@/components/attachment-uploader";

type BoqRow = {
  id: string;
  item_no: string;
  item_description: string;
  unit: string;
  po_qty: string | number;
  delivered_qty: string | number;
  installed_qty: string | number;
  version: number;
};

type Props = {
  projectId: string;
  status: string;
  phase: string;
  boq: BoqRow[];
  storageKey: string;
};

function newId() {
  return crypto.randomUUID();
}

export function DailyUpdateForm({ projectId, status, phase, boq, storageKey }: Props) {
  const router = useRouter();
  const [statusVal, setStatusVal] = useState(status);
  const [phaseVal, setPhaseVal] = useState(phase);
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const row of boq) init[row.id] = String(row.installed_qty);
    return init;
  });
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<Array<{ id: string; item_no: string; latest: { installed_qty: string; version: number } }>>([]);
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);

  const submissionId = useMemo(() => {
    if (typeof window === "undefined") return newId();
    const k = `${storageKey}:sid`;
    const existing = localStorage.getItem(k);
    if (existing) return existing;
    const id = newId();
    localStorage.setItem(k, id);
    return id;
  }, [storageKey]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.notes) setNotes(draft.notes);
      if (draft.statusVal) setStatusVal(draft.statusVal);
      if (draft.phaseVal) setPhaseVal(draft.phaseVal);
      if (draft.qty) setQty((q) => ({ ...q, ...draft.qty }));
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ notes, statusVal, phaseVal, qty, savedAt: Date.now() })
    );
  }, [notes, statusVal, phaseVal, qty, storageKey]);

  async function save(noChange: boolean) {
    setError("");
    setMsg("");
    setConflicts([]);
    setLoading(true);
    const payload = {
      submissionId,
      projectId,
      kind: "daily_update",
      noChange,
      notes,
      projectStatus: statusVal,
      currentPhase: phaseVal,
      clientSubmittedAt: new Date().toISOString(),
      boq: noChange
        ? []
        : boq.map((row) => ({
            id: row.id,
            installedQty: Number(qty[row.id] ?? row.installed_qty),
            version: row.version,
          })),
      attachmentIds,
    };
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.status === 409 && data.details?.conflicts) {
        setConflicts(data.details.conflicts);
        setError("Someone else saved first. Your draft is kept. Review highlighted lines and save again.");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError(data.error || "Save failed");
        setLoading(false);
        return;
      }
      localStorage.removeItem(storageKey);
      localStorage.removeItem(`${storageKey}:sid`);
      setMsg(data.replay ? "Already saved (retry matched)." : noChange ? "No-change check-in saved." : "Daily update saved.");
      router.refresh();
    } catch {
      setError("Not saved \u2014 retry. Your draft is kept.");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="block text-xs font-medium text-zinc-500">Status</span>
          <select
            value={statusVal}
            onChange={(e) => setStatusVal(e.target.value)}
            className="mt-1 w-full min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            {["Not Started Yet", "In Progress", "On Hold", "Delayed", "Completed"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs font-medium text-zinc-500">Phase</span>
          <select
            value={phaseVal}
            onChange={(e) => setPhaseVal(e.target.value)}
            className="mt-1 w-full min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            {[
              "Site Survey",
              "1st Fix Civil & Conduits",
              "2nd Fix Cable Pulling",
              "3rd Fix Device Installation",
              "3rd Fix Testing & Commissioning",
              "Official Handover",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-3 lg:hidden">
        {boq.map((row) => {
          const conflict = conflicts.find((c) => c.id === row.id);
          return (
            <div
              key={row.id}
              className={`rounded-xl border bg-white p-4 ${conflict ? "border-amber-400" : "border-zinc-200"}`}
            >
              <p className="text-xs text-zinc-500">Item {row.item_no}</p>
              <p className="font-medium">{row.item_description}</p>
              <div className="mt-2 flex gap-2 text-xs">
                <span className="rounded-full bg-zinc-100 px-2 py-1">PO {row.po_qty}</span>
                <span className="rounded-full bg-zinc-100 px-2 py-1">Del {row.delivered_qty}</span>
              </div>
              <label className="mt-3 block text-sm">
                Installed ({row.unit})
                <input
                  inputMode="decimal"
                  value={qty[row.id] ?? ""}
                  onChange={(e) => setQty((q) => ({ ...q, [row.id]: e.target.value }))}
                  className="mt-1 w-full min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-lg"
                />
              </label>
              {conflict && (
                <p className="mt-1 text-xs text-amber-700">
                  Latest installed: {conflict.latest.installed_qty}. Re-apply your number and save.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white lg:block">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-2 text-start">Item</th>
              <th className="px-3 py-2 text-start">Description</th>
              <th className="px-3 py-2">PO</th>
              <th className="px-3 py-2">Delivered</th>
              <th className="px-3 py-2">Installed</th>
            </tr>
          </thead>
          <tbody>
            {boq.map((row) => (
              <tr key={row.id} className="border-t border-zinc-100">
                <td className="px-3 py-2 font-mono text-xs">{row.item_no}</td>
                <td className="px-3 py-2">{row.item_description}</td>
                <td className="px-3 py-2 text-center">{row.po_qty}</td>
                <td className="px-3 py-2 text-center">{row.delivered_qty}</td>
                <td className="px-3 py-2">
                  <input
                    inputMode="decimal"
                    value={qty[row.id] ?? ""}
                    onChange={(e) => setQty((q) => ({ ...q, [row.id]: e.target.value }))}
                    className="w-24 rounded border border-zinc-300 px-2 py-1"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AttachmentUploader projectId={projectId} onReadyIdsChange={setAttachmentIds} />

      <label className="block text-sm">
        Notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {msg && <p className="text-sm text-green-700">{msg}</p>}

      <div className="sticky bottom-16 z-10 flex gap-2 bg-zinc-50/95 py-3 lg:static lg:bottom-auto lg:bg-transparent">
        <button
          type="button"
          disabled={loading}
          onClick={() => save(false)}
          className="min-h-11 flex-1 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Saving\u2026" : "Save update"}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => save(true)}
          className="min-h-11 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium disabled:opacity-60"
        >
          No change today
        </button>
      </div>
    </div>
  );
}
