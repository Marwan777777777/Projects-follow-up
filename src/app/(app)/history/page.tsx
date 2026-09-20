import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { asSession } from "@/lib/session";
import { listActivity } from "@/services/submissions";

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "Site Engineer") redirect("/activity");

  const rows = await listActivity(asSession(session));

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">History</h1>
      <p className="mt-1 text-sm text-zinc-500">Your submissions and project changes</p>
      <ul className="mt-6 space-y-2">
        {rows.length === 0 && <p className="text-sm text-zinc-500">No activity yet.</p>}
        {rows.map((r: Record<string, unknown>) => (
          <li key={String(r.id)} className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">
            <p className="font-medium">
              {String(r.action)} {String(r.entity_type)}
              {r.field ? ` · ${r.field}` : ""}
            </p>
            <p className="text-xs text-zinc-500">
              {r.project_name ? String(r.project_name) + " · " : ""}
              {new Date(String(r.timestamp || r.created_at)).toLocaleString()}
            </p>
            {r.old_value || r.new_value ? (
              <p className="mt-1 font-mono text-xs">
                {String(r.old_value ?? "—")} → {String(r.new_value ?? "—")}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
