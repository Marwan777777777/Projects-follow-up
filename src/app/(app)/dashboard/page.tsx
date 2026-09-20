import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { asSession } from "@/lib/session";
import { dashboardStats } from "@/services/submissions";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "Admin") redirect("/my-projects");

  const stats = await dashboardStats(asSession(session));
  const c = stats.counts as Record<string, number>;
  const boq = stats.boq as Record<string, number>;
  const installPct = Math.round(Number(boq.install_rate || 0) * 100);
  const completedPct = c.total ? Math.round((c.completed / c.total) * 100) : 0;
  const totalProjects = c.total || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 lg:text-2xl">
            Project Monitoring Dashboard
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Portfolio overview · {session.user.fullName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/projects"
            className="inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            Manage Projects
          </Link>
        </div>
      </div>

      {/* Top KPI row – matches screenshot layout */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Active Projects – primary card */}
        <div className="col-span-2 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 p-5 text-white shadow-sm lg:col-span-1">
          <p className="text-xs font-medium uppercase tracking-wide text-blue-100">
            Active Projects
          </p>
          <p className="mt-2 text-4xl font-bold tracking-tight">{c.active ?? 0}</p>
          <p className="mt-1 text-sm text-blue-100">
            of {totalProjects} total projects in portfolio
          </p>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              {c.delayed ?? 0} Delayed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              {c.on_hold ?? 0} On Hold
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {c.completed ?? 0} Done
            </span>
          </div>
        </div>

        {/* Delayed */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Delayed</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-red-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-red-600">{c.delayed ?? 0}</p>
          <p className="mt-1 text-xs text-red-600/80">Immediate attention required</p>
        </div>

        {/* On Hold */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">On Hold</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-amber-600">{c.on_hold ?? 0}</p>
          <p className="mt-1 text-xs text-amber-700/80">Awaiting client / supply</p>
        </div>

        {/* Completed */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Completed</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-emerald-600">{c.completed ?? 0}</p>
          <p className="mt-1 text-xs text-zinc-500">{completedPct}% of portfolio</p>
        </div>
      </div>

      {/* Second row – BOQ + Missing reports style cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">BOQ Install Rate</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{installPct}%</p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${Math.min(installPct, 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            {boq.fully_installed ?? 0} of {boq.lines ?? 0} BOQ lines fully installed
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">In Progress</p>
          <p className="mt-2 text-3xl font-bold text-blue-600">{c.in_progress ?? 0}</p>
          <p className="mt-1 text-xs text-zinc-500">Active construction / installation</p>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm sm:col-span-2 lg:col-span-1">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Not Started Yet</p>
          <p className="mt-2 text-3xl font-bold text-zinc-400">{c.not_started ?? 0}</p>
          <p className="mt-1 text-xs text-zinc-500">Waiting to begin</p>
        </div>
      </div>

      {/* At-Risk + Recent */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-zinc-900">At-Risk Projects</h2>
            <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
              {stats.atRisk.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Delayed or High-Priority On Hold projects requiring escalation
          </p>
          <ul className="mt-4 space-y-3">
            {stats.atRisk.length === 0 && (
              <li className="rounded-lg bg-zinc-50 px-3 py-4 text-center text-sm text-zinc-500">
                No at-risk projects right now
              </li>
            )}
            {stats.atRisk.map((p: Record<string, unknown>) => (
              <li key={String(p.id)}>
                <Link
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50/50 px-3 py-3 transition hover:border-zinc-200 hover:bg-white"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {String(p.project_name)}
                    </p>
                    <p className="truncate text-xs text-zinc-500">{String(p.current_phase)}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                    {String(p.project_status)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {stats.atRisk.length > 0 && (
            <div className="mt-4 text-end">
              <Link href="/projects" className="text-sm font-medium text-blue-600 hover:underline">
                View all projects →
              </Link>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-zinc-900">Recent Projects</h2>
          <p className="mt-1 text-xs text-zinc-500">Latest activity across the portfolio</p>
          <ul className="mt-4 space-y-3">
            {stats.recent.length === 0 && (
              <li className="rounded-lg bg-zinc-50 px-3 py-4 text-center text-sm text-zinc-500">
                No projects yet
              </li>
            )}
            {stats.recent.map((p: Record<string, unknown>) => (
              <li key={String(p.id)}>
                <Link
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50/50 px-3 py-3 transition hover:border-zinc-200 hover:bg-white"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {String(p.project_name)}
                    </p>
                    <p className="truncate text-xs text-zinc-500">{String(p.client_name)}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                    {String(p.current_phase)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
