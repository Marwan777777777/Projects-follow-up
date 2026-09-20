import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { asSession } from "@/lib/session";
import { listActivity } from "@/services/submissions";

export default async function ActivityPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "Admin") redirect("/history");

  const rows = await listActivity(asSession(session));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 lg:text-2xl">
          Recent Activity
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Latest engineer submissions and system changes
        </p>
      </div>

      <div className="space-y-3">
        {rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-500">
            No activity yet.
          </div>
        )}

        {rows.map((r: Record<string, unknown>) => {
          const actor = String(r.actor_name || "System");
          const action = String(r.action || "");
          const entity = String(r.entity_type || "");
          const field = r.field ? String(r.field) : null;
          const project = r.project_name ? String(r.project_name) : null;
          const ts = new Date(String(r.timestamp || r.created_at)).toLocaleString();

          return (
            <div
              key={String(r.id)}
              className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                  {actor
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-900">
                    <span className="font-semibold">{actor}</span>{" "}
                    <span className="text-zinc-600">
                      {action} {entity}
                      {field ? ` · ${field}` : ""}
                    </span>
                  </p>
                  {project && (
                    <p className="mt-0.5 text-xs font-medium text-blue-600">{project}</p>
                  )}
                  <p className="mt-1 text-xs text-zinc-500">{ts}</p>

                  {field ? (
                    <p className="mt-2 rounded-lg bg-zinc-50 px-3 py-1.5 font-mono text-xs text-zinc-700">
                      <span className="text-zinc-400">{String(r.old_value ?? "—")}</span>
                      {" → "}
                      <span className="font-medium">{String(r.new_value ?? "—")}</span>
                    </p>
                  ) : r.new_value ? (
                    <p className="mt-2 text-sm text-zinc-700">{String(r.new_value)}</p>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
