import { auth } from "@/auth";
import { asSession } from "@/lib/session";
import { jsonError } from "@/lib/errors";
import { getProjectDetail } from "@/services/submissions";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const detail = await getProjectDetail(asSession(session), id);
    return NextResponse.json(detail);
  } catch (e) {
    const { status, body } = jsonError(e, "Failed to load project");
    return NextResponse.json(body, { status });
  }
}
