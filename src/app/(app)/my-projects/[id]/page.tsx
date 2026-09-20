import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { asSession } from "@/lib/session";
import { getProjectDetail } from "@/services/submissions";
import { DailyUpdateForm } from "@/components/daily-update-form";
import { BlockerForm } from "@/components/blocker-form";
import Link from "next/link";

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
  const storageKey = `draft:${session.user.orgId}:${session.user.id}:${id}`;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/my-projects" className="text-sm text-blue-700">
          ← My projects
        </Link>
        <h1 className="mt-2 text-xl font-semibold">{String(p.project_name)}</h1>
        <p className="text-sm text-zinc-500">
          {String(p.client_name)}
          {p.location ? ` · ${p.location}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {(detail.assignees as Array<{ full_name: string }>).map((a) => (
            <span key={a.full_name} className="rounded-full bg-zinc-100 px-2 py-1">
              {a.full_name}
            </span>
          ))}
        </div>
      </div>

      <BlockerForm projectId={id} />

      <section>
        <h2 className="mb-3 font-semibold">Daily update</h2>
        <DailyUpdateForm
          projectId={id}
          status={String(p.project_status)}
          phase={String(p.current_phase)}
          boq={detail.boq as never}
          storageKey={storageKey}
        />
      </section>

      <section>
        <h2 className="font-semibold">Update history</h2>
        <ul className="mt-3 space-y-2">
          {(detail.history as Array<Record<string, unknown>>).map((h) => (
            <li key={String(h.id)} className="rounded-lg border border-zinc-200 bg-white p-3 text-sm">
              <p className="font-medium">
                {String(h.kind)} {h.no_change ? "· no change" : ""}
              </p>
              <p className="text-xs text-zinc-500">
                Received: {new Date(String(h.submitted_at)).toLocaleString()}
                {h.client_submitted_at
                  ? ` · Reported: ${new Date(String(h.client_submitted_at)).toLocaleString()}`
                  : ""}
              </p>
              {h.notes ? <p className="mt-1 text-zinc-700">{String(h.notes)}</p> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
