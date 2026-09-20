"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type UserOption = {
  id: string;
  full_name: string;
  username: string;
  role: string;
};

export function ProjectActions({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<null | "boq" | "assign" | "user">(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [itemNo, setItemNo] = useState("1");
  const [desc, setDesc] = useState("");
  const [unit, setUnit] = useState("EA");
  const [poQty, setPoQty] = useState("1");

  const [users, setUsers] = useState<UserOption[]>([]);
  const [userId, setUserId] = useState("");

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [tempPass, setTempPass] = useState("");
  const [deliveredQty, setDeliveredQty] = useState("1");

  useEffect(() => {
    if (mode === "assign") {
      fetch("/api/users?role=Site%20Engineer")
        .then((r) => r.json())
        .then((d) => {
          setUsers(d.users || []);
          if (d.users?.[0]) setUserId(d.users[0].id);
        })
        .catch(() => setError("Failed to load engineers"));
    }
  }, [mode]);

  async function submitBoq(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const qty = Number(poQty);
    if (!Number.isFinite(qty) || qty < 0) {
      setError("Invalid quantity");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/projects/${projectId}/boq`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              itemNo,
              itemDescription: desc,
              unit,
              poQty: qty,
              deliveredQty: Number(deliveredQty),
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed");
        setLoading(false);
        return;
      }
      setMsg("BOQ item added");
      setMode(null);
      setDesc("");
      router.refresh();
    } catch {
      setError("Something went wrong");
    }
    setLoading(false);
  }

  async function submitAssign(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed");
        setLoading(false);
        return;
      }
      setMsg("Engineer assigned");
      setMode(null);
      router.refresh();
    } catch {
      setError("Something went wrong");
    }
    setLoading(false);
  }

  async function submitUser(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, username, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed");
        setLoading(false);
        return;
      }
      setTempPass(data.tempPassword || "");
      setMsg(`Engineer created: ${data.user.username}`);
      setMode(null);
      setFullName("");
      setUsername("");
      router.refresh();
    } catch {
      setError("Something went wrong");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => {
            setMode(mode === "boq" ? null : "boq");
            setError("");
          }}
          className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
        >
          + BOQ
        </button>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "assign" ? null : "assign");
            setError("");
          }}
          className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
        >
          Assign
        </button>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "user" ? null : "user");
            setError("");
          }}
          className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
        >
          + Engineer
        </button>
      </div>

      {msg && <p className="text-xs text-green-700">{msg}</p>}
      {tempPass && (
        <p className="text-xs text-amber-700">
          Temp password: <code className="font-mono">{tempPass}</code> (save it)
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {mode === "boq" && (
        <form onSubmit={submitBoq} className="rounded border border-zinc-200 bg-zinc-50 p-2 space-y-2 text-xs">
          <div className="grid grid-cols-4 gap-2">
            <input
              placeholder="Item no"
              value={itemNo}
              onChange={(e) => setItemNo(e.target.value)}
              required
              className="rounded border px-2 py-1"
            />
            <input
              placeholder="Description"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              required
              className="col-span-2 rounded border px-2 py-1"
            />
            <input
              placeholder="Unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="rounded border px-2 py-1"
            />
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="PO qty"
              value={poQty}
              onChange={(e) => setPoQty(e.target.value)}
              required
              className="w-24 rounded border px-2 py-1"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Delivered"
              value={deliveredQty}
              onChange={(e) => setDeliveredQty(e.target.value)}
              className="w-24 rounded border px-2 py-1"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-60"
            >
              {loading ? "…" : "Add"}
            </button>
          </div>
        </form>
      )}

      {mode === "assign" && (
        <form onSubmit={submitAssign} className="rounded border border-zinc-200 bg-zinc-50 p-2 space-y-2 text-xs">
          {users.length === 0 ? (
            <p className="text-zinc-500">No engineers. Create one first.</p>
          ) : (
            <>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full rounded border px-2 py-1"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.username})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={loading || !userId}
                className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-60"
              >
                {loading ? "…" : "Assign"}
              </button>
            </>
          )}
        </form>
      )}

      {mode === "user" && (
        <form onSubmit={submitUser} className="rounded border border-zinc-200 bg-zinc-50 p-2 space-y-2 text-xs">
          <input
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="w-full rounded border px-2 py-1"
          />
          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full rounded border px-2 py-1"
          />
          <input
            type="email"
            placeholder="Email (required)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded border px-2 py-1"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-60"
          >
            {loading ? "…" : "Create Site Engineer"}
          </button>
        </form>
      )}
    </div>
  );
}
