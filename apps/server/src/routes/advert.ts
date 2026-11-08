// `GET /api/adverts?region=` (advert:campaign-chosen-without-player-data): the hour's
// campaign per slot for a region, the same for everyone there, kept in the
// server's cache (the Cache API beside the Worker) by the region and the hour
// for at most five minutes, and
// the approved images by creative, version and hour as briefly, so a pulled
// advert leaves new visitors within five minutes (server:public-replies-cached,
// advert:reported-advert-pulled-at-once). The browser keeps either until the hour ends.
// Needs no session and reads nothing about the player. Nothing is served while
// the `adverts` switch is off (server:four-off-switches): the switch is read before the
// cache. No route here accepts anything from an advertiser (advert:submissions-never-auto-post).
import type { AdvertsReply } from "@japacity/api";
import { int, time } from "@japacity/sim";
import { Hono } from "hono";

import { advertRegion, statusAt } from "../advert/campaign";
import { emptyReply, hourOf, servedAt } from "../advert/serve";
import type { ServerDeps } from "../dependencies";
import type { SessionEnv } from "../limits/limit";
import { limit, sessionOf } from "../limits/limit";
import type { EdgeCache } from "./cache";
import { edgeCache, edgeKey, JSON_TYPE, sent, throughEdge, throughEdgeIfAny } from "./cache";

/** Whether the `adverts` switch is on. */
export type AdvertsOn = () => Promise<boolean>;

/** For a router built without the switch row, as some tests build it; the app passes `isOn(deps, "adverts")`. */
export const advertsOnByDefault: AdvertsOn = () => Promise.resolve(true);

const VERSION = /^[1-9]\d{0,8}$/;

function secondsTo(until: number, now: number): number {
  return Math.max(1, int.divCeil(until - now, time.SECOND_MS));
}

/** advert:reported-advert-pulled-at-once, server:public-replies-cached: the longest the server's cache keeps an advert reply, so a pull reaches new visitors within it. */
export const ADVERT_KEPT_MS = 5 * time.MINUTE_MS;

/**
 * server:public-replies-cached: each route counts its limit first, then reads the switch, then
 * the cache, then the database. The slots' key is the region and the hour, the
 * image's the creative, its version and the hour: what makes each the same for
 * everyone. The server's cache keeps each for at most ADVERT_KEPT_MS, so a campaign
 * pulled within the hour leaves new visitors within five minutes; the browser
 * keeps it until the hour ends.
 */
export function advertRoutes(deps: ServerDeps, on: AdvertsOn = advertsOnByDefault, edge: EdgeCache | null = edgeCache()): Hono<SessionEnv> {
  const route = new Hono<SessionEnv>();

  route.get("/api/adverts", limit(deps, "reads"), async (c) => {
    const now = deps.now();
    const region = advertRegion(deps.config.advert.regions, c.req.query("region"));
    // advert:campaign-chosen-without-player-data: an account in the admin list is served nothing, and the reply is kept by no cache.
    const account = sessionOf(c)?.account;
    if (account !== undefined && deps.config.admin.accounts.includes(account)) {
      c.header("cache-control", "no-store");
      return c.json(emptyReply(region, now));
    }
    if (!(await on())) {
      const empty: AdvertsReply = emptyReply(region, now);
      c.header("cache-control", `public, max-age=${String(secondsTo(empty.until, now))}`);
      return c.json(empty);
    }
    const key = edgeKey(new URL(c.req.url).origin, ["adverts", region, hourOf(now)]);
    const served = await throughEdge(edge, key, now, async () => {
      const reply = await servedAt(deps, region, now);
      return { body: JSON.stringify(reply), type: JSON_TYPE, freshUntil: reply.until, keptUntil: now + ADVERT_KEPT_MS };
    });
    return sent(c, served);
  });

  route.get("/api/adverts/image/:creative/:version", limit(deps, "reads"), async (c) => {
    const asked = c.req.param("version");
    if (!VERSION.test(asked) || !(await on())) return c.notFound();
    const now = deps.now();
    const id = c.req.param("creative");
    const key = edgeKey(new URL(c.req.url).origin, ["advert-image", id, Number(asked), hourOf(now)]);
    const served = await throughEdgeIfAny(edge, key, now, async () => {
      const creative = await deps.stores.adverts.creative(id, Number(asked));
      const campaign = creative === null ? null : await deps.stores.adverts.campaign(creative.campaign);
      // advert:submissions-never-auto-post: nothing waiting for review, refused or pulled is ever served.
      if (creative === null || creative.status !== "approved" || campaign === null || statusAt(campaign, now) !== "live") return null;
      const image = await deps.stores.adverts.image(creative.id, creative.version);
      if (image === null) return null;
      return { body: image.slice().buffer, type: `image/${creative.file.format}`, freshUntil: emptyReply("", now).until, keptUntil: now + ADVERT_KEPT_MS };
    });
    if (served === null) return c.notFound();
    return sent(c, served);
  });

  return route;
}
