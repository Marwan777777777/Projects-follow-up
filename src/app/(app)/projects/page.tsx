import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { listProjects } from "@/services/projects";
import { CreateProjectForm } from "@/components/create-project-form";
import { ProjectActions } from "@/components/project-actions";

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

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "Admin") redirect("/my-projects");

  const projects = await listProjects({
    user: {
      id: session.user.id,
      orgId: session.user.orgId,
      role: session.user.role,
      tokenVersion: session.user.tokenVersion,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 lg:text-2xl">
            Project Management
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Create projects, add BOQ lines, assign site engineers
          </p>
        </div>
        <p className="text-sm text-zinc-500">{projects.length} project{projects.length === 1 ? "" : "s"}</p>
      </div>

      <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-zinc-900">Create new project</h2>
        <div className="mt-4">
          <CreateProjectForm />
        </div>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 lg:hidden">
        {projects.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-500">
            No projects yet. Create one above.
          </div>
        )}
        {projects.map((p: Record<string, unknown>) => (
          <div
            key={String(p.id)}
            className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={`/projects/${p.id}`}
                  className="font-semibold text-zinc-900 hover:text-blue-700"
                >
                  {String(p.project_name)}
                </Link>
                <p className="mt-0.5 text-sm text-zinc-500">{String(p.client_name)}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(String(p.project_status))}`}>
                {String(p.project_status)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600">
                {String(p.current_phase)}
              </span>
              {p.project_priority && (
                <span className={`rounded-full px-2 py-0.5 ${priorityBadge(String(p.project_priority))}`}>
                  {String(p.project_priority)}
                </span>
              )}
              <span className="text-zinc-500">{String(p.boq_count)} BOQ</span>
              <span className="text-zinc-500">{String(p.assignee_count)} engineer{Number(p.assignee_count) === 1 ? "" : "s"}</span>
            </div>
            <div className="mt-3">
              <ProjectActions projectId={String(p.id)} />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm lg:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50/80 text-xs font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-5 py-3.5">Project</th>
              <th className="px-5 py-3.5">Client</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5">Priority</th>
              <th className="px-5 py-3.5">Phase</th>
              <th className="px-5 py-3.5">BOQ</th>
              <th className="px-5 py-3.5">Engineers</th>
              <th className="px-5 py-3.5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {projects.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-zinc-500">
                  No projects yet. Create one above.
                </td>
              </tr>
            ) : (
              projects.map((p: Record<string, unknown>) => (
                <tr key={String(p.id)} className="align-top transition hover:bg-zinc-50/50">
                  <td className="px-5 py-4">
                    <Link
                      href={`/projects/${p.id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {String(p.project_name)}
                    </Link>
                    {p.location && (
                      <p className="mt-0.5 text-xs text-zinc-500">{String(p.location)}</p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-zinc-600">{String(p.client_name)}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(String(p.project_status))}`}>
                      {String(p.project_status)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {p.project_priority ? (
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityBadge(String(p.project_priority))}`}>
                        {String(p.project_priority)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-5 py-4 text-zinc-600">{String(p.current_phase)}</td>
                  <td className="px-5 py-4">{String(p.boq_count)}</td>
                  <td className="px-5 py-4">{String(p.assignee_count)}</td>
                  <td className="px-5 py-4">
                    <ProjectActions projectId={String(p.id)} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
