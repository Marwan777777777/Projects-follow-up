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

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">
        Project Monitoring Dashboard
      </h1>
      <p className="mt-1 text-sm text-zinc-500">{session.user.fullName}</p>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="col-span-2 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 p-4 text-white lg:col-span-1">
          <p className="text-xs font-medium opacity-80">Active Projects</p>
          <p className="mt-1 text-3xl font-bold">{c.active}</p>
          <p className="mt-1 text-xs opacity-80">
            {c.in_progress} In Progress · {c.delayed} Delayed
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs font-medium text-zinc-500">On Hold</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{c.on_hold}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs font-medium text-zinc-500">Completed</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{c.completed}</p>
          <p className="text-xs text-zinc-500">{completedPct}% of portfolio</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs font-medium text-zinc-500">BOQ Install Rate</p>
          <p className="mt-1 text-2xl font-bold">{installPct}%</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full bg-blue-600" style={{ width: `${installPct}%` }} />
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {boq.fully_installed} of {boq.lines} BOQ lines fully installed
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="font-semibold">At risk</h2>
          <ul className="mt-3 space-y-2">
            {stats.atRisk.length === 0 && (
              <li className="text-sm text-zinc-500">No at-risk projects.</li>
            )}
            {stats.atRisk.map((p: Record<string, unknown>) => (
              <li key={String(p.id)}>
                <Link href={`/projects/${p.id}`} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{String(p.project_name)}</span>
                  <span className="text-xs text-red-600">{String(p.project_status)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="font-semibold">Recent projects</h2>
          <ul className="mt-3 space-y-2">
            {stats.recent.map((p: Record<string, unknown>) => (
              <li key={String(p.id)}>
                <Link href={`/projects/${p.id}`} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{String(p.project_name)}</span>
                  <span className="text-xs text-zinc-500">{String(p.current_phase)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
