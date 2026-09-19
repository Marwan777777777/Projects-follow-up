"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const adminNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "\uD83D\uDCCA" },
  { href: "/projects", label: "Projects", icon: "\uD83D\uDCC1" },
  { href: "/users", label: "Users", icon: "\uD83D\uDC65" },
  { href: "/settings", label: "Settings", icon: "\u2699\uFE0F" },
];

const engineerNav: NavItem[] = [
  { href: "/my-projects", label: "My Projects", icon: "\uD83D\uDD27" },
  { href: "/blockers", label: "Blockers", icon: "\uD83D\uDEA7" },
  { href: "/settings", label: "Settings", icon: "\u2699\uFE0F" },
];

type Props = {
  role: "Admin" | "Site Engineer";
  fullName: string;
  orgSlug: string;
  children: React.ReactNode;
};

export function AppShell({ role, fullName, orgSlug, children }: Props) {
  const pathname = usePathname();
  const nav = role === "Admin" ? adminNav : engineerNav;

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-900">
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-56 flex-col border-e border-zinc-200 bg-white lg:flex">
        <div className="flex h-14 items-center gap-2 border-b border-zinc-200 px-4">
          <span className="text-lg font-semibold tracking-tight">PFU</span>
          <span className="truncate text-xs text-zinc-500">{orgSlug}</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-zinc-200 p-3">
          <p className="truncate text-sm font-medium">{fullName}</p>
          <p className="text-xs text-zinc-500">{role}</p>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: `/login/${orgSlug}` })}
            className="mt-2 text-xs text-red-600 hover:underline"
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
        <div className="mx-auto max-w-6xl px-4 py-4 pb-24 lg:py-6 lg:pb-6">
          {children}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-zinc-200 bg-white lg:hidden">
        {nav.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                active ? "text-blue-600" : "text-zinc-500"
              }`}
            >
              <span className="text-lg" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
