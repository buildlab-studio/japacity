// server:shared-observability-block: the one log line, its fields, and that nothing else in the
// Worker writes to the console.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, test, vi } from "vitest";

import { failureLine, logFailure, MESSAGE_MAX, pathShape, scrubbed } from "./log";

const SOURCE = fileURLToPath(new URL(".", import.meta.url).href);

afterEach(() => {
  vi.restoreAllMocks();
});

/** Every file of the Worker's source: tests and the Node command lines (`*.main.ts`, run from a terminal, never deployed) left out. */
function workerFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return workerFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith(".main.ts") && !name.endsWith(".d.ts") ? [path] : [];
  });
}

/** A failure as a database that is down hands it up: Drizzle's error, whose message carries the statement's values, over the driver's. */
function failedQuery(): Error {
  const driver = Object.assign(new Error("connect ECONNREFUSED 10.1.2.3:5432"), { code: "ECONNREFUSED" });
  return new Error('Failed query: select "id" from "accounts" where "email" = $1\nparams: ada@example.com,a-session-token-value', { cause: driver });
}

describe("the server's log line", () => {
  test("[server:shared-observability-block] given a request that failed, when the line is made, then it holds what, method, the path's shape without its query, status, the error's name, first line, cause and code, and no other field", () => {
    const line = failureLine({ what: "request", method: "post", path: "https://japacity.app/api/invite/0123456789abcdef01234567/accept?token=secret-value", status: 503, error: failedQuery() });
    expect(line).toEqual({
      level: "error",
      what: "request",
      method: "POST",
      path: "/api/invite/:id/accept",
      status: 503,
      error: "Error",
      message: 'Failed query: select "id" from "accounts" where "email" = $1',
      code: "ECONNREFUSED",
      cause: "Error",
    });
    expect(JSON.stringify(line)).not.toContain("ada@example.com");
    expect(JSON.stringify(line)).not.toContain("secret-value");
    expect(JSON.stringify(line)).not.toContain("10.1.2.3");
  });

  test("[server:shared-observability-block] given a job that failed, when the line is made, then it names the job and carries no request field", () => {
    const line = failureLine({ what: "job", job: "money", error: Object.assign(new Error("deadlock detected"), { code: "40P01" }) });
    expect(line).toEqual({ level: "error", what: "job", job: "money", error: "Error", message: "deadlock detected", code: "40P01" });
  });

  test("[server:shared-observability-block] given an error's words with an email, an address, a long id or token, a quoted value or a key's value, when they are scrubbed, then each is taken out and the words are cut to 200 characters", () => {
    expect(scrubbed("no user ada@example.com")).toBe("no user <email>");
    expect(scrubbed("from 203.0.113.7 and 2001:db8::1")).toBe("from <address> and <address>");
    expect(scrubbed("session Xk9fQ2mN7pL4vR8sT1wZ3yB6 expired")).toBe("session <id> expired");
    expect(scrubbed("invalid input syntax for type integer: 'abc'")).toBe("invalid input syntax for type integer: '<value>'");
    expect(scrubbed("Key (username)=(ada) already exists.")).toBe("Key (username)=(<value>) already exists.");
    expect(scrubbed(`first line\nsecond ${"x".repeat(10)}`)).toBe("first line");
    expect(scrubbed("word ".repeat(100))).toHaveLength(MESSAGE_MAX);
  });

  test("[server:shared-observability-block] given an error's words with double-quoted values, as Postgres quotes input, and an email written with %40, when they are scrubbed, then each is taken out", () => {
    expect(scrubbed('invalid input syntax for type uuid: "bisi-okafor"')).toBe('invalid input syntax for type uuid: "<value>"');
    expect(scrubbed('invalid input value for enum region: "Adaeze"')).toBe('invalid input value for enum region: "<value>"');
    expect(scrubbed('password authentication failed for user "neondb_owner"')).toBe('password authentication failed for user "<value>"');
    expect(scrubbed('relation "a" and "b c" differ')).toBe('relation "<value>" and "<value>" differ');
    expect(scrubbed("could not send to bisi%40gmail.com")).toBe("could not send to <email>");
    expect(scrubbed("could not send to BISI%40Gmail.COM now")).toBe("could not send to <email> now");
    expect(JSON.stringify(failureLine({ what: "request", method: "GET", path: "/api/view", status: 500, error: new Error('invalid input syntax for type uuid: "bisi-okafor"') }))).not.toContain("bisi-okafor");
  });

  test("[server:shared-observability-block] given paths with ids, codes, pair keys and content ids, when their shape is taken, then route words and content ids stay and every other segment is :id", () => {
    expect(pathShape("/api/health")).toBe("/api/health");
    expect(pathShape("/api/place/place.ojuelegba/socket")).toBe("/api/place/place.ojuelegba/socket");
    expect(pathShape("/api/pair/char-1:char-2/say")).toBe("/api/pair/:id/say");
    expect(pathShape("/api/load/rows/c0ffee12")).toBe("/api/load/rows/:id");
    expect(pathShape("/api/auth/callback/google?code=abc&state=def")).toBe("/api/auth/callback/google");
    expect(pathShape("/api/draw/12")).toBe("/api/draw/:id");
  });

  test("[server:shared-observability-block] given a failure, when it is logged, then one console.error line is written, and it is the line as JSON", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    logFailure({ what: "job", job: "ticks", error: new TypeError("x is not a function") });
    expect(error).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
    expect(JSON.parse(String(error.mock.calls[0]?.[0]))).toEqual({ level: "error", what: "job", job: "ticks", error: "TypeError", message: "x is not a function" });
  });

  test("[server:shared-observability-block] given the Worker's source, when every file but log.ts is read, then none writes to the console", () => {
    const writers = workerFiles(SOURCE)
      .filter((path) => !path.endsWith(join("src", "log.ts")))
      .filter((path) => /\bconsole\s*\./.test(readFileSync(path, "utf8")))
      .map((path) => relative(SOURCE, path));
    expect(writers).toEqual([]);
    expect(workerFiles(SOURCE).length).toBeGreaterThan(50);
  });
});
