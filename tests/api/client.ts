import { DatabaseSync } from "node:sqlite";
import { inject } from "vitest";

export const baseUrl = inject("baseUrl");

type Options = { cookie?: string; ip?: string; origin?: string | null; device?: string };

/** Pedido à API como o browser faria (mesma origem). Devolve estado, JSON e cookies. */
export async function call(path: string, body?: unknown, opts: Options = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.origin !== null) headers.Origin = opts.origin ?? baseUrl;
  const cookies = [opts.cookie, opts.device && `kv_device=${opts.device}`].filter(Boolean).join("; ");
  if (cookies) headers.Cookie = cookies;
  // Cada "pessoa" com o seu IP (sem nginx à frente, o X-Real-IP passa)
  headers["X-Real-IP"] = opts.ip ?? "192.168.1.10";
  const res = await fetch(baseUrl + path, {
    method: body === undefined ? "GET" : "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, setCookie: res.headers.get("set-cookie") ?? "" };
}

export async function loginAdmin() {
  const res = await call("/api/admin/login", inject("admin"));
  if (res.status !== 200) throw new Error(`Login falhou: ${JSON.stringify(res.data)}`);
  return res.setCookie.split(";")[0];
}

/** Acesso direto à BD de teste (para simular, por ex., o fim do tempo de votação). */
export function db() {
  return new DatabaseSync(inject("dbPath"));
}

