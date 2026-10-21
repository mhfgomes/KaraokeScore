import { describe, expect, it } from "vitest";
import { formatPrice, parsePrice } from "@/lib/format";

describe("parsePrice", () => {
  it.each([
    ["2,50", 250],
    ["2.5", 250],
    ["3", 300],
    [" 0 ", 0],
  ])("%j → %i cêntimos", (input, cents) => {
    expect(parsePrice(input)).toBe(cents);
  });

  it.each(["", "  ", "abc", "-1", "2,5€"])("recusa %j", (input) => {
    expect(parsePrice(input)).toBeNull();
  });
});

describe("formatPrice", () => {
  it("formata em euros (pt-PT)", () => {
    expect(formatPrice(250).replace(/\s/g, " ")).toBe("2,50 €");
  });
});
