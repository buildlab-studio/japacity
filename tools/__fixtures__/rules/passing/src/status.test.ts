import { fc, test } from "@fast-check/vitest";
import { describe, expect, it } from "vitest";

describe("[R-NOT-001] describe titles are not citations", () => {
  test("[R-STATUS-001] a plain test", () => {
    expect(1).toBe(1);
  });

  it(`[R-STATUS-002] a template title`, () => {
    expect(1).toBe(1);
  });

  test.prop([fc.nat()])("[R-MONEY-001] a property test", (n) => n >= 0);
});

// test("[R-MONEY-002] a commented-out test does not count", () => {});
