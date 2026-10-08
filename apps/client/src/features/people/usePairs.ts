// The pair record each bond with a player rests on, fetched once the screen
// shows a bond with a player and again when the bonds change.
import { useEffect, useState } from "react";

import type { PairApi } from "./pairApi";

/** Bond id to pair id. Empty offline, while loading, or when the server says no. */
export function usePairs(api: PairApi | null, bonds: readonly string[]): ReadonlyMap<string, string> {
  const [pairs, setPairs] = useState<ReadonlyMap<string, string>>(new Map());
  const key = bonds.join(" ");
  useEffect(() => {
    if (api === null || key === "") return;
    let live = true;
    api
      .pairs()
      .then((reply) => {
        if (live && reply.ok) setPairs(new Map(reply.pairs.map(({ bond, pair }) => [bond, pair])));
      })
      .catch(() => {
        // Without the pair the screens show no talk and no block; the next change asks again.
      });
    return () => {
      live = false;
    };
  }, [api, key]);
  return pairs;
}
