import { describe, expect, it } from "vitest";
import { call, loginAdmin } from "./client";

describe("acesso e segurança", () => {
  it("recusa IPs fora da rede interna", async () => {
    const res = await call("/api/state", undefined, { ip: "8.8.8.8" });
    expect(res.status).toBe(403);
  });

  it("ações de admin exigem sessão", async () => {
    expect((await call("/api/admin/night", { action: "open" })).status).toBe(401);
    expect((await call("/api/admin/night")).status).toBe(401);
    expect((await call("/api/admin/users", { username: "x", password: "y".repeat(10) })).status).toBe(401);
  });

  it("login com password errada falha", async () => {
    const res = await call("/api/admin/login", { username: "teste", password: "errada" });
    expect(res.status).toBe(401);
  });

  it("recusa pedidos de outra origem (CSRF), mesmo com sessão válida", async () => {
    const cookie = await loginAdmin();
    const res = await call("/api/admin/night", { action: "open" }, { cookie, origin: "http://evil.local" });
    expect(res.status).toBe(403);
    expect(res.data.error).toMatch(/Origem/);
  });

  it("o cookie de sessão é httpOnly", async () => {
    const res = await call("/api/admin/login", { username: "teste", password: "password-de-teste" });
    expect(res.setCookie).toMatch(/kv_admin=/);
    expect(res.setCookie.toLowerCase()).toContain("httponly");
  });
});
