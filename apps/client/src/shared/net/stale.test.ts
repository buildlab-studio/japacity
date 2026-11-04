// world:lazy-part-fails-softly: a tab left on an older build reloads once to the server's newer one when a part fails to download; never
// twice, and never when the builds match.
import { describe, expect, test } from "vitest";

import { STALE_KEY } from "../storage/storage";
import { removableStorage } from "../testing/storage";
import { buildIn, staleGuard } from "./stale";

function tab(own: string | null, served: () => Promise<string | null>) {
  const storage = removableStorage();
  let reloads = 0;
  let asked = 0;
  const guard = staleGuard({
    storage: () => storage,
    own: () => own,
    live: () => {
      asked += 1;
      return served();
    },
    reload: () => {
      reloads += 1;
    },
  });
  return { guard, storage, reloads: () => reloads, asked: () => asked };
}

describe("a tab on an older build (world:lazy-part-fails-softly)", () => {
  test("[world:lazy-part-fails-softly] given the served page carries a newer build than the tab's, when a part fails, then the page reloads once and the tab is marked", async () => {
    const page = tab("aaa111", () => Promise.resolve("bbb222"));
    expect(await page.guard.failed()).toBe(true);
    expect(page.reloads()).toBe(1);
    expect(page.storage.items.get(STALE_KEY)).toBe("1");
  });

  test("[world:lazy-part-fails-softly] given the tab reloaded once for a newer build and a part fails again before the life's screens load, then it never reloads a second time and the served page is not asked", async () => {
    const page = tab("aaa111", () => Promise.resolve("bbb222"));
    await page.guard.failed();
    expect(await page.guard.failed()).toBe(false);
    expect(await page.guard.failed()).toBe(false);
    expect(page.reloads()).toBe(1);
    expect(page.asked()).toBe(1);
  });

  test("[world:lazy-part-fails-softly] given the served page carries the tab's own build, when a part fails, then nothing reloads and the failure stays the soft one", async () => {
    const page = tab("aaa111", () => Promise.resolve("aaa111"));
    expect(await page.guard.failed()).toBe(false);
    expect(page.reloads()).toBe(0);
    expect(page.storage.items.has(STALE_KEY)).toBe(false);
  });

  test("[world:lazy-part-fails-softly] given the served page cannot be read (no connection, no build in it), when a part fails, then nothing reloads", async () => {
    const lost = tab("aaa111", () => Promise.reject(new TypeError("Failed to fetch")));
    const bare = tab("aaa111", () => Promise.resolve(null));
    expect(await lost.guard.failed()).toBe(false);
    expect(await bare.guard.failed()).toBe(false);
    expect(lost.reloads() + bare.reloads()).toBe(0);
  });

  test("[world:lazy-part-fails-softly] given a page with no build of its own, when a part fails, then the served page is not asked and nothing reloads", async () => {
    const page = tab(null, () => Promise.resolve("bbb222"));
    expect(await page.guard.failed()).toBe(false);
    expect(page.asked()).toBe(0);
    expect(page.reloads()).toBe(0);
  });

  test("[world:lazy-part-fails-softly] given the tab reloaded once and the life's screens then loaded, when a later release leaves it behind again, then it reloads once more", async () => {
    let served = "bbb222";
    const page = tab("aaa111", () => Promise.resolve(served));
    await page.guard.failed();
    page.guard.loaded();
    expect(page.storage.items.has(STALE_KEY)).toBe(false);
    served = "ccc333";
    expect(await page.guard.failed()).toBe(true);
    expect(page.reloads()).toBe(2);
  });

  test("[world:lazy-part-fails-softly] given no tab storage to mark the reload in, when a part fails, then nothing reloads, since a loop could not be told from a first time", async () => {
    let reloads = 0;
    const guard = staleGuard({ storage: () => null, own: () => "aaa111", live: () => Promise.resolve("bbb222"), reload: () => (reloads += 1) });
    expect(await guard.failed()).toBe(false);
    expect(reloads).toBe(0);
  });

  test("[world:lazy-part-fails-softly] [server:production-and-staging] given the page as the build writes it, when its build is read from the markup, then it is the stamp's commit, with or without changes", () => {
    expect(buildIn('<!doctype html><html><head><meta charset="UTF-8" /><meta name="japacity-build" content="7d354402233d"></head></html>')).toBe("7d354402233d");
    expect(buildIn('<head><meta content="7d354402233d+changes" name="japacity-build" /></head>')).toBe("7d354402233d+changes");
    expect(buildIn("<head><title>Japacity</title></head>")).toBeNull();
  });
});
