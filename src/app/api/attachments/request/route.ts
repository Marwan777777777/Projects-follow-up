import { auth } from "@/auth";
import { jsonError } from "@/lib/errors";
import { requestUpload } from "@/services/attachments";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.orgId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const result = await requestUpload(session as any, {
      projectId: body.projectId,
      filename: body.filename,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
      blockerId: body.blockerId,
    });
    return Response.json(result);
  } catch (e) {
    const { status, body } = jsonError(e);
    return Response.json(body, { status });
  }
}
