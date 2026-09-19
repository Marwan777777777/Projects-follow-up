"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  lockedOrgSlug?: string;
};

export function LoginForm({ lockedOrgSlug }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [orgSlug, setOrgSlug] = useState(lockedOrgSlug || "");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        orgSlug: orgSlug.trim().toLowerCase(),
        identifier: identifier.trim(),
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Invalid organization, username, or password.");
        setLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="orgSlug" className="block text-sm font-medium text-zinc-700">
            Organization code
          </label>
          <input
            id="orgSlug"
            name="orgSlug"
            type="text"
            autoComplete="organization"
            required
            disabled={!!lockedOrgSlug}
            value={orgSlug}
            onChange={(e) => setOrgSlug(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-zinc-100 disabled:text-zinc-500"
            placeholder="e.g. demo"
          />
          {lockedOrgSlug && (
            <p className="mt-1 text-xs text-zinc-500">
              Not your organization?{" "}
              <a href="/login" className="text-blue-600 underline">
                Switch
              </a>
            </p>
          )}
        </div>

        <div>
          <label htmlFor="identifier" className="block text-sm font-medium text-zinc-700">
            Username or email
          </label>
          <input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
        >
          {loading ? "Signing in\u2026" : "Sign in"}
        </button>
      </div>
    </form>
  );
}
