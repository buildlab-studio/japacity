// The one seeded generator the assets draw with, free of three so the patterns' light entry can read it.

/**
 * A seeded generator in [0, 1): the same seed gives the same building (R-ASSET-018) and the same motif (R-ASSET-013)
 * every time. It is the design's, kept so a seed draws what it drew there.
 */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
