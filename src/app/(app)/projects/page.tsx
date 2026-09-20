import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { listProjects } from "@/services/projects";
import { CreateProjectForm } from "@/components/create-project-form";
import { ProjectActions } from "@/components/project-actions";

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
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">
            Projects
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Create projects, add BOQ, assign engineers
          </p>
        </div>
      </div>

      <div className="mt-6">
        <CreateProjectForm />
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-500">
            <tr>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Phase</th>
              <th className="px-4 py-3">BOQ</th>
              <th className="px-4 py-3">Assignees</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  No projects yet. Create one above.
                </td>
              </tr>
            ) : (
              projects.map((p: Record<string, unknown>) => (
                <tr key={String(p.id)} className="border-b border-zinc-100 last:border-0 align-top">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/projects/${p.id}`} className="text-blue-700 hover:underline">
                      {String(p.project_name)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{String(p.client_name)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs">
                      {String(p.project_status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{String(p.current_phase)}</td>
                  <td className="px-4 py-3">{String(p.boq_count)}</td>
                  <td className="px-4 py-3">{String(p.assignee_count)}</td>
                  <td className="px-4 py-3">
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
