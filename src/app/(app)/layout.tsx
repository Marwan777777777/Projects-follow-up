import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <AppShell
      role={session.user.role}
      fullName={session.user.fullName}
      orgSlug={session.user.orgSlug}
    >
      {children}
    </AppShell>
  );
}
