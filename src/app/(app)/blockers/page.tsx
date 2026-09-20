import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { asSession } from "@/lib/session";
import { listBlockers } from "@/services/submissions";
import { ResolveBlocker } from "@/components/resolve-blocker";
import Link from "next/link";

export default async function BlockersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const blockers = await listBlockers(asSession(session));
  const isAdmin = session.user.role === "Admin";

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">Blockers</h1>
      <p className="mt-1 text-sm text-zinc-500">Open and resolved site issues</p>

      <div className="mt-6 space-y-3 lg:hidden">
        {blockers.length === 0 && <p className="text-sm text-zinc-500">No blockers yet.</p>}
        {blockers.map((b: Record<string, unknown>) => (
          <div key={String(b.id)} className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="font-medium">{String(b.description)}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {String(b.project_name)} · {String(b.severity)} · {String(b.status)}
            </p>
            {isAdmin && b.status === "Open" ? (
              <div className="mt-3">
                <ResolveBlocker blockerId={String(b.id)} />
              </div>
            ) : null}
            {b.resolution_note ? (
              <p className="mt-2 text-sm text-emerald-700">{String(b.resolution_note)}</p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-6 hidden overflow-hidden rounded-xl border border-zinc-200 bg-white lg:block">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-3 text-start">Severity</th>
              <th className="px-4 py-3 text-start">Project</th>
              <th className="px-4 py-3 text-start">Issue</th>
              <th className="px-4 py-3 text-start">Raised by</th>
              <th className="px-4 py-3 text-start">Status</th>
              {isAdmin ? <th className="px-4 py-3">Action</th> : null}
            </tr>
          </thead>
          <tbody>
            {blockers.map((b: Record<string, unknown>) => (
              <tr key={String(b.id)} className="border-t border-zinc-100 align-top">
                <td className="px-4 py-3">{String(b.severity)}</td>
                <td className="px-4 py-3">
                  <Link
                    href={isAdmin ? `/projects/${b.project_id}` : `/my-projects/${b.project_id}`}
                    className="text-blue-700 hover:underline"
                  >
                    {String(b.project_name)}
                  </Link>
                </td>
                <td className="px-4 py-3">{String(b.description)}</td>
                <td className="px-4 py-3">{String(b.raised_by_name)}</td>
                <td className="px-4 py-3">{String(b.status)}</td>
                {isAdmin ? (
                  <td className="px-4 py-3">
                    {b.status === "Open" ? <ResolveBlocker blockerId={String(b.id)} /> : "—"}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
