import { auth } from "@/auth";
import { asSession } from "@/lib/session";
import { jsonError } from "@/lib/errors";
import { listBlockers, raiseBlocker, resolveBlocker } from "@/services/submissions";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  try {
    const blockers = await listBlockers(asSession(session), {
      status: url.searchParams.get("status") || undefined,
      projectId: url.searchParams.get("projectId") || undefined,
    });
    return NextResponse.json({ blockers });
  } catch (e) {
    const { status, body } = jsonError(e, "Failed to list blockers");
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { projectId?: string; description?: string; severity?: "Low" | "Medium" | "High" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  try {
    const blocker = await raiseBlocker(asSession(session), {
      projectId: body.projectId || "",
      description: body.description || "",
      severity: body.severity || "Medium",
    });
    return NextResponse.json({ blocker }, { status: 201 });
  } catch (e) {
    const { status, body: b } = jsonError(e, "Failed to raise blocker");
    return NextResponse.json(b, { status });
  }
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { blockerId?: string; resolutionNote?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  try {
    const blocker = await resolveBlocker(asSession(session), {
      blockerId: body.blockerId || "",
      resolutionNote: body.resolutionNote,
    });
    return NextResponse.json({ blocker });
  } catch (e) {
    const { status, body: b } = jsonError(e, "Failed to resolve blocker");
    return NextResponse.json(b, { status });
  }
}
