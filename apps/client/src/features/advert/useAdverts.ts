// The hour's slots for the player's region, read once for the hour and kept for the page's life, so the phone's home, its
// apps and the place boards coming and going ask nothing more until the hour ends (server:per-account-rate-limits,
// server:public-replies-cached). A read refused keeps the last good hour on screen; the adverts switched off clear it.
// Nothing is fetched while the view says no advert may show (advert:no-adverts-on-protected-screens).
import type { AdvertsReply } from "@japacity/api";
import { useEffect, useState } from "react";

import type { Api } from "../../shared/net/http";
import { fetchAdverts } from "./advert";

/** One region's hour as the page keeps it: the last good reply, the read in flight, and when to ask again. */
interface Kept {
  reply: AdvertsReply | null;
  asking: Promise<void> | null;
  /** The moment the server may be asked again: the hour's end, or a refusal's wait. */
  askAt: number;
}

/** By server, then by region, so a test's own server keeps its own. */
const kept = new WeakMap<Api, Map<string, Kept>>();

function keptFor(api: Api, region: string): Kept {
  let regions = kept.get(api);
  if (regions === undefined) {
    regions = new Map();
    kept.set(api, regions);
  }
  let hour = regions.get(region);
  if (hour === undefined) {
    hour = { reply: null, asking: null, askAt: 0 };
    regions.set(region, hour);
  }
  return hour;
}

/** Reads the hour unless it is kept and still fresh, or a read is already on its way; every slot shares the one read. */
function readHour(api: Api, region: string, now: () => number): Promise<void> {
  const hour = keptFor(api, region);
  if (hour.asking !== null) return hour.asking;
  if (now() < hour.askAt) return Promise.resolve();
  hour.asking = fetchAdverts(api, region).then((read) => {
    hour.asking = null;
    if (read.kind === "reply") {
      hour.reply = read.reply;
      hour.askAt = read.reply.until;
      return;
    }
    if (read.kind === "off") hour.reply = null;
    hour.askAt = now() + read.retryMs;
  });
  return hour.asking;
}

const clock = (): number => Date.now();

/** Null `api` or `region`: nothing to fetch yet, or no server at all. */
export function useAdverts(api: Api | null, region: string | null, shown: boolean, now: () => number = clock): AdvertsReply | null {
  const [reply, setReply] = useState<AdvertsReply | null>(() => (api === null || region === null ? null : keptFor(api, region).reply));
  useEffect(() => {
    if (!shown || api === null || region === null) return undefined;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      await readHour(api, region, now);
      if (!live) return;
      const hour = keptFor(api, region);
      setReply(hour.reply);
      timer = setTimeout(() => void load(), Math.max(0, hour.askAt - now()));
    };
    void load();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [api, region, shown, now]);
  return shown ? reply : null;
}
