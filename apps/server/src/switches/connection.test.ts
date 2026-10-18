import type { Connection, Queries } from "@japacity/db";
import { describe, expect, test } from "vitest";

import { perCallHandle } from "./connection";

function opener(): { open: () => Promise<Pick<Connection, "handle" | "close">>; opened: number; closed: number } {
  const counts = { opened: 0, closed: 0 };
  const db = {} as Queries;
  return {
    get opened() {
      return counts.opened;
    },
    get closed() {
      return counts.closed;
    },
    open: () => {
      counts.opened += 1;
      return Promise.resolve({
        handle: { read: (run) => run(db), transaction: (run) => run(db) },
        close: () => {
          counts.closed += 1;
          return Promise.resolve();
        },
      });
    },
  };
}

describe("the switch store's handle in the Worker", () => {
  test("[server:four-off-switches] given reads and a transaction, when each runs, then each opens its own client and closes it, a failed one too", async () => {
    const clients = opener();
    const handle = perCallHandle(clients.open);

    expect(await handle.read(() => Promise.resolve(1))).toBe(1);
    expect(await handle.transaction(() => Promise.resolve(2))).toBe(2);
    await expect(handle.read(() => Promise.reject(new Error("refused")))).rejects.toThrow("refused");

    expect(clients.opened).toBe(3);
    expect(clients.closed).toBe(3);
  });
});
