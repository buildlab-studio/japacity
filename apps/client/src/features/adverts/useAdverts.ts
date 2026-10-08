// The hour's slots for the player's region, fetched again when the hour ends.
// Nothing is fetched while the view says no advert may show (R-ADVERT-003).
import { useEffect, useState } from "react";

import type { Api } from "../../shared/net/http";
import { fetchAdverts } from "./adverts";
import type { AdvertsReply } from "./adverts";

export function useAdverts(api: Api, region: string, shown: boolean, now: () => number = () => Date.now()): AdvertsReply | null {
  const [reply, setReply] = useState<AdvertsReply | null>(null);
  useEffect(() => {
    if (!shown) return undefined;
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
