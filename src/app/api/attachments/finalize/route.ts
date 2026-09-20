import { auth } from "@/auth";
import { jsonError } from "@/lib/errors";
import {
  completeMultipartUpload,
  finalizeUpload,
  createAttachmentSubmission,
} from "@/services/attachments";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.orgId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    if (body.parts?.length) {
      await completeMultipartUpload(session as any, {
        attachmentId: body.attachmentId,
        parts: body.parts,
      });
    }
    const result = await finalizeUpload(session as any, {
      attachmentId: body.attachmentId,
    });
    if (body.lateArrival && body.projectId) {
      const late = await createAttachmentSubmission(session as any, {
        attachmentId: body.attachmentId,
        projectId: body.projectId,
      });
      return Response.json({ ...result, lateSubmission: late });
    }
    return Response.json(result);
  } catch (e) {
    const { status, body } = jsonError(e);
    return Response.json(body, { status });
  }
}
