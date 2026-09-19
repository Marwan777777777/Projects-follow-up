import { auth } from "@/auth";
import { addBoqItems } from "@/services/projects";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: projectId } = await params;
  let body: { items?: Array<{ itemNo: string; itemDescription: string; unit?: string; poQty: number }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const items = await addBoqItems(
      {
        user: {
          id: session.user.id,
          orgId: session.user.orgId,
          role: session.user.role,
          tokenVersion: session.user.tokenVersion,
        },
      },
      projectId,
      body.items || []
    );
    return NextResponse.json({ items }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to add BOQ";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
