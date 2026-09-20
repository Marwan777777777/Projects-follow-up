import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { asSession } from "@/lib/session";
import { getProjectDetail } from "@/services/submissions";
import { DailyUpdateForm } from "@/components/daily-update-form";
import { BlockerForm } from "@/components/blocker-form";
import { AttachmentList } from "@/components/attachment-list";
import Link from "next/link";

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

export default async function EngineerProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;

  let detail;
  try {
    detail = await getProjectDetail(asSession(session), id);
  } catch {
    notFound();
  }

  const p = detail.project as Record<string, unknown>;
  const status = String(p.project_status || "");
  const priority = String(p.project_priority || "");
  const phase = String(p.current_phase || "");
  const installPct = Math.round(Number(p.install_rate || 0) * 100);
  const deliveredPct = Math.round(Number(p.delivered_rate || 0) * 100);
  const storageKey = `draft:${session.user.orgId}:${session.user.id}:${id}`;

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <Link
          href="/my-projects"
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
        >
          ← My projects
        </Link>

        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900 lg:text-2xl">
                {String(p.project_name)}
              </h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(status)}`}>
                {status}
              </span>
              {priority && (
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityBadge(priority)}`}>
                  {priority}
                </span>
              )}
            </div>

            <p className="mt-1 text-sm text-zinc-500">
              {String(p.client_name)}
              {p.location ? ` · ${String(p.location)}` : ""}
            </p>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
              {p.po_number && <span>PO: {String(p.po_number)}</span>}
              {p.contract_number && <span>Contract: {String(p.contract_number)}</span>}
              {p.target_completion_date && (
                <span>Due: {String(p.target_completion_date).slice(0, 10)}</span>
              )}
            </div>

            {(detail.assignees as Array<{ full_name: string }>).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(detail.assignees as Array<{ full_name: string }>).map((a) => (
                  <span
                    key={a.full_name}
                    className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700"
                  >
                    {a.full_name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* BOQ summary */}
          <div className="w-full shrink-0 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm sm:w-52">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-500">BOQ Installed</span>
              <span className="font-semibold text-zinc-900">{installPct}%</span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${Math.min(installPct, 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Delivered {deliveredPct}% · Installed {installPct}%
            </p>
            <p className="mt-1 text-xs font-medium text-zinc-700">{phase}</p>
          </div>
        </div>
      </div>

      {/* Raise blocker */}
      <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-zinc-900">Raise a Blocker</h2>
        <p className="mt-0.5 text-xs text-zinc-500">Report issues that need attention</p>
        <div className="mt-4">
          <BlockerForm projectId={id} />
        </div>
      </section>

      {/* Daily update */}
      <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-zinc-900">Daily Site Update</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Update installed quantities, notes, and status
        </p>
        <div className="mt-4">
          <DailyUpdateForm
            projectId={id}
            status={status}
            phase={phase}
            boq={detail.boq as never}
            storageKey={storageKey}
          />
        </div>
      </section>

      {/* Attachments */}
      <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-zinc-900">Site Photos & Documents</h2>
        <div className="mt-4">
          <AttachmentList attachments={(detail.attachments as never) || []} />
        </div>
      </section>

      {/* History */}
      <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-zinc-900">Update History</h2>
        <ul className="mt-4 space-y-3">
          {(detail.history as Array<Record<string, unknown>>).length === 0 && (
            <li className="rounded-lg bg-zinc-50 px-3 py-4 text-center text-sm text-zinc-500">
              No updates yet
            </li>
          )}
          {(detail.history as Array<Record<string, unknown>>).map((h) => (
            <li
              key={String(h.id)}
              className="rounded-xl border border-zinc-100 bg-zinc-50/50 px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-zinc-900">{String(h.kind)}</span>
                {h.no_change ? (
                  <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600">
                    no change
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Received: {new Date(String(h.submitted_at)).toLocaleString()}
                {h.client_submitted_at
                  ? ` · Reported: ${new Date(String(h.client_submitted_at)).toLocaleString()}`
                  : ""}
              </p>
              {h.notes ? <p className="mt-2 text-zinc-700">{String(h.notes)}</p> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
