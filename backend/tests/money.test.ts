import { describe, expect, it } from "vitest";
import { InvalidAmountError, toMinorUnits, tryToMinorUnits } from "../src/lib/money";

describe("toMinorUnits", () => {
  it.each([
    [0, 0],
    [1, 100],
    [499, 49900],
    [499.5, 49950],
    [499.99, 49999],
    [0.01, 1],
    [10.15, 1015],
    ["10.15", 1015],
    ["10.1", 1010],
    ["  7 ", 700],
  ])("%j -> %d paise", (input, expected) => {
    expect(toMinorUnits(input)).toBe(expected);
  });

  it.each([
    [0.1 + 0.2],
    [499.501],
    [-1],
    [Number.NaN],
    [Number.POSITIVE_INFINITY],
    [1e21],
    ["1e3"],
    ["10.155"],
    ["-5"],
    [""],
    ["abc"],
    [null],
    [undefined],
    [{}],
    [Number.MAX_SAFE_INTEGER],
  ])("rejects %j", (input) => {
    expect(() => toMinorUnits(input)).toThrow(InvalidAmountError);
    expect(tryToMinorUnits(input)).toBeNull();
  });

  it("distinguishes amounts that differ by one paisa, unlike a 0.01 float tolerance", () => {
    expect(toMinorUnits(499.5)).not.toBe(toMinorUnits(499.51));
    expect(toMinorUnits(499.5)).not.toBe(toMinorUnits(499.49));
  });
});
