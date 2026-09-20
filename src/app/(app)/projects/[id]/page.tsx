import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { asSession } from "@/lib/session";
import { getProjectDetail } from "@/services/submissions";
import { ProjectActions } from "@/components/project-actions";
import { ResolveBlocker } from "@/components/resolve-blocker";

export default async function AdminProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "Admin") redirect("/my-projects");
  const { id } = await params;

  let detail;
  try {
    detail = await getProjectDetail(asSession(session), id);
  } catch {
    notFound();
  }
  const p = detail.project as Record<string, unknown>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/projects" className="text-sm text-blue-700">
            ← Projects
          </Link>
          <h1 className="mt-2 text-xl font-semibold">{String(p.project_name)}</h1>
          <p className="text-sm text-zinc-500">
            {String(p.client_name)} · {String(p.project_status)} · {String(p.current_phase)}
          </p>
        </div>
        <ProjectActions projectId={id} />
      </div>

      <div className="flex -space-x-2">
        {(detail.assignees as Array<{ id: string; full_name: string }>).map((a, i) => (
          <span
            key={a.id}
            title={a.full_name}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-xs font-semibold text-white"
            style={{ zIndex: 10 - i }}
          >
            {a.full_name.slice(0, 1)}
          </span>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <h2 className="border-b border-zinc-100 px-4 py-3 font-semibold">BOQ</h2>
        <div className="space-y-3 p-4 lg:hidden">
          {(detail.boq as Array<Record<string, unknown>>).map((row) => (
            <div key={String(row.id)} className="rounded-lg border border-zinc-100 p-3">
              <p className="text-xs text-zinc-500">{String(row.item_no)}</p>
              <p className="font-medium">{String(row.item_description)}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {String(row.installed_qty)} / {String(row.delivered_qty)} / {String(row.po_qty)}{" "}
                {String(row.unit)}
              </p>
            </div>
          ))}
        </div>
        <table className="hidden min-w-full text-sm lg:table">
          <thead className="bg-zinc-50 text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-2 text-start">No</th>
              <th className="px-4 py-2 text-start">Description</th>
              <th className="px-4 py-2">Unit</th>
              <th className="px-4 py-2">PO</th>
              <th className="px-4 py-2">Del</th>
              <th className="px-4 py-2">Inst</th>
            </tr>
          </thead>
          <tbody>
            {(detail.boq as Array<Record<string, unknown>>).map((row) => (
              <tr key={String(row.id)} className="border-t border-zinc-100">
                <td className="px-4 py-2">{String(row.item_no)}</td>
                <td className="px-4 py-2">{String(row.item_description)}</td>
                <td className="px-4 py-2 text-center">{String(row.unit)}</td>
                <td className="px-4 py-2 text-center">{String(row.po_qty)}</td>
                <td className="px-4 py-2 text-center">{String(row.delivered_qty)}</td>
                <td className="px-4 py-2 text-center">{String(row.installed_qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="font-semibold">Blockers</h2>
        <ul className="mt-3 space-y-2">
          {(detail.blockers as Array<Record<string, unknown>>).map((b) => (
            <li key={String(b.id)} className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{String(b.description)}</p>
                  <p className="text-xs text-zinc-500">
                    {String(b.severity)} · {String(b.status)} · {String(b.raised_by_name)}
                  </p>
                </div>
                {b.status === "Open" ? <ResolveBlocker blockerId={String(b.id)} /> : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
