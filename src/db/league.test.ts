import { expect, test } from "bun:test";
import { romanToNumeral } from "./league";

test("roman", () => {
    expect(romanToNumeral("I")).toBe(1);
    expect(romanToNumeral("II")).toBe(2);
    expect(romanToNumeral("III")).toBe(3);
    expect(romanToNumeral("IV")).toBe(4);
});