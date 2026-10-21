import { connection } from "next/server";
import QRCode from "qrcode";
import { getPublicBaseUrl } from "@/lib/net";

const TARGETS: Record<string, string> = { registo: "/registo", votar: "/votar", inicio: "/" };

export async function GET(request: Request) {
  await connection();
  const target = new URL(request.url).searchParams.get("t") ?? "inicio";
  const url = getPublicBaseUrl() + (TARGETS[target] ?? "/");
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, width: 512 });
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "X-Target-Url": url } });
}
