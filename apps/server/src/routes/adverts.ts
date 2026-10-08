// `GET /api/adverts?region=` (docs/rules/adverts.md R-ADVERT-008): the hour's
// campaign per slot for a region, the same for everyone there, cached at the
// edge until the hour ends. Needs no session and reads nothing about the
// player. Nothing is served while the `adverts` switch is off (R-SERVER-031).
// No route here accepts anything from an advertiser (R-ADVERT-013).
import { int, time } from "@japacity/sim";
import { Hono } from "hono";

import { advertRegion, statusAt } from "../adverts/campaign";
import { emptyReply, servedAt } from "../adverts/serve";
import type { AdvertsReply } from "../adverts/serve";
import type { ServerDeps } from "../deps";
import type { SessionEnv } from "../limits/limit";
import { limit } from "../limits/limit";

/** Whether the `adverts` switch is on. */
export type AdvertsOn = () => Promise<boolean>;

// the switch row (R-SERVER-031) is not in this branch; read `Switches.adverts` here once it lands.
export const advertsOnByDefault: AdvertsOn = () => Promise.resolve(true);

const VERSION = /^[1-9]\d{0,8}$/;

function secondsTo(until: number, now: number): number {
  return Math.max(1, int.divCeil(until - now, time.SECOND_MS));
}

export function advertRoutes(deps: ServerDeps, on: AdvertsOn = advertsOnByDefault): Hono<SessionEnv> {
  const route = new Hono<SessionEnv>();

  route.get("/api/adverts", limit(deps, "reads"), async (c) => {
    const now = deps.now();
    const region = advertRegion(deps.config.regions, c.req.query("region"));
    const reply: AdvertsReply = (await on()) ? await servedAt(deps, region, now) : emptyReply(region, now);
    c.header("cache-control", `public, max-age=${String(secondsTo(reply.until, now))}`);
    return c.json(reply);
  });

  route.get("/api/adverts/image/:creative/:version", limit(deps, "reads"), async (c) => {
    const asked = c.req.param("version");
    if (!VERSION.test(asked) || !(await on())) return c.notFound();
    const now = deps.now();
    const creative = await deps.stores.adverts.creative(c.req.param("creative"), Number(asked));
    const campaign = creative === null ? null : await deps.stores.adverts.campaign(creative.campaign);
    // R-ADVERT-013: nothing waiting for review, refused or pulled is ever served.
    if (creative === null || creative.status !== "approved" || campaign === null || statusAt(campaign, now) !== "live") return c.notFound();
    const image = await deps.stores.adverts.image(creative.id, creative.version);
    if (image === null) return c.notFound();
    c.header("content-type", `image/${creative.file.format}`);
    c.header("cache-control", `public, max-age=${String(secondsTo(emptyReply("", now).until, now))}`);
    return c.body(image.slice().buffer);
  });

  return route;
}
