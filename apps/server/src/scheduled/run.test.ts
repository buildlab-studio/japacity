// server:no-platform-error-page: the scheduled jobs each run alone; a failure is caught, logged
// with the job's name (server:shared-observability-block), and never hides another.
import { afterEach, describe, expect, test, vi } from "vitest";

import { JobsFailed, runJobs } from "./run";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the scheduled run", () => {
  test("[server:no-platform-error-page] [server:shared-observability-block] given three jobs of which one rejects and one throws before it starts, when they run, then the good one finishes, each failure is logged once with its job's name, and the run's last promise names both", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    // What each kept promise settles as: "ok", or the error it rejects with.
    const kept: Promise<unknown>[] = [];
    let ticked = false;
    const failed = await runJobs(
      [
        { name: "draw", run: () => Promise.reject(Object.assign(new Error("Connection terminated unexpectedly"), { code: "08006" })) },
        {
          name: "money",
          run: () => {
            throw new TypeError("x is not a function");
          },
        },
        {
          name: "ticks",
          run: async () => {
            await Promise.resolve();
            ticked = true;
          },
        },
      ],
      (promise) => kept.push(promise.then(() => "ok", (rejected: unknown) => rejected)),
    );
    expect(ticked).toBe(true);
    expect(failed).toEqual(["draw", "money"]);
    const lines = error.mock.calls.map((call) => JSON.parse(String(call[0])) as Record<string, unknown>).sort((a, b) => String(a["job"]).localeCompare(String(b["job"])));
    expect(lines).toEqual([
      { level: "error", what: "job", job: "draw", error: "Error", message: "Connection terminated unexpectedly", code: "08006" },
      { level: "error", what: "job", job: "money", error: "TypeError", message: "x is not a function" },
    ]);
    // One kept promise per job, each settled without a rejection, then the run's own, which names the failures.
    expect(await Promise.all(kept)).toEqual(["ok", "ok", "ok", new JobsFailed(["draw", "money"])]);
  });

  test("[server:no-platform-error-page] given every job succeeding, when they run, then nothing is logged and the run's last promise resolves", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const kept: Promise<unknown>[] = [];
    expect(await runJobs([{ name: "ticks", run: () => Promise.resolve() }], (promise) => kept.push(promise))).toEqual([]);
    expect(await Promise.all(kept)).toEqual([null, undefined]);
    expect(error).not.toHaveBeenCalled();
  });
});
