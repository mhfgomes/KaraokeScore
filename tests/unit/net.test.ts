import { describe, expect, it } from "vitest";
import { getClientIp, isPrivateIp } from "@/lib/net";

describe("isPrivateIp", () => {
  it.each(["127.0.0.1", "::1", "10.1.2.3", "192.168.1.20", "172.16.0.1", "172.31.255.255", "169.254.1.1", "fd00::1", "fe80::1"])(
    "%s é interno",
    (ip) => expect(isPrivateIp(ip)).toBe(true),
  );

  it.each(["", "8.8.8.8", "172.15.0.1", "172.32.0.1", "193.168.1.1", "2001:db8::1"])("%j é externo", (ip) =>
    expect(isPrivateIp(ip)).toBe(false),
  );
});

describe("getClientIp", () => {
  it("prefere X-Real-IP (definido pelo nginx)", () => {
    expect(getClientIp(new Headers({ "x-real-ip": "192.168.1.5", "x-forwarded-for": "8.8.8.8" }))).toBe("192.168.1.5");
  });

  it("usa o primeiro X-Forwarded-For e tira o prefixo IPv4-mapped", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": "::ffff:10.0.0.7, 8.8.8.8" }))).toBe("10.0.0.7");
  });

  it("vazio sem cabeçalhos", () => {
    expect(getClientIp(new Headers())).toBe("");
  });
});
