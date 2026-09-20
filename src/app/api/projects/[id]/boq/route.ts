import { auth } from "@/auth";
import { addBoqItems } from "@/services/projects";
import { asSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;
  let body: {
    items?: Array<{
      itemNo: string;
      itemDescription: string;
      unit?: string;
      poQty: number;
      deliveredQty?: number;
    }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const items = await addBoqItems(asSession(session), projectId, body.items || []);
    return NextResponse.json({ items }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to add BOQ";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
