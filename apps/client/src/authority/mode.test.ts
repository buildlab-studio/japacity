import { afterEach, describe, expect, test, vi } from "vitest";

import { authorityMode } from "./mode";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("[R-ENGINE-015] the authority a build may run", () => {
  test("[R-ENGINE-015] given a production build without the explicit setting, then the local authority is refused", () => {
    vi.stubEnv("PROD", true);
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_ALLOW_LOCAL_AUTHORITY", "");
    expect(authorityMode().authority).toBe("refused");
  });

  test("[R-ENGINE-015] given a production build that claims to be a dev build too, then the local authority is still refused", () => {
    vi.stubEnv("PROD", true);
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_ALLOW_LOCAL_AUTHORITY", "");
    expect(authorityMode().authority).toBe("refused");
  });

  test("[R-ENGINE-015] given a production build told in so many words, then the local authority runs", () => {
    vi.stubEnv("PROD", true);
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_ALLOW_LOCAL_AUTHORITY", "1");
    expect(authorityMode()).toEqual({ authority: "local" });
  });

  test("[R-ENGINE-015] given a dev build, then the local authority runs", () => {
    vi.stubEnv("PROD", false);
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_ALLOW_LOCAL_AUTHORITY", "");
    expect(authorityMode()).toEqual({ authority: "local" });
  });

  test("[R-ENGINE-015] given a server address, then the server is the authority, in production as in development", () => {
    vi.stubEnv("PROD", true);
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_ALLOW_LOCAL_AUTHORITY", "");
    vi.stubEnv("VITE_SERVER_URL", "https://play.test");
    expect(authorityMode()).toEqual({ authority: "remote", baseUrl: "https://play.test" });
    vi.stubEnv("PROD", false);
    vi.stubEnv("DEV", true);
    expect(authorityMode()).toEqual({ authority: "remote", baseUrl: "https://play.test" });
  });

  test("[R-ENGINE-015] given an empty server address in a dev build, then the local authority runs", () => {
    vi.stubEnv("PROD", false);
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_SERVER_URL", "");
    expect(authorityMode()).toEqual({ authority: "local" });
  });
});
