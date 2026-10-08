// The public randomness a draw's seed takes (docs/rules/lottery.md
// R-LOTTERY-007, R-LOTTERY-009): the League of Entropy's `quicknet` beacon,
// read through drand's HTTP API (https://docs.drand.love/developer/http-api).
// quicknet's chain info: https://api.drand.sh/v2/beacons/quicknet/info
import { int } from "@japacity/sim";

import { fromHex, sha256, toHex } from "../../../../packages/sim/src/lottery/lottery.draw";

/** A beacon: when its rounds fall, and the randomness of a round once it has been published. */
export interface Beacon {
  /** Milliseconds since 1970 of round 1. */
  genesis: number;
  /** Milliseconds between rounds. */
  period: number;
  /** The round's randomness in hex, or null when it cannot be read yet. */
  randomness: (round: number) => Promise<string | null>;
}

/** quicknet's `genesis_time` (1692803367 seconds) and `period` (3 seconds). */
export const QUICKNET_GENESIS_MS = 1692803367000;
export const QUICKNET_PERIOD_MS = 3000;
export const DRAND_URL = "https://api.drand.sh";

/**
 * R-LOTTERY-007: the first round that falls after `at`. Round `r` falls at
 * `genesis + (r - 1) * period`, so a round falling exactly at `at` is not after it.
 */
export function roundAfter(beacon: Pick<Beacon, "genesis" | "period">, at: number): number {
  return int.divFloor(at - beacon.genesis, beacon.period) + 2;
}

/** The real time a round falls. */
export function roundFallsAt(beacon: Pick<Beacon, "genesis" | "period">, round: number): number {
  return beacon.genesis + (round - 1) * beacon.period;
}

/**
 * quicknet over HTTP: `GET /v2/beacons/quicknet/rounds/{round}` answers the
 * round and its BLS signature; the randomness is the SHA-256 of the signature,
 * as drand's v1 API publishes it beside the signature.
 * the signature is not checked against quicknet's public key; that needs a BLS12-381 library.
 */
export function quicknet(fetcher: typeof fetch = fetch, base: string = DRAND_URL): Beacon {
  return {
    genesis: QUICKNET_GENESIS_MS,
    period: QUICKNET_PERIOD_MS,
    randomness: async (round) => {
      try {
        const reply = await fetcher(`${base}/v2/beacons/quicknet/rounds/${String(round)}`);
        if (!reply.ok) return null;
        const body = (await reply.json()) as { round?: unknown; signature?: unknown };
        if (body.round !== round || typeof body.signature !== "string" || body.signature.length === 0) return null;
        return toHex(sha256(fromHex(body.signature)));
      } catch {
        return null;
      }
    },
  };
}
