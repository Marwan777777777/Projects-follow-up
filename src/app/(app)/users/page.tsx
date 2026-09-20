import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { asSession } from "@/lib/session";
import { listOrgUsers } from "@/services/projects";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "Admin") redirect("/my-projects");

  const users = await listOrgUsers(asSession(session));

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">Users</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Create engineers from a project (Assign → + Engineer). Active Site Engineers require email.
      </p>
      <div className="mt-6 space-y-3 lg:hidden">
        {users.map((u: Record<string, unknown>) => (
          <div key={String(u.id)} className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="font-medium">{String(u.full_name)}</p>
            <p className="text-xs text-zinc-500">
              {String(u.username)} · {String(u.role)} · {String(u.status)}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-6 hidden overflow-hidden rounded-xl border border-zinc-200 bg-white lg:block">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-3 text-start">Name</th>
              <th className="px-4 py-3 text-start">Username</th>
              <th className="px-4 py-3 text-start">Email</th>
              <th className="px-4 py-3 text-start">Role</th>
              <th className="px-4 py-3 text-start">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u: Record<string, unknown>) => (
              <tr key={String(u.id)} className="border-t border-zinc-100">
                <td className="px-4 py-3 font-medium">{String(u.full_name)}</td>
                <td className="px-4 py-3">{String(u.username)}</td>
                <td className="px-4 py-3">{String(u.email || "—")}</td>
                <td className="px-4 py-3">{String(u.role)}</td>
                <td className="px-4 py-3">{String(u.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
