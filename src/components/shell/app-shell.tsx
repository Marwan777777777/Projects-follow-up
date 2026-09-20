"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";

type NavItem = { href: string; label: string };

const adminTabs: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
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
    <div className="min-h-dvh bg-zinc-50 text-zinc-900">
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-56 flex-col border-e border-zinc-200 bg-white lg:flex">
        <div className="flex h-14 items-center gap-2 border-b border-zinc-200 px-4">
          <span className="text-lg font-semibold tracking-tight">PFU</span>
          <span className="truncate text-xs text-zinc-500">{orgSlug}</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {tabs.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-11 items-center rounded-lg px-3 text-sm font-medium ${
                  active ? "bg-blue-50 text-blue-700" : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          {role === "Admin" ? (
            <>
              <Link
                href="/users"
                className={`flex min-h-11 items-center rounded-lg px-3 text-sm font-medium ${
                  pathname.startsWith("/users") ? "bg-blue-50 text-blue-700" : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                Users
              </Link>
              <Link
                href="/settings"
                className={`flex min-h-11 items-center rounded-lg px-3 text-sm font-medium ${
                  pathname.startsWith("/settings") ? "bg-blue-50 text-blue-700" : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                Settings
              </Link>
            </>
          ) : (
            <Link
              href="/settings"
              className={`flex min-h-11 items-center rounded-lg px-3 text-sm font-medium ${
                pathname.startsWith("/settings") ? "bg-blue-50 text-blue-700" : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              Settings
            </Link>
          )}
        </nav>
        <div className="border-t border-zinc-200 p-3">
          <p className="truncate text-sm font-medium">{fullName}</p>
          <p className="text-xs text-zinc-500">{role}</p>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: `/login/${orgSlug}` })}
            className="mt-2 min-h-11 text-sm text-red-600 hover:underline"
          >
            Sign out
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-12 items-center border-b border-zinc-200 bg-white px-4 lg:hidden">
        <span className="font-semibold">Projects Follow Up</span>
        <span className="ms-auto text-xs text-zinc-500">{fullName}</span>
      </header>

      <main className="lg:ps-56">
        <div className="mx-auto max-w-6xl px-4 py-4 pb-24 lg:py-6 lg:pb-6">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {tabs.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-12 flex-1 flex-col items-center justify-center text-[11px] font-medium ${
                active ? "text-blue-600" : "text-zinc-500"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className={`flex min-h-12 flex-1 flex-col items-center justify-center text-[11px] font-medium ${
            moreOpen || pathname.startsWith("/settings") || pathname.startsWith("/users")
              ? "text-blue-600"
              : "text-zinc-500"
          }`}
        >
          More
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-4 pb-24"
            onClick={(e) => e.stopPropagation()}
          >
            {role === "Admin" ? (
              <>
                <Link href="/users" onClick={() => setMoreOpen(false)} className="block min-h-11 py-3 font-medium">
                  Users
                </Link>
                <Link href="/settings" onClick={() => setMoreOpen(false)} className="block min-h-11 py-3 font-medium">
                  Settings
                </Link>
              </>
            ) : (
              <Link href="/settings" onClick={() => setMoreOpen(false)} className="block min-h-11 py-3 font-medium">
                Settings
              </Link>
            )}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: `/login/${orgSlug}` })}
              className="block min-h-11 w-full py-3 text-start font-medium text-red-600"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
