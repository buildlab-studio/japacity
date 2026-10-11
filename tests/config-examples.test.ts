// The example settings: .env.example and each Worker's
// .dev.vars.example name every variable the code reads, each with a placeholder or a value for this machine only, and
// no value that could be a deployment's.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { localStack, parseDotEnv, WORKER_KEYS, workerEnvFile } from "../tools/local/env";
import { DEPLOYMENT_VALUES, findDeploymentValues } from "../tools/scrub-check";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path: string): string => readFileSync(join(root, path), "utf8");

const EXAMPLES = [".env.example", "apps/server/.dev.vars.example", "apps/gate/.dev.vars.example"] as const;

/** The names an example gives, set (`NAME=`) or shown commented out (`# NAME=`). */
function named(text: string): Set<string> {
  return new Set([...text.matchAll(/^#?\s*([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1] ?? ""));
}

/** Every file under a folder, tests left out. */
function sources(folder: string): string[] {
  return readdirSync(join(root, folder), { recursive: true, encoding: "utf8" })
    .filter((path) => /\.(ts|tsx)$/.test(path) && !/\.test\.tsx?$/.test(path))
    .map((path) => join(folder, path));
}

/** The keys of a Worker's `Env` whose type is a string: its variables and secrets, not its bindings. */
function envStrings(path: string): string[] {
  const text = read(path);
  const start = text.indexOf("export interface Env {");
  const body = text.slice(start, text.indexOf("\n}", start));
  return [...body.matchAll(/^\s+([A-Z][A-Z0-9_]*)\??:\s*([^;]+);/gm)].filter((match) => /\bstring\b/.test(match[2] ?? "")).map((match) => match[1] ?? "");
}

describe("the example settings", () => {
  test("given the client's code, when every VITE_ name it reads is listed, then .env.example names each one", () => {
    const read_ = new Set(sources("apps/client/src").flatMap((path) => [...read(path).matchAll(/\bVITE_[A-Z0-9_]+\b/g)].map((match) => match[0])));
    expect([...read_].sort()).toEqual(["VITE_ALLOW_LOCAL_AUTHORITY", "VITE_ANALYTICS_TOKEN", "VITE_BUILD", "VITE_FAST_CLOCK", "VITE_SERVER_URL", "VITE_TURNSTILE_SITE_KEY"]);
    const example = named(read(".env.example"));
    for (const name of read_) expect({ name, named: example.has(name) }).toEqual({ name, named: true });
  });

  test("[R-SERVER-012] given each Worker's Env, when its string keys are listed, then its .dev.vars.example names exactly those, the admin accounts among the server's", () => {
    const server = envStrings("apps/server/src/index.ts");
    expect(server).toContain("ADMIN_ACCOUNTS");
    expect(server).toContain("BETTER_AUTH_SECRET");
    expect([...named(read("apps/server/.dev.vars.example"))].sort()).toEqual([...server].sort());
    const gate = envStrings("apps/gate/src/index.ts");
    expect(gate).toContain("GATE_SECRET");
    expect([...named(read("apps/gate/.dev.vars.example"))].sort()).toEqual([...gate].sort());
  });

  test("given every Worker secret the local stack hands over, when .env.example is read, then each has a value that works only on this machine", () => {
    const example = parseDotEnv(read(".env.example"));
    for (const name of WORKER_KEYS) expect({ name, value: (example[name] ?? "") !== "" }).toEqual({ name, value: true });
    for (const name of ["BETTER_AUTH_SECRET", "WORLD_SEED", "BAN_SALT", "DRAW_TOKEN_KEY"]) expect(example[name]).toMatch(/^local-only-/);
    expect(example["ADMIN_ACCOUNTS"]).toBe("");
  });

  test("given each Worker's .dev.vars.example, when its values are read, then every one is empty or a <placeholder>", () => {
    for (const path of EXAMPLES.slice(1)) {
      for (const [name, value] of Object.entries(parseDotEnv(read(path)))) expect({ path, name, placeholder: value === "" || /^<[^<>]+>$/.test(value) }).toEqual({ path, name, placeholder: true });
    }
  });

  test("given the three examples, when they are read, then none holds a real-looking value: no 32-hex or longer run, no Turnstile key, no email address, nothing the scrub check would catch", () => {
    const email = DEPLOYMENT_VALUES.find((value) => value.label === "an email address")?.pattern;
    expect(email).toBeDefined();
    for (const path of EXAMPLES) {
      const text = read(path);
      expect({ path, hex: text.match(/\b[0-9a-f]{32,}\b/gi) }).toEqual({ path, hex: null });
      expect({ path, turnstile: text.includes("0x4AAAA") }).toEqual({ path, turnstile: false });
      expect({ path, email: email === undefined ? null : text.match(email) }).toEqual({ path, email: null });
      expect({ path, hits: findDeploymentValues(path, text) }).toEqual({ path, hits: [] });
    }
  });

  test("[R-SERVER-012] [R-SERVER-038] given ADMIN_ACCOUNTS empty in .env.example, when the local stack is read, then the Worker is given no admin list; named in .env.local, it is handed on as written", () => {
    const example = parseDotEnv(read(".env.example"));
    expect(localStack(example, {}).worker["ADMIN_ACCOUNTS"]).toBeUndefined();
    const stack = localStack(example, { ADMIN_ACCOUNTS: "account.one,account.two" });
    expect(stack.worker["ADMIN_ACCOUNTS"]).toBe("account.one,account.two");
    expect(workerEnvFile(stack)).toContain("\nADMIN_ACCOUNTS=account.one,account.two\n");
  });
});
