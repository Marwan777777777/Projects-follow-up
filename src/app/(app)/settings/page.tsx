import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const loginUrl = `/login/${session.user.orgSlug}`;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">{session.user.fullName}</p>
      </div>
      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="font-semibold">Organization login</h2>
        <p className="mt-2 font-mono text-sm">{loginUrl}</p>
        <p className="mt-2 text-xs text-zinc-500">
          Share this URL / QR with field crews. Timezone and working days land in a later slice.
        </p>
      </section>
      <section className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">
        <p>
          Role: <strong>{session.user.role}</strong>
        </p>
        <p className="text-zinc-500">Org: {session.user.orgSlug}</p>
      </section>
    </div>
  );
}
