import { describe, expect, test } from "vitest";

import type { AuditEntry, AuditStore } from "../types";
import { logRows, snapshot } from "./fixtures";

function entry(character: string, note: string): AuditEntry {
  return {
    character,
    why: "rollback",
    at: 9_000,
    note,
    segments: [{ character, segment: 1, fromV: 2, content: "content-1", start: { base: snapshot(character, 2).state } }],
    log: logRows(character, 3, 4),
    snapshots: [snapshot(character, 2, 1)],
  };
}

/** The contract every AuditStore keeps. `make` returns an empty store each time it is called. */
export function suiteForAuditStore(make: () => Promise<AuditStore>): void {
  describe("AuditStore contract", () => {
    test("[R-SERVER-009] given retired rows, when the character's audit is listed, then the entries come back exactly in the order they were retired", async () => {
      const store = await make();

      const first = await store.retire(entry("char-a", "first"));
      await store.retire(entry("char-b", "other"));
      const second = await store.retire({ ...entry("char-a", "second"), why: "upgrade" });

      const listed = await store.list("char-a");
      expect(listed).toEqual([first, second]);
      expect(listed).toEqual([
        { ...entry("char-a", "first"), n: first.n },
        { ...entry("char-a", "second"), why: "upgrade", n: second.n },
      ]);
      expect(second.n).toBeGreaterThan(first.n);
      expect(await store.list("char-c")).toEqual([]);
    });

    test("[R-SERVER-009] given a retired entry, when the caller changes what it sent or what it read, then the stored entry does not change", async () => {
      const store = await make();
      const sent = entry("char-a", "first");
      const stored = await store.retire(sent);

      sent.note = "changed";
      sent.log.pop();
      const read = await store.list("char-a");
      read[0]?.log.pop();
      stored.note = "changed too";

      expect(await store.list("char-a")).toEqual([{ ...entry("char-a", "first"), n: stored.n }]);
    });
  });
}
