import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "Admin") redirect("/my-projects");

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">
        Project Monitoring Dashboard
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        Portfolio overview — {session.user.fullName}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="col-span-2 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 p-4 text-white lg:col-span-1">
          <p className="text-xs font-medium opacity-80">Active Projects</p>
          <p className="mt-1 text-3xl font-bold">—</p>
          <p className="mt-1 text-xs opacity-70">Slice 2 will populate this</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs font-medium text-zinc-500">Delayed</p>
          <p className="mt-1 text-2xl font-bold text-red-600">—</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs font-medium text-zinc-500">On Hold</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">—</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs font-medium text-zinc-500">BOQ Install</p>
          <p className="mt-1 text-2xl font-bold">—</p>
        </div>
      </div>

      <p className="mt-8 rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
        Full dashboard KPIs and charts arrive in Slice 4.
        <br />
        Auth + shell are working. You are signed in as{" "}
        <strong>{session.user.role}</strong>.
      </p>
    </div>
  );
}
