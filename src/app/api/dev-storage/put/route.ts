import { devConsumePutToken, devStoreObject } from "@/lib/storage/dev";

export async function PUT(req: Request) {
  if (process.env.STORAGE_DRIVER !== "dev") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return Response.json({ error: "Missing token" }, { status: 400 });
  const meta = devConsumePutToken(token);
  if (!meta) return Response.json({ error: "Invalid or expired token" }, { status: 403 });
  const bytes = Buffer.from(await req.arrayBuffer());
  devStoreObject(meta.key, bytes, meta.contentType);
  return new Response(null, { status: 200 });
}
