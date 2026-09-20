import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { asSession } from "@/lib/session";
import { listAssignedProjects } from "@/services/submissions";

export default async function MyProjectsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "Site Engineer") redirect("/dashboard");

  const projects = await listAssignedProjects(asSession(session));
  const inProgress = projects.filter((p: { project_status: string }) => p.project_status === "In Progress").length;
  const delayed = projects.filter((p: { project_status: string }) => p.project_status === "Delayed").length;

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">My Assigned Projects</h1>
      <p className="mt-1 text-sm text-zinc-500">{session.user.fullName}</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold">{projects.length}</p>
          <p className="text-xs text-zinc-500">Total Assigned</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{inProgress}</p>
          <p className="text-xs text-zinc-500">In Progress</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{delayed}</p>
          <p className="text-xs text-zinc-500">Delayed</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold">{projects.reduce((n: number, p: { open_blockers: number }) => n + Number(p.open_blockers || 0), 0)}</p>
          <p className="text-xs text-zinc-500">Open blockers</p>
        </div>
      </div>

      <div className="mt-6 space-y-3 lg:hidden">
        {projects.length === 0 && (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
            No projects assigned yet.
          </p>
        )}
        {projects.map((p: Record<string, unknown>) => (
          <Link
            key={String(p.id)}
            href={`/my-projects/${p.id}`}
            className="block rounded-xl border border-zinc-200 bg-white p-4"
          >
            <p className="font-semibold">{String(p.project_name)}</p>
            <p className="text-sm text-zinc-500">{String(p.client_name)}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-zinc-100 px-2 py-0.5">{String(p.project_status)}</span>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">{String(p.current_phase)}</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-6 hidden overflow-hidden rounded-xl border border-zinc-200 bg-white lg:block">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-3 text-start">Project</th>
              <th className="px-4 py-3 text-start">Client</th>
              <th className="px-4 py-3 text-start">Status</th>
              <th className="px-4 py-3 text-start">Phase</th>
              <th className="px-4 py-3">BOQ</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p: Record<string, unknown>) => (
              <tr key={String(p.id)} className="border-t border-zinc-100">
                <td className="px-4 py-3">
                  <Link href={`/my-projects/${p.id}`} className="font-medium text-blue-700 hover:underline">
                    {String(p.project_name)}
                  </Link>
                </td>
                <td className="px-4 py-3">{String(p.client_name)}</td>
                <td className="px-4 py-3">{String(p.project_status)}</td>
                <td className="px-4 py-3">{String(p.current_phase)}</td>
                <td className="px-4 py-3 text-center">{String(p.boq_count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
