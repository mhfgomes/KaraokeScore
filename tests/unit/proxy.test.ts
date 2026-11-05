import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

function request(ip = "8.8.8.8") {
  return new NextRequest("http://karaoke.test/api/state", {
    headers: { "x-real-ip": ip },
  });
}

afterEach(() => vi.unstubAllEnvs());

describe("restrição configurável de rede", () => {
  it.each([undefined, "true"])("permite acesso externo com ALLOW_EXTERNAL=%s", (value) => {
    vi.stubEnv("ALLOW_EXTERNAL", value);
    expect(proxy(request()).status).toBe(200);
  });

  it("recusa acesso externo quando a restrição está ativa", () => {
    vi.stubEnv("ALLOW_EXTERNAL", "false");
    expect(proxy(request()).status).toBe(403);
    expect(proxy(request("192.168.1.10")).status).toBe(200);
  });
});
