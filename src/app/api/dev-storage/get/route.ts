import { contentDispositionAttachment } from "@/lib/storage/constants";
import { devConsumeGetToken, devGetObject } from "@/lib/storage/dev";

export async function GET(req: Request) {
  if (process.env.STORAGE_DRIVER !== "dev") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return Response.json({ error: "Missing token" }, { status: 400 });
  const meta = devConsumeGetToken(token);
  if (!meta) return Response.json({ error: "Invalid or expired token" }, { status: 403 });
  const obj = devGetObject(meta.key);
  if (!obj) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(new Uint8Array(obj.bytes), {
    status: 200,
    headers: {
      "Content-Type": meta.contentType,
      "Content-Disposition": contentDispositionAttachment(meta.filename),
      "Content-Length": String(obj.bytes.length),
    },
  });
}
