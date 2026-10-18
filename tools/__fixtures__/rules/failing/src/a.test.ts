import { expect, test } from "vitest";

test("[a:defined-twice] [a:pending-now-tested] cites two names", () => {
  expect(1).toBe(1);
});

test("[a:never-defined] cites a name that is not defined", () => {
  expect(1).toBe(1);
});
