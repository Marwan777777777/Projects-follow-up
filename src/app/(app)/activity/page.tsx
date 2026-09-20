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
    <div>
      <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">Activity</h1>
      <p className="mt-1 text-sm text-zinc-500">Immutable audit trail</p>
      <ul className="mt-6 space-y-2">
        {rows.map((r: Record<string, unknown>) => (
          <li key={String(r.id)} className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">
            <p className="font-medium">
              {String(r.actor_name || "System")} · {String(r.action)} {String(r.entity_type)}
              {r.field ? ` · ${r.field}` : ""}
            </p>
            <p className="text-xs text-zinc-500">
              {r.project_name ? String(r.project_name) + " · " : ""}
              {new Date(String(r.timestamp || r.created_at)).toLocaleString()}
            </p>
            {r.field ? (
              <p className="mt-1 font-mono text-xs">
                {String(r.old_value ?? "—")} → {String(r.new_value ?? "—")}
              </p>
            ) : r.new_value ? (
              <p className="mt-1 text-xs text-zinc-600">{String(r.new_value)}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
