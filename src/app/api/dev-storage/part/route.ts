import { devConsumePartToken, devStorePart } from "@/lib/storage/dev";

export async function PUT(req: Request) {
  if (process.env.STORAGE_DRIVER !== "dev") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return Response.json({ error: "Missing token" }, { status: 400 });
  const meta = devConsumePartToken(token);
  if (!meta) return Response.json({ error: "Invalid or expired token" }, { status: 403 });
  const bytes = Buffer.from(await req.arrayBuffer());
  const etag = devStorePart(meta.uploadId, meta.partNumber, bytes);
  return new Response(null, { status: 200, headers: { ETag: etag } });
}
