import os from "node:os";

// O nginx define X-Real-IP com o IP real do cliente (a app só escuta em 127.0.0.1,
// por isso o cabeçalho não pode vir de outro lado). Sem nginx (dev), usa X-Forwarded-For do Next.
export function getClientIp(headers: Headers): string {
  const ip = headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  return ip.trim().replace(/^::ffff:/, "");
}

// Rede interna: loopback, 10/8, 172.16/12, 192.168/16, link-local e IPv6 privados.
export function isPrivateIp(ip: string): boolean {
  if (!ip) return false;
  if (ip === "::1" || ip.startsWith("127.")) return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("169.254.")) return true;
  const m = ip.match(/^172\.(\d+)\./);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  const lower = ip.toLowerCase();
  return lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:");
}

// URL a usar nos QR codes. PUBLIC_URL tem prioridade; senão usa o primeiro IPv4 da rede local.
export function getPublicBaseUrl(): string {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  const port = process.env.PORT ?? "3000";
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === "IPv4" && !a.internal) return `http://${a.address}:${port}`;
    }
  }
  return `http://localhost:${port}`;
}
