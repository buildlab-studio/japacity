import { fc, test } from "@fast-check/vitest";
import { expect } from "vitest";
import { mix } from "./clean";

test("a test file may import the test libraries", () => {
  expect(mix(1, 2)).toBeGreaterThan(0);
});

test.prop([fc.integer()])("mix is an integer", (a) => {
  expect(Number.isInteger(mix(a, a))).toBe(true);
});
