"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";

type NavItem = { href: string; label: string };

const adminTabs: NavItem[] = [
  { href: "/dashboard", label: "Project Dashboard" },
  { href: "/projects", label: "Project Management" },
  { href: "/blockers", label: "Blockers" },
  { href: "/activity", label: "Activity" },
];

const engineerTabs: NavItem[] = [
  { href: "/my-projects", label: "My Projects" },
  { href: "/blockers", label: "Blockers" },
  { href: "/history", label: "History" },
];

type Props = {
  role: "Admin" | "Site Engineer";
  fullName: string;
  orgSlug: string;
  children: React.ReactNode;
};

export function AppShell({ role, fullName, orgSlug, children }: Props) {
  const pathname = usePathname();
  const tabs = role === "Admin" ? adminTabs : engineerTabs;
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-[#f4f6f9] text-zinc-900">
      {/* Desktop Sidebar – dark navy matching screenshots */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col bg-[#0f172a] text-white lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold">
            PF
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">ProjectsFollowUp</p>
            <p className="truncate text-[11px] text-slate-400">ELV & Construction</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Overview
          </p>
          {tabs.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-10 items-center rounded-lg px-3 text-sm font-medium transition ${
                  active
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          {role === "Admin" && (
            <>
              <p className="mb-2 mt-6 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Administration
              </p>
              <Link
                href="/users"
                className={`flex min-h-10 items-center rounded-lg px-3 text-sm font-medium transition ${
                  pathname.startsWith("/users")
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                User Management
              </Link>
              <Link
                href="/settings"
                className={`flex min-h-10 items-center rounded-lg px-3 text-sm font-medium transition ${
                  pathname.startsWith("/settings")
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                Settings
              </Link>
            </>
          )}

          {role === "Site Engineer" && (
            <Link
              href="/settings"
              className={`mt-4 flex min-h-10 items-center rounded-lg px-3 text-sm font-medium transition ${
                pathname.startsWith("/settings")
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              Settings
            </Link>
          )}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-bold">
              {fullName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{fullName}</p>
              <p className="text-[11px] text-slate-400">{role}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: `/login/${orgSlug}` })}
            className="mt-3 w-full rounded-lg border border-white/10 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center border-b border-zinc-200 bg-white px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-xs font-bold text-white">
            PF
          </div>
          <span className="font-semibold tracking-tight">ProjectsFollowUp</span>
        </div>
        <span className="ms-auto truncate text-xs text-zinc-500">{fullName}</span>
      </header>

      <main className="lg:ps-64">
        <div className="mx-auto max-w-7xl px-4 py-5 pb-28 lg:px-6 lg:py-6 lg:pb-8">{children}</div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {tabs.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                active ? "text-blue-600" : "text-zinc-500"
              }`}
            >
              <span
                className={`h-1 w-8 rounded-full ${
                  active ? "bg-blue-600" : "bg-transparent"
                }`}
              />
              {item.label.split(" ").slice(-1)[0]}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            moreOpen || pathname.startsWith("/settings") || pathname.startsWith("/users")
              ? "text-blue-600"
              : "text-zinc-500"
          }`}
        >
          <span
            className={`h-1 w-8 rounded-full ${
              moreOpen || pathname.startsWith("/settings") || pathname.startsWith("/users")
                ? "bg-blue-600"
                : "bg-transparent"
            }`}
          />
          More
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-5 pb-28 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-zinc-200" />
            {role === "Admin" ? (
              <>
                <Link
                  href="/users"
                  onClick={() => setMoreOpen(false)}
                  className="block min-h-12 rounded-lg px-2 py-3 text-sm font-medium hover:bg-zinc-50"
                >
                  User Management
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setMoreOpen(false)}
                  className="block min-h-12 rounded-lg px-2 py-3 text-sm font-medium hover:bg-zinc-50"
                >
                  Settings
                </Link>
              </>
            ) : (
              <Link
                href="/settings"
                onClick={() => setMoreOpen(false)}
                className="block min-h-12 rounded-lg px-2 py-3 text-sm font-medium hover:bg-zinc-50"
              >
                Settings
              </Link>
            )}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: `/login/${orgSlug}` })}
              className="mt-2 block min-h-12 w-full rounded-lg px-2 py-3 text-start text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
