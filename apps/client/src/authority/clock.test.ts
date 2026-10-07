import { afterEach, describe, expect, test, vi } from "vitest";

import { clockMode } from "./clock";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("clockMode", () => {
  test("given a production build with the fast clock variable set, then the fast clock stays off", () => {
    vi.stubEnv("PROD", true);
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_FAST_CLOCK", "1");
    expect(clockMode()).toEqual({ fastClock: false });
  });

  test("given a production build that also claims to be a dev build, then the fast clock stays off", () => {
    vi.stubEnv("PROD", true);
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_FAST_CLOCK", "1");
    expect(clockMode()).toEqual({ fastClock: false });
  });

  test("given a dev build, then the fast clock is on", () => {
    vi.stubEnv("PROD", false);
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_FAST_CLOCK", "");
    expect(clockMode()).toEqual({ fastClock: true });
  });

  test("given a preview build with the variable set to 1, then the fast clock is on", () => {
    vi.stubEnv("PROD", false);
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_FAST_CLOCK", "1");
    expect(clockMode()).toEqual({ fastClock: true });
  });

  test("given a preview build without the variable, then the fast clock is off", () => {
    vi.stubEnv("PROD", false);
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_FAST_CLOCK", "");
    expect(clockMode()).toEqual({ fastClock: false });
  });
});
