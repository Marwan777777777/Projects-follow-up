import { auth } from "@/auth";
import { jsonError } from "@/lib/errors";
import { getDownloadUrl } from "@/services/attachments";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.orgId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const result = await getDownloadUrl(session as any, id);
    return Response.json(result);
  } catch (e) {
    const { status, body } = jsonError(e);
    return Response.json(body, { status });
  }
}
