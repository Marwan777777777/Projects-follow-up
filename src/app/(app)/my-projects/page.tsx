import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { asSession } from "@/lib/session";
import { listAssignedProjects } from "@/services/submissions";

function statusBadge(status: string) {
  const map: Record<string, string> = {
    "In Progress": "bg-blue-50 text-blue-700 ring-1 ring-blue-600/10",
    Delayed: "bg-red-50 text-red-700 ring-1 ring-red-600/10",
    "On Hold": "bg-amber-50 text-amber-700 ring-1 ring-amber-600/10",
    Completed: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10",
    "Not Started Yet": "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-500/10",
  };
  return map[status] || "bg-zinc-100 text-zinc-600";
}

function priorityBadge(priority: string) {
  if (priority === "High") return "bg-red-50 text-red-700 ring-1 ring-red-600/10";
  if (priority === "Medium") return "bg-amber-50 text-amber-700 ring-1 ring-amber-600/10";
  return "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-500/10";
}

export default async function MyProjectsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "Site Engineer") redirect("/dashboard");

  const projects = await listAssignedProjects(asSession(session));
  const inProgress = projects.filter((p: { project_status: string }) => p.project_status === "In Progress").length;
  const delayed = projects.filter((p: { project_status: string }) => p.project_status === "Delayed").length;
  const openBlockers = projects.reduce(
    (n: number, p: { open_blockers: number }) => n + Number(p.open_blockers || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 lg:text-2xl">
          My Assigned Projects
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Logged in as {session.user.fullName} · {projects.length} project{projects.length === 1 ? "" : "s"} assigned
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 text-center shadow-sm">
          <p className="text-3xl font-bold tracking-tight">{projects.length}</p>
          <p className="mt-1 text-xs font-medium text-zinc-500">Total Assigned</p>
        </div>
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 text-center shadow-sm">
          <p className="text-3xl font-bold tracking-tight text-blue-600">{inProgress}</p>
          <p className="mt-1 text-xs font-medium text-zinc-500">In Progress</p>
        </div>
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 text-center shadow-sm">
          <p className="text-3xl font-bold tracking-tight text-red-600">{delayed}</p>
          <p className="mt-1 text-xs font-medium text-zinc-500">Delayed</p>
        </div>
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 text-center shadow-sm">
          <p className="text-3xl font-bold tracking-tight text-amber-600">{openBlockers}</p>
          <p className="mt-1 text-xs font-medium text-zinc-500">Open Blockers</p>
        </div>
      </div>

      {/* Project cards – works great on both mobile and desktop */}
      <div className="space-y-4">
        {projects.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
            <p className="text-sm font-medium text-zinc-900">No projects assigned yet</p>
            <p className="mt-1 text-sm text-zinc-500">
              Ask your admin to assign you to a project.
            </p>
          </div>
        )}

        {projects.map((p: Record<string, unknown>) => {
          const status = String(p.project_status || "");
          const priority = String(p.project_priority || "");
          const phase = String(p.current_phase || "");
          const installPct = Math.round(Number(p.install_rate || 0) * 100);

          return (
            <Link
              key={String(p.id)}
              href={`/my-projects/${p.id}`}
              className="block rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow-md"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-zinc-900">{String(p.project_name)}</h2>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(status)}`}>
                      {status}
                    </span>
                    {priority && (
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityBadge(priority)}`}>
                        {priority}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-sm text-zinc-500">{String(p.client_name)}</p>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                    {p.location && <span>{String(p.location)}</span>}
                    {p.po_number && <span>PO: {String(p.po_number)}</span>}
                    {p.target_completion_date && (
                      <span>Due: {String(p.target_completion_date).slice(0, 10)}</span>
                    )}
                  </div>

                  {/* Phase stepper-ish */}
                  <div className="mt-4">
                    <p className="text-xs font-medium text-zinc-500">Current phase</p>
                    <p className="mt-0.5 text-sm font-medium text-zinc-800">{phase}</p>
                  </div>
                </div>

                {/* BOQ progress */}
                <div className="w-full shrink-0 sm:w-44">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-zinc-500">BOQ Installed</span>
                    <span className="font-semibold text-zinc-900">{installPct}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all"
                      style={{ width: `${Math.min(installPct, 100)}%` }}
                    />
                  </div>
                  {Number(p.open_blockers) > 0 && (
                    <p className="mt-2 text-xs font-medium text-red-600">
                      {p.open_blockers} open blocker{Number(p.open_blockers) === 1 ? "" : "s"}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
