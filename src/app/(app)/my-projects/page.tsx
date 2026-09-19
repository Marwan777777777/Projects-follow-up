import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function MyProjectsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">
        My Assigned Projects
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        Logged in as {session.user.fullName}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold">\u2014</p>
          <p className="text-xs text-zinc-500">Total Assigned</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">\u2014</p>
          <p className="text-xs text-zinc-500">In Progress</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-red-600">\u2014</p>
          <p className="text-xs text-zinc-500">Delayed</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-green-600">\u2014</p>
          <p className="text-xs text-zinc-500">Updated Today</p>
        </div>
      </div>

      <p className="mt-8 rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
        Assigned projects and daily updates arrive in Slice 3.
        <br />
        Auth + shell are working. You are signed in as{" "}
        <strong>{session.user.role}</strong>.
      </p>
    </div>
  );
}
