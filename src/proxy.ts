import { NextResponse, type NextRequest } from "next/server";
import { getClientIp, isPrivateIp } from "@/lib/net";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Pedidos que alteram dados só são aceites vindos da própria app (anti-CSRF). */
function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  // Sem Origin não é um pedido de outra página no browser (ex.: curl)
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  // Segunda barreira (a primeira é o nginx): só a rede interna tem acesso.
  if (process.env.ALLOW_EXTERNAL !== "true" && !isPrivateIp(getClientIp(request.headers))) {
    return new NextResponse("Acesso apenas na rede interna.", { status: 403 });
  }
  if (!SAFE_METHODS.has(request.method) && !isSameOrigin(request)) {
    return NextResponse.json({ error: "Origem do pedido não permitida." }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
