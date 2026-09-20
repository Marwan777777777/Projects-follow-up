import type { Session } from "next-auth";
import type { SessionLike } from "@/db/tenant";

export function asSession(session: Session | null): SessionLike {
  if (!session?.user?.id || !session.user.orgId) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  return {
    user: {
      id: session.user.id,
      orgId: session.user.orgId,
      role: session.user.role,
      tokenVersion: session.user.tokenVersion,
    },
  };
}
