// The hour's slots for the player's region, fetched again when the hour ends.
// Nothing is fetched while the view says no advert may show (advert:no-adverts-on-protected-screens).
import type { AdvertsReply } from "@japacity/api";
import { useEffect, useState } from "react";

import type { Api } from "../../shared/net/http";
import { fetchAdverts } from "./advert";

/** Null `api` or `region`: nothing to fetch yet, or no server at all. */
export function useAdverts(api: Api | null, region: string | null, shown: boolean, now: () => number = () => Date.now()): AdvertsReply | null {
  const [reply, setReply] = useState<AdvertsReply | null>(null);
  useEffect(() => {
    if (!shown || api === null || region === null) return undefined;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      const next = await fetchAdverts(api, region);
      if (!live) return;
      setReply(next);
      if (next !== null) timer = setTimeout(() => void load(), Math.max(0, next.until - now()));
    };
    void load();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [api, region, shown, now]);
  return shown ? reply : null;
}
