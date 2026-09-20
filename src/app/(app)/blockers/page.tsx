import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { asSession } from "@/lib/session";
import { listBlockers } from "@/services/submissions";
import { ResolveBlocker } from "@/components/resolve-blocker";
import Link from "next/link";

function severityBadge(severity: string) {
  if (severity === "High") return "bg-red-50 text-red-700 ring-1 ring-red-600/10";
  if (severity === "Medium") return "bg-amber-50 text-amber-700 ring-1 ring-amber-600/10";
  return "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-500/10";
}

function statusBadge(status: string) {
  if (status === "Open") return "bg-red-50 text-red-700 ring-1 ring-red-600/10";
  return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10";
}

export default async function BlockersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const blockers = await listBlockers(asSession(session));
  const isAdmin = session.user.role === "Admin";
  const openCount = blockers.filter((b: { status: string }) => b.status === "Open").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 lg:text-2xl">
            Blockers
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Open and resolved site issues across projects
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
            {openCount} open
          </span>
          <span className="text-sm text-zinc-500">{blockers.length} total</span>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 lg:hidden">
        {blockers.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-500">
            No blockers reported yet.
          </div>
        )}
        {blockers.map((b: Record<string, unknown>) => (
          <div
            key={String(b.id)}
            className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${severityBadge(String(b.severity))}`}>
                {String(b.severity)}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(String(b.status))}`}>
                {String(b.status)}
              </span>
            </div>
            <p className="mt-2 font-medium text-zinc-900">{String(b.description)}</p>
            <p className="mt-1 text-xs text-zinc-500">
              <Link
                href={isAdmin ? `/projects/${b.project_id}` : `/my-projects/${b.project_id}`}
                className="font-medium text-blue-600 hover:underline"
              >
                {String(b.project_name)}
              </Link>
              {" · "}
              {String(b.raised_by_name)}
            </p>
            {b.resolution_note ? (
              <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {String(b.resolution_note)}
              </p>
            ) : null}
            {isAdmin && b.status === "Open" ? (
              <div className="mt-3">
                <ResolveBlocker blockerId={String(b.id)} />
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm lg:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50/80 text-xs font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-5 py-3.5">Severity</th>
              <th className="px-5 py-3.5">Project</th>
              <th className="px-5 py-3.5">Issue</th>
              <th className="px-5 py-3.5">Raised by</th>
              <th className="px-5 py-3.5">Status</th>
              {isAdmin ? <th className="px-5 py-3.5">Action</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {blockers.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="px-5 py-10 text-center text-zinc-500">
                  No blockers reported yet.
                </td>
              </tr>
            ) : (
              blockers.map((b: Record<string, unknown>) => (
                <tr key={String(b.id)} className="align-top transition hover:bg-zinc-50/50">
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${severityBadge(String(b.severity))}`}>
                      {String(b.severity)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={isAdmin ? `/projects/${b.project_id}` : `/my-projects/${b.project_id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {String(b.project_name)}
                    </Link>
                  </td>
                  <td className="max-w-xs px-5 py-4">
                    <p className="text-zinc-900">{String(b.description)}</p>
                    {b.resolution_note ? (
                      <p className="mt-1 text-xs text-emerald-700">{String(b.resolution_note)}</p>
                    ) : null}
                  </td>
                  <td className="px-5 py-4 text-zinc-600">{String(b.raised_by_name)}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(String(b.status))}`}>
                      {String(b.status)}
                    </span>
                  </td>
                  {isAdmin ? (
                    <td className="px-5 py-4">
                      {b.status === "Open" ? (
                        <ResolveBlocker blockerId={String(b.id)} />
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
