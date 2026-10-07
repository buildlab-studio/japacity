import { expect, test } from "vitest";

test("[R-DUP-001] [R-DONE-001] cites two ids", () => {
  expect(1).toBe(1);
});

test("[R-MISSING-001] cites an id that is not defined", () => {
  expect(1).toBe(1);
});
