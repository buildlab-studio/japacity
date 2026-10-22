// server:no-platform-error-page: every failure answered in JSON the client can read, never the
// platform's error page, with the security headers and one log line.
import { DatabaseUnavailable } from "@japacity/db";
import { afterEach, describe, expect, test, vi } from "vitest";

import { makeApp } from "../app";
import { testDeps } from "../app.testing";
import { memoryStores } from "../dependencies";
import type { Stores } from "../dependencies";
import { answered, failureReply, failureStatus, RETRY_AFTER_SECONDS } from "./fail";
import { SECURITY_HEADERS } from "./headers";

afterEach(() => {
  vi.restoreAllMocks();
});

/** The console's error lines while `run` runs, parsed; nothing reaches the terminal. */
async function linesDuring(run: () => Promise<unknown>): Promise<Record<string, unknown>[]> {
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  await run();
  return error.mock.calls.map((call) => JSON.parse(String(call[0])) as Record<string, unknown>);
}

/** The memory stores with the world's reads failing as `error`. */
function failingWorld(error: Error): Stores {
  const stores = memoryStores();
  return { ...stores, world: { ...stores.world, tick: () => Promise.reject(error), latest: () => Promise.reject(error) } };
}

/** As Drizzle hands a failure up: its own error over the driver's. */
const wrapped = (cause: unknown) => new Error("Failed query: select 1\nparams: ", { cause });
const pgError = (code: string, message: string) => Object.assign(new Error(message), { code, severity: "ERROR" });

function expectDressed(reply: Response): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) expect(reply.headers.get(name)).toBe(value);
  expect(reply.headers.get("cache-control")).toBe("no-store");
  expect(reply.headers.get("content-type")).toContain("application/json");
}

describe("a failure's status", () => {
  test("[server:no-platform-error-page] given the database refusing the connection, a cut socket or connection, or a SQLSTATE that means not now, then the status is 503", () => {
    expect(failureStatus(wrapped(new DatabaseUnavailable("x", { cause: new Error("refused") })))).toBe(503);
    expect(failureStatus(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }))).toBe(503);
    expect(failureStatus(wrapped(new Error("Connection terminated unexpectedly")))).toBe(503);
    for (const code of ["08006", "40001", "40P01", "53300", "57P01", "57014", "58030"]) expect({ code, status: failureStatus(wrapped(pgError(code, "x"))) }).toEqual({ code, status: 503 });
  });

  test("[server:no-platform-error-page] given a Postgres error about the statement itself, or a fault in the server's own code, then the status is 500", () => {
    for (const code of ["23505", "42P01", "22P02"]) expect({ code, status: failureStatus(wrapped(pgError(code, "x"))) }).toEqual({ code, status: 500 });
    expect(failureStatus(new TypeError("x is not a function"))).toBe(500);
    expect(failureStatus("a thrown string")).toBe(500);
  });
});

describe("the reply to a failure", () => {
  test("[server:no-platform-error-page] [server:security-headers-on-replies] given a 503, then it is JSON unavailable with its wait in seconds, Retry-After 5, the security headers and no-store; a 500 has no wait", async () => {
    const down = failureReply(503);
    expect(down.status).toBe(503);
    expect(down.headers.get("retry-after")).toBe(String(RETRY_AFTER_SECONDS));
    expectDressed(down);
    expect(await down.json()).toEqual({ ok: false, code: "unavailable", detail: "The game's server could not reach its database. Try again shortly.", retryAfter: 5 });
    const broke = failureReply(500);
    expect(broke.status).toBe(500);
    expect(broke.headers.get("retry-after")).toBeNull();
    expectDressed(broke);
    expect(await broke.json()).toEqual({ ok: false, code: "unavailable", detail: "Something broke on the game's server." });
  });

  test("[server:no-platform-error-page] [server:shared-observability-block] given a route whose database is down, when it is asked, then app.onError answers 503 unavailable with the headers and logs one line with the path's shape, never the query", async () => {
    const app = makeApp(testDeps({ stores: failingWorld(wrapped(new DatabaseUnavailable("x"))) }));
    let reply: Response | null = null;
    const lines = await linesDuring(async () => {
      reply = await app.request("/api/world?from=ada@example.com");
    });
    if (reply === null) throw new Error("no reply");
    const answer: Response = reply;
    expect(answer.status).toBe(503);
    expect(answer.headers.get("retry-after")).toBe("5");
    expectDressed(answer);
    expect(await answer.json()).toMatchObject({ ok: false, code: "unavailable" });
    expect(lines).toEqual([{ level: "error", what: "request", method: "GET", path: "/api/world", status: 503, error: "Error", message: "Failed query: select 1", cause: "DatabaseUnavailable" }]);
  });

  test("[server:no-platform-error-page] given a route that breaks on its own code, when it is asked, then app.onError answers 500 unavailable with the headers and no wait", async () => {
    const app = makeApp(testDeps({ stores: failingWorld(new TypeError("x is not a function")) }));
    let status = 0;
    let retry: string | null = "unset";
    const lines = await linesDuring(async () => {
      const reply = await app.request("/api/world");
      status = reply.status;
      retry = reply.headers.get("retry-after");
      expectDressed(reply);
    });
    expect(status).toBe(500);
    expect(retry).toBeNull();
    expect(lines.map((line) => [line["status"], line["error"]])).toEqual([[500, "TypeError"]]);
  });

  test("[server:no-platform-error-page] [server:shared-observability-block] given a failure before or outside the app, when the request is answered, then it is 503 unavailable with the headers and one log line", async () => {
    let reply: Response | null = null;
    const lines = await linesDuring(async () => {
      reply = await answered(new Request("https://japacity.app/api/view?session=abc"), () => Promise.reject(new DatabaseUnavailable("x")));
    });
    if (reply === null) throw new Error("no reply");
    const answer: Response = reply;
    expect(answer.status).toBe(503);
    expectDressed(answer);
    expect(lines).toEqual([{ level: "error", what: "request", method: "GET", path: "/api/view", status: 503, error: "DatabaseUnavailable", message: "x" }]);
  });
});
