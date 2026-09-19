import { auth } from "@/auth";
import { createProject, listProjects } from "@/services/projects";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projects = await listProjects({
      user: {
        id: session.user.id,
        orgId: session.user.orgId,
        role: session.user.role,
        tokenVersion: session.user.tokenVersion,
      },
    });
    return NextResponse.json({ projects });
  } catch (e) {
    console.error("list projects", e);
    return NextResponse.json({ error: "Failed to list projects" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    projectName?: string;
    clientName?: string;
    location?: string;
    poNumber?: string;
    projectPriority?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const project = await createProject(
      {
        user: {
          id: session.user.id,
          orgId: session.user.orgId,
          role: session.user.role,
          tokenVersion: session.user.tokenVersion,
        },
      },
      {
        projectName: body.projectName || "",
        clientName: body.clientName || "",
        location: body.location,
        poNumber: body.poNumber,
        projectPriority: body.projectPriority,
      }
    );
    return NextResponse.json({ project }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create project";
    console.error("create project", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
