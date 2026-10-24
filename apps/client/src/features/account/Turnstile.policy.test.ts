// server:csp-holds-every-page: the bot check's script is the one script the page loads from code, so its address is
// made by the page's Trusted Types policy, which the content policy's `trusted-types` names.
import { afterEach, describe, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  document.head.querySelectorAll("script").forEach((script) => script.remove());
});

describe("the bot check's script under Trusted Types", () => {
  test("[server:csp-holds-every-page] given a browser with Trusted Types, when the bot check's script is loaded, then its address is made by the page's one policy and set on the script", async () => {
    const asked: { name: string; urls: string[] }[] = [];
    vi.stubGlobal("trustedTypes", {
      createPolicy: (name: string, rules: { createScriptURL: (input: string) => string }) => {
        const made = { name, urls: [] as string[] };
        asked.push(made);
        return {
          createScriptURL: (input: string) => {
            made.urls.push(rules.createScriptURL(input));
            return input;
          },
        };
      },
    });
    const { loadTurnstile } = await import("./Turnstile");
    void loadTurnstile().catch(() => undefined);
    const script = document.head.querySelector("script");
    expect(script?.src).toBe("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit");
    expect(asked).toEqual([{ name: "japacity", urls: ["https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"] }]);
  });
});
