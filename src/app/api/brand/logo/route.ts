import { connection } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  await connection();
  const s = await prisma.settings.findUnique({ where: { id: 1 }, select: { logo: true, logoMime: true } });
  if (!s?.logo || !s.logoMime) return new Response("Sem logo.", { status: 404 });
  return new Response(new Uint8Array(s.logo), {
    headers: {
      "Content-Type": s.logoMime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // SVG enviado por um admin não pode correr scripts
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
