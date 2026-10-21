import { describe, expect, it } from "vitest";
import { normalizePhone } from "@/lib/phone";

describe("normalizePhone", () => {
  it.each([
    ["912345678", "912345678"],
    ["912 345 678", "912345678"],
    ["912-345-678", "912345678"],
    ["(21) 234 5678", "212345678"],
    ["+351 912 345 678", "912345678"],
    ["00351912345678", "912345678"],
    ["+44 7911 123456", "+447911123456"],
    ["0044 7911 123456", "+447911123456"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "12345", "812345678", "91234567", "9123456789", "+12", "abc912345678", "+351 812 345 678"])(
    "recusa %j",
    (input) => {
      expect(normalizePhone(input)).toBeNull();
    },
  );
});
