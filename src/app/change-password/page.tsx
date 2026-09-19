"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      let data: { error?: string; ok?: boolean } = {};
      try {
        data = await res.json();
      } catch {
        setError("Unexpected server response.");
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || "Failed to change password.");
        setLoading(false);
        return;
      }

      setDone(true);
      // JWT still has old mustChangePassword / tokenVersion — force re-login
      await signOut({ redirect: false });
      router.push("/login/demo");
      router.refresh();
    } catch {
      setError("Something went wrong.");
      setLoading(false);
    }
  }

  if (done) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center bg-zinc-50 px-4">
        <p className="text-sm text-zinc-600">Password updated. Redirecting to login\u2026</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center bg-zinc-50 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-zinc-900">Set a new password</h1>
          <p className="mt-1 text-sm text-zinc-500">
            You must change your password before continuing.
          </p>
        </div>
        <form
          onSubmit={onSubmit}
          className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-zinc-700">New password</label>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-base"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Confirm password</label>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-base"
            />
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Saving\u2026" : "Save password"}
          </button>
        </form>
      </div>
    </main>
  );
}
