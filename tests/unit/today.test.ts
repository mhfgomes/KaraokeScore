import { afterEach, describe, expect, it, vi } from "vitest";
import { today } from "@/lib/night";

describe("today (data da noite em Lisboa)", () => {
  afterEach(() => vi.useRealTimers());

  it("depois da meia-noite em Lisboa já é o dia seguinte, mesmo com o PC em UTC", () => {
    // 23:30 UTC no horário de verão = 00:30 em Lisboa
    vi.useFakeTimers({ now: new Date("2026-08-31T23:30:00Z") });
    expect(today()).toBe("2026-09-01");
  });

  it("no inverno Lisboa está em UTC", () => {
    vi.useFakeTimers({ now: new Date("2026-12-31T23:30:00Z") });
    expect(today()).toBe("2026-12-31");
  });
});
