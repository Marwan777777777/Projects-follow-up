import { auth } from "@/auth";
import { asSession } from "@/lib/session";
import { jsonError } from "@/lib/errors";
import { submitDailyUpdate } from "@/services/submissions";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Parameters<typeof submitDailyUpdate>[1];
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const result = await submitDailyUpdate(asSession(session), body);
    return NextResponse.json(result);
  } catch (e) {
    const { status, body: b } = jsonError(e, "Failed to submit update");
    return NextResponse.json(b, { status });
  }
}
