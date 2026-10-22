// The server's dependencies for tests: memory stores, open limits, the test
// session and a fixed clock at the epoch, with `over` in place of any of them.
import { content } from "@japacity/content";
import { memoryPresenceStore } from "@japacity/store";
import type { PresenceStore } from "@japacity/store";

import { productionConfig, testConfig } from "./config";
import { memoryStores, openLimiters, testSession } from "./dependencies";
import type { ServerDeps } from "./dependencies";

/** A test's `randomBytes`: bytes from a seeded Lehmer generator, the same on every run for the same seed. */
export function seededBytes(seed: number): ServerDeps["randomBytes"] {
  let state = seed;
  return (count) => Uint8Array.from({ length: count }, () => (state = (state * 48271) % 2147483647) & 255);
}

/** A request's init signed in as `account` through the test session, or with no session when null. */
export function asAccount(account: string | null): RequestInit {
  return account === null ? {} : { headers: { "x-test-account": account } };
}

export function testDeps(over: Partial<ServerDeps> = {}): ServerDeps {
  const config = over.config ?? testConfig({ testing: { testLogin: true } });
  return {
    config,
    stores: memoryStores(),
    contents: { current: content, previous: null },
    secrets: { worldSeed: "test-world-seed", banSalt: "test-ban-salt", drawTokenKey: "test-draw-token-key" },
    limits: openLimiters,
    session: testSession(config),
    now: () => productionConfig.clock.epoch,
    randomBytes: seededBytes(1),
    ...over,
  };
}

/** One `forget` a presence store was asked for. */
export interface Forgotten {
  places: string[];
  account: string;
  name: string;
}

/** A memory presence store that keeps every `forget` it is asked for, so a test sees who left the places and by which name. */
export function forgettingPresence(): PresenceStore & { forgotten: Forgotten[] } {
  const store = memoryPresenceStore();
  const forgotten: Forgotten[] = [];
  return {
    ...store,
    forgotten,
    forget: async (places, account, name) => {
      forgotten.push({ places: [...places], account, name });
      await store.forget(places, account, name);
    },
  };
}
