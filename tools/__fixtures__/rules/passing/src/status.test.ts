import { fc, test } from "@fast-check/vitest";
import { describe, expect, it } from "vitest";

describe("[status:describe-title-rule] describe titles are not citations", () => {
  test("[status:plain-paragraph-rule] a plain test", () => {
    expect(1).toBe(1);
  });

  it(`[status:quoted-rule] a template title`, () => {
    expect(1).toBe(1);
  });

  test.prop([fc.nat()])("[status:listed-rule] a property test", (n) => n >= 0);
});

// test("[status:numbered-rule] a commented-out test does not count", () => {});
