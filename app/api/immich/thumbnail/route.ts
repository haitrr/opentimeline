import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id || !process.env.IMMICH_BASE_URL || !process.env.IMMICH_API_KEY) {
    return new Response("Not found", { status: 404 });
  }

  const size = searchParams.get("size") === "preview" ? "preview" : "thumbnail";
  const baseUrl = process.env.IMMICH_BASE_URL.replace(/\/$/, "");
  const res = await fetch(
    `${baseUrl}/api/assets/${id}/thumbnail?size=${size}`,
    { headers: { "x-api-key": process.env.IMMICH_API_KEY } }
  );

  if (!res.ok) {
    return new Response("Not found", { status: 404 });
  }

  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const buffer = await res.arrayBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
