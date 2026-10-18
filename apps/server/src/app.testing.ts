// The server's dependencies for tests: memory stores, open limits, the test
// session and a fixed clock at the epoch, with `over` in place of any of them.
import { content } from "@japacity/content";

import { productionConfig, testConfig } from "./config";
import { memoryStores, openLimiters, testSession } from "./deps";
import type { ServerDeps } from "./deps";

export function testDeps(over: Partial<ServerDeps> = {}): ServerDeps {
  let seed = 1;
  const config = over.config ?? testConfig({ testing: { testLogin: true } });
  return {
    config,
    stores: memoryStores(),
    contents: { current: content, previous: null },
    secrets: { worldSeed: "test-world-seed", banSalt: "test-ban-salt", drawTokenKey: "test-draw-token-key" },
    limits: openLimiters,
    session: testSession(config),
    now: () => productionConfig.clock.epoch,
    randomBytes: (count) => Uint8Array.from({ length: count }, () => (seed = (seed * 48271) % 2147483647) & 255),
    ...over,
  };
}
