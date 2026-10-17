import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { int, time } from "@japacity/sim";
import { describe, expect, test, vi } from "vitest";

import { testDeps } from "../app.test";
import { makeApp } from "../app";
import { addAdvertCounters, ADVERT_COUNTERS } from "../adverts/counts";
import { advertLinksJob, recheckWindow } from "../adverts/job";
import type { Fetcher } from "../adverts/links";
import type { AdvertsReply } from "../adverts/serve";
import { base64, jpegOf, pngOf, webpOf } from "../adverts/testing";
import { productionConfig, testConfig } from "../config";
import type { ServerDeps } from "../deps";
import { testSession } from "../deps";
import { tickPeriodMs, TICKS_CRON } from "../jobs/ticks";
import { tickRow } from "../world/ticks";
import { adminAdvertRoutes } from "./admin-adverts";
import { ADVERT_KEPT_MS, advertRoutes, advertsOnByDefault } from "./adverts";
import { edgeKey } from "./edge";
import { fakeEdge } from "./edge.testing";

const ADMIN = "account.owner";
const EPOCH = productionConfig.clock.epoch;
const BILLBOARD = content.advert["advert.road-billboard"];
const TILE = content.advert["advert.phone-tile"];
if (BILLBOARD === undefined || TILE === undefined) throw new Error("The launch slots are missing.");

interface Clock {
  at: number;
}

function world(clock: Clock = { at: EPOCH }, over: Partial<ServerDeps> = {}): ServerDeps {
  const config = testConfig({ testing: { testLogin: true }, admin: { accounts: [ADMIN] } });
  return testDeps({ config, session: testSession(config), now: () => clock.at, ...over });
}

type App = ReturnType<typeof makeApp>;

async function call(app: App, method: "GET" | "POST", path: string, body?: unknown, account: string | null = ADMIN) {
  const headers: Record<string, string> = account === null ? {} : { "x-test-account": account };
  if (body !== undefined) headers["content-type"] = "application/json";
  const reply = await app.request(path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: reply.status, body: await reply.json<Record<string, unknown> & { ok: boolean }>(), headers: reply.headers };
}

const ADVERTISER = { businessName: "Mama Put Kitchen", registration: { country: "NG", number: "RC-1234567" }, contactName: "A. Contact", contactEmail: "contact@example.com" };
const NG_CHECKS = ["registered-business", "category", "regulator-approval"];
const CREATIVE_CHECKS = ["format", "not-game-like", "text", "link-domain"];

interface CampaignOver {
  slots?: string[];
  regions?: string[];
  starts?: number;
  ends?: number;
  category?: string;
  place?: unknown;
}

async function advertiser(app: App): Promise<string> {
  const made = await call(app, "POST", "/api/admin/adverts/advertisers", ADVERTISER);
  return (made.body.advertiser as { id: string }).id;
}

async function campaign(app: App, over: CampaignOver = {}) {
  return call(app, "POST", "/api/admin/adverts/campaigns", {
    advertiser: await advertiser(app),
    slots: ["advert.road-billboard", "advert.phone-tile"],
    regions: ["NG"],
    starts: EPOCH - time.HOUR_MS,
    ends: EPOCH + 30 * time.DAY_MS,
    category: "general",
    ...over,
  });
}

async function creative(app: App, id: string, image: Uint8Array = pngOf(BILLBOARD!.width, BILLBOARD!.height), text = "Jollof on the island.", link: string | null = "https://example.com/menu", creativeId?: string) {
  return call(app, "POST", `/api/admin/adverts/campaigns/${id}/creatives`, { image: base64(image), text, link, ...(creativeId === undefined ? {} : { creative: creativeId }) });
}

/** A campaign in NG with one billboard creative, both approved. */
async function live(app: App, over: CampaignOver = {}, text = "Jollof on the island.") {
  const made = await campaign(app, over);
  const id = (made.body.campaign as { id: string }).id;
  const added = await creative(app, id, undefined, text);
  const art = added.body.creative as { id: string; version: number };
  expect((await call(app, "POST", `/api/admin/adverts/campaigns/${id}/approve`, { checks: NG_CHECKS })).status).toBe(200);
  expect((await call(app, "POST", `/api/admin/adverts/creatives/${art.id}/1/approve`, { checks: CREATIVE_CHECKS })).status).toBe(200);
  return { campaign: id, creative: art.id };
}

async function served(app: App, region = "NG", account: string | null = null): Promise<AdvertsReply> {
  return (await call(app, "GET", `/api/adverts?region=${region}`, undefined, account)).body as unknown as AdvertsReply;
}

describe("serving the hour's campaign", () => {
  test("[R-ADVERT-008] given a live campaign, when two players and a stranger in the region ask in the same hour, then each gets the same campaign in the slot, and another region gets none", async () => {
    const app = makeApp(world());
    const { campaign: id, creative: art } = await live(app);
    const first = await served(app, "NG", "account.one");
    expect(first.slots["advert.road-billboard"]).toEqual({ campaign: id, creative: art, version: 1, image: `/api/adverts/image/${art}/1`, width: 1024, height: 512, advertiser: ADVERTISER.businessName, text: "Jollof on the island.", link: "https://example.com/menu" });
    expect(first.slots["advert.phone-tile"]).toBeUndefined();
    expect(await served(app, "NG", "account.two")).toEqual(first);
    expect(await served(app, "ng", null)).toEqual(first);
    expect((await served(app, "GB")).slots).toEqual({});
  });

  test("[R-ADVERT-008] given two live campaigns in one slot, when the hour turns, then the slot changes campaign exactly at the boundary and the reply is cached to it", async () => {
    const clock = { at: EPOCH };
    const app = makeApp(world(clock));
    const a = await live(app);
    const b = await live(app);
    const hour = int.divFloor(EPOCH, time.HOUR_MS);
    clock.at = (hour + 1) * time.HOUR_MS - 1;
    const before = await call(app, "GET", "/api/adverts?region=NG", undefined, null);
    clock.at = (hour + 1) * time.HOUR_MS;
    const after = await call(app, "GET", "/api/adverts?region=NG", undefined, null);
    const shown = (reply: typeof before) => (reply.body as unknown as AdvertsReply).slots["advert.road-billboard"]?.campaign;
    expect([shown(before), shown(after)].sort()).toEqual([a.campaign, b.campaign].sort());
    expect(before.body.until).toBe((hour + 1) * time.HOUR_MS);
    expect(before.headers.get("cache-control")).toBe("public, max-age=1");
    expect(after.headers.get("cache-control")).toBe(`public, max-age=${String(time.HOUR_MS / time.SECOND_MS)}`);
  });

  test("[R-ADVERT-008] given a country not in the table, when it asks, then it is served the default row's campaigns", async () => {
    const app = makeApp(world());
    const { campaign: id } = await live(app, { regions: ["default"] });
    expect((await served(app, "ZZ")).slots["advert.road-billboard"]?.campaign).toBe(id);
    expect((await served(app, "")).region).toBe("default");
    expect((await served(app, "NG")).slots).toEqual({});
  });

  test("[R-ADVERT-003] [R-SERVER-031] given the adverts switch off, when the slots and an approved image are asked for, then nothing is served", async () => {
    const deps = world();
    const app = makeApp(deps);
    const { creative: art } = await live(app);
    const off = advertRoutes(deps, () => Promise.resolve(false));
    const reply = await (await off.request("/api/adverts?region=NG")).json<AdvertsReply>();
    expect(reply.slots).toEqual({});
    expect((await off.request(`/api/adverts/image/${art}/1`)).status).toBe(404);
    expect((await app.request(`/api/adverts/image/${art}/1`)).status).toBe(200);
  });

  test("[R-ADVERT-004] given an approved creative, when its image is fetched, then the stored bytes come back as the measured format", async () => {
    const app = makeApp(world());
    const { creative: art } = await live(app);
    const reply = await app.request(`/api/adverts/image/${art}/1`);
    expect(reply.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await reply.arrayBuffer())).toEqual(pngOf(1024, 512));
  });
});

describe("taking a creative for review", () => {
  test("[R-ADVERT-004] given a billboard creative exactly at the byte limit, when it is entered, then it waits for review; one byte over is refused", async () => {
    const app = makeApp(world());
    const id = ((await campaign(app)).body.campaign as { id: string }).id;
    const at = await creative(app, id, pngOf(1024, 512, BILLBOARD.maxBytes));
    expect(at.body).toMatchObject({ ok: true, creative: { file: { format: "png", width: 1024, height: 512, bytes: BILLBOARD.maxBytes }, status: "pending", version: 1 } });
    const over = await creative(app, id, pngOf(1024, 512, BILLBOARD.maxBytes + 1));
    expect(over.status).toBe(422);
    expect(over.body.refusals).toEqual([`The image is ${String(BILLBOARD.maxBytes + 1)} bytes, over advert.road-billboard's limit of ${String(BILLBOARD.maxBytes)} (R-ADVERT-004).`]);
  });

  test("[R-ADVERT-004] given images of a size no slot of the campaign has, or that move, when they are entered, then each is refused", async () => {
    const app = makeApp(world());
    const id = ((await campaign(app)).body.campaign as { id: string }).id;
    expect((await creative(app, id, pngOf(512, 768))).body.refusals).toEqual(["The image is 512 by 768, the size of none of the campaign's slots (R-ADVERT-004)."]);
    expect((await creative(app, id, pngOf(1024, 512, 1000, true))).body.refusals).toEqual(["The image moves; an advert is one still image (R-ADVERT-004)."]);
    expect((await creative(app, id, webpOf(256, 256, "extended", true))).status).toBe(422);
    expect((await creative(app, id, webpOf(TILE.width, TILE.height))).status).toBe(200);
  });

  test("[R-ADVERT-005] given a link that is not https, a second link in the text, or two lines, when they are entered, then each is refused; no link at all is allowed", async () => {
    const app = makeApp(world());
    const id = ((await campaign(app)).body.campaign as { id: string }).id;
    expect((await creative(app, id, undefined, "Fresh food.", "http://example.com")).body.refusals).toEqual(["The link is https (R-ADVERT-005)."]);
    expect((await creative(app, id, undefined, "See www.example.com", null)).body.refusals).toEqual(["The text carries no link; the one link is its own field (R-ADVERT-005)."]);
    expect((await creative(app, id, undefined, "One.\nTwo.", null)).body.refusals).toEqual(["The text is one line (R-ADVERT-005)."]);
    expect((await creative(app, id, undefined, "Fresh food.", "https://user:pass@example.com")).body.refusals).toEqual(["The link carries no sign-in details (R-ADVERT-005)."]);
    expect((await creative(app, id, undefined, "Fresh food.", null)).status).toBe(200);
  });

  test("[R-ADVERT-006] given text that reads as a bank alert or a news story, when it is entered, then it is refused", async () => {
    const app = makeApp(world());
    const id = ((await campaign(app)).body.campaign as { id: string }).id;
    for (const text of ["Credit alert: N50,000 received.", "Breaking news from the island."]) expect((await creative(app, id, undefined, text)).body.refusals).toEqual(["The advert reads as the banned impersonation (R-ADVERT-015)."]);
  });
});

describe("the review", () => {
  test("[R-ADVERT-010] given a pending creative, when it is approved without every check, then it stays pending; with them, the reviewer, time, checks and banned list are recorded", async () => {
    const clock = { at: EPOCH };
    const app = makeApp(world(clock));
    const id = ((await campaign(app)).body.campaign as { id: string }).id;
    const art = ((await creative(app, id)).body.creative as { id: string }).id;
    const short = await call(app, "POST", `/api/admin/adverts/creatives/${art}/1/approve`, { checks: ["format"], note: "", paid: true });
    expect(short.status).toBe(409);
    expect(short.body).toMatchObject({ code: "unchecked", missing: ["not-game-like", "text", "link-domain"] });
    clock.at = EPOCH + 5;
    expect((await call(app, "POST", `/api/admin/adverts/creatives/${art}/1/approve`, { checks: CREATIVE_CHECKS, note: "Looked at the menu page." })).body).toMatchObject({ ok: true, creative: { status: "approved" } });
    const listed = (await call(app, "GET", "/api/admin/adverts/campaigns")).body.campaigns as { reviews: unknown[] }[];
    expect(listed[0]?.reviews).toEqual([{ creative: art, version: 1, reviewer: ADMIN, at: EPOCH + 5, checks: CREATIVE_CHECKS, bannedListVersion: "2026-10-08", outcome: "approved", note: "Looked at the menu page." }]);
    expect((await call(app, "POST", `/api/admin/adverts/creatives/${art}/1/approve`, { checks: CREATIVE_CHECKS })).body).toMatchObject({ code: "not-pending" });
  });

  test("[R-ADVERT-010] given an approved creative in a campaign not yet approved, when the slots are asked for, then nothing shows", async () => {
    const app = makeApp(world());
    const id = ((await campaign(app)).body.campaign as { id: string }).id;
    const art = ((await creative(app, id)).body.creative as { id: string }).id;
    await call(app, "POST", `/api/admin/adverts/creatives/${art}/1/approve`, { checks: CREATIVE_CHECKS });
    expect((await served(app)).slots).toEqual({});
    await call(app, "POST", `/api/admin/adverts/campaigns/${id}/approve`, { checks: NG_CHECKS });
    expect((await served(app)).slots["advert.road-billboard"]?.creative).toBe(art);
  });

  test("[R-ADVERT-011] given a live creative, when a changed version is entered, then the approved version keeps showing until the new one is approved", async () => {
    const app = makeApp(world());
    const { campaign: id, creative: art } = await live(app);
    const changed = await creative(app, id, undefined, "Now with suya.", "https://example.com/menu", art);
    expect(changed.body).toMatchObject({ ok: true, creative: { id: art, version: 2, status: "pending" } });
    expect((await served(app)).slots["advert.road-billboard"]).toMatchObject({ version: 1, text: "Jollof on the island." });
    expect((await app.request(`/api/adverts/image/${art}/2`)).status).toBe(404);
    await call(app, "POST", `/api/admin/adverts/creatives/${art}/2/approve`, { checks: CREATIVE_CHECKS });
    expect((await served(app)).slots["advert.road-billboard"]).toMatchObject({ version: 2, text: "Now with suya." });
  });

  test("[R-ADVERT-012] given a campaign shown in Nigeria, when it is approved without the regulator's approval recorded, then it is not; a campaign only in GB does not need it", async () => {
    const app = makeApp(world());
    const ng = ((await campaign(app)).body.campaign as { id: string }).id;
    expect((await call(app, "POST", `/api/admin/adverts/campaigns/${ng}/approve`, { checks: ["registered-business", "category"] })).body).toMatchObject({ code: "unchecked", missing: ["regulator-approval"] });
    const gb = ((await campaign(app, { regions: ["GB"] })).body.campaign as { id: string }).id;
    expect((await call(app, "POST", `/api/admin/adverts/campaigns/${gb}/approve`, { checks: ["registered-business", "category"] })).body).toMatchObject({ ok: true, campaign: { status: "approved" } });
  });

  test("[R-ADVERT-013] given a creative waiting for review, when anyone outside the admin view asks for it or sends a submission, then nothing is served and nothing is taken", async () => {
    const app = makeApp(world());
    const id = ((await campaign(app)).body.campaign as { id: string }).id;
    const art = ((await creative(app, id)).body.creative as { id: string }).id;
    expect((await app.request(`/api/adverts/image/${art}/1`)).status).toBe(404);
    expect((await served(app)).slots).toEqual({});
    for (const path of ["/api/adverts", "/api/adverts/submit", `/api/adverts/image/${art}/1`]) {
      expect((await app.request(path, { method: "POST", body: "{}", headers: { "content-type": "application/json" } })).status).toBe(404);
    }
    for (const account of [null, "account.player"]) {
      const headers: Record<string, string> = { "content-type": "application/json", ...(account === null ? {} : { "x-test-account": account }) };
      expect((await app.request("/api/admin/adverts/advertisers", { method: "POST", headers, body: JSON.stringify(ADVERTISER) })).status).toBe(404);
    }
  });

  test("[R-MODERATION-012] given a session not on the admin list, when any advert admin route is asked, then it does not exist", async () => {
    const app = makeApp(world());
    for (const [method, path] of [["GET", "/api/admin/adverts/campaigns"], ["POST", "/api/admin/adverts/campaigns"], ["GET", "/api/admin/adverts/campaigns/x/counts"]] as const) {
      expect((await app.request(path, { method, headers: { "x-test-account": "account.player" } })).status).toBe(404);
    }
  });

  test("[R-ADVERT-014] given a live advert, when it is pulled, then it leaves rotation at once and both the campaign and the creative wait for review again", async () => {
    const app = makeApp(world());
    const { campaign: id, creative: art } = await live(app);
    expect((await call(app, "POST", `/api/admin/adverts/campaigns/${id}/pull`, {})).body).toMatchObject({ ok: true, campaign: { status: "paused" } });
    expect((await served(app)).slots).toEqual({});
    expect((await app.request(`/api/adverts/image/${art}/1`)).status).toBe(404);
    await call(app, "POST", `/api/admin/adverts/campaigns/${id}/approve`, { checks: NG_CHECKS });
    expect((await served(app)).slots).toEqual({});
    await call(app, "POST", `/api/admin/adverts/creatives/${art}/1/approve`, { checks: CREATIVE_CHECKS });
    expect((await served(app)).slots["advert.road-billboard"]?.campaign).toBe(id);
  });

  test("[R-ADVERT-014] given a link that now lands on another domain, when it is rechecked, then the campaign is pulled; one that holds is left", async () => {
    const deps = world();
    const app = makeApp(deps);
    const { campaign: id } = await live(app);
    const holds: Fetcher = (input) => Promise.resolve(Object.defineProperty(new Response("ok"), "url", { value: input }));
    const moved: Fetcher = () => Promise.resolve(Object.defineProperty(new Response("ok"), "url", { value: "https://elsewhere.test/" }));
    const ok = await adminAdvertRoutes(deps, holds).request(`/campaigns/${id}/recheck`, { method: "POST", headers: { "x-test-account": ADMIN } });
    expect(await ok.json()).toEqual({ ok: true, failing: [], pulled: false });
    const bad = await adminAdvertRoutes(deps, moved).request(`/campaigns/${id}/recheck`, { method: "POST", headers: { "x-test-account": ADMIN } });
    expect(await bad.json()).toEqual({ ok: true, failing: ["https://example.com/menu"], pulled: true });
    expect((await deps.stores.adverts.campaign(id))?.status).toBe("paused");
  });

  test("[R-ADVERT-014] given approved campaigns, when the five-minute job runs, then only one starting before the next run has its links rechecked and is pulled when they fail", async () => {
    // The job is handed the deployment's tick period; five minutes here.
    const FIVE = tickPeriodMs(TICKS_CRON);
    const clock = { at: EPOCH };
    const deps = world(clock);
    const app = makeApp(deps);
    const soon = await live(app, { starts: EPOCH + FIVE - 1 });
    const later = await live(app, { starts: EPOCH + FIVE });
    const failing: Fetcher = () => Promise.reject(new Error("offline"));
    expect(await advertLinksJob(deps, "0 0 * * *", failing, FIVE)).toEqual([]);
    expect(await advertLinksJob(deps, TICKS_CRON, failing, FIVE)).toEqual([soon.campaign]);
    expect((await deps.stores.adverts.campaign(later.campaign))?.status).toBe("approved");
  });

  test("[R-ADVERT-014] given the tick crons, when their periods are read, then five and thirty minutes come back and a cron of any other form is refused", () => {
    expect(tickPeriodMs("*/5 * * * *")).toBe(5 * time.MINUTE_MS);
    expect(tickPeriodMs("*/30 * * * *")).toBe(30 * time.MINUTE_MS);
    for (const cron of ["0 0 * * *", "*/7 * * * *", "*/0 * * * *", "*/90 * * * *", "*/5 * * * 1", "5 * * * *", ""]) expect(() => tickPeriodMs(cron)).toThrow("every N minutes");
  });

  /** A fetcher counting the rechecks, whose links hold while `hold` says so and fail after. */
  function counted(): { fetcher: Fetcher; calls: () => number; fail: () => void } {
    let calls = 0;
    let hold = true;
    const fetcher: Fetcher = (input) => {
      calls += 1;
      return hold ? Promise.resolve(Object.defineProperty(new Response("ok"), "url", { value: input })) : Promise.reject(new Error("offline"));
    };
    return { fetcher, calls: () => calls, fail: () => (hold = false) };
  }

  test("[R-ADVERT-014] given a thirty-minute tick, when the job runs a minute late and the next a minute early, then every campaign starting before each next run is rechecked by exactly one run, those starting just after a late firing among them", async () => {
    const THIRTY = tickPeriodMs("*/30 * * * *");
    const clock = { at: EPOCH };
    const deps = world(clock);
    const app = makeApp(deps);
    // A fixed window of five minutes from the run would never recheck the campaigns at five and at 29 minutes in.
    const justAfter = await live(app, { starts: EPOCH + 30 * time.SECOND_MS });
    const fiveIn = await live(app, { starts: EPOCH + 5 * time.MINUTE_MS });
    const lastMs = await live(app, { starts: EPOCH + THIRTY - 1 });
    const next = await live(app, { starts: EPOCH + THIRTY });
    const links = counted();

    clock.at = EPOCH + time.MINUTE_MS;
    expect(recheckWindow(clock.at, THIRTY)).toEqual({ from: EPOCH, until: EPOCH + THIRTY });
    expect(await advertLinksJob(deps, TICKS_CRON, links.fetcher, THIRTY)).toEqual([]);
    expect(links.calls()).toBe(3);

    // Every link fails from now on: a campaign the next run rechecked again would be pulled.
    links.fail();
    clock.at = EPOCH + THIRTY - time.MINUTE_MS;
    expect(recheckWindow(clock.at, THIRTY)).toEqual({ from: EPOCH + THIRTY, until: EPOCH + 2 * THIRTY });
    expect(await advertLinksJob(deps, TICKS_CRON, links.fetcher, THIRTY)).toEqual([next.campaign]);
    expect(links.calls()).toBe(4);
    for (const { campaign } of [justAfter, fiveIn, lastMs]) expect((await deps.stores.adverts.campaign(campaign))?.status).toBe("approved");
  });

  test("[R-ADVERT-014] given a five-minute tick, when runs drift by a minute either way, then the windows of successive firings meet end to start, so no campaign is rechecked twice or skipped", () => {
    const FIVE = tickPeriodMs(TICKS_CRON);
    for (const firing of [0, 1, 2, 288]) {
      const at = EPOCH + firing * FIVE;
      for (const drift of [-time.MINUTE_MS, -1, 0, 1, time.MINUTE_MS]) {
        expect({ firing, drift, window: recheckWindow(at + drift, FIVE) }).toEqual({ firing, drift, window: { from: at, until: at + FIVE } });
      }
      expect(recheckWindow(at + time.MINUTE_MS, FIVE).until).toBe(recheckWindow(at + FIVE - time.MINUTE_MS, FIVE).from);
    }
  });
});

describe("what the review sees", () => {
  test("[R-ADVERT-011] [R-ADVERT-013] given versions pending, approved and refused, when an admin asks the admin image route, then each comes back as stored; the public route still serves only the approved live one", async () => {
    const app = makeApp(world());
    const { campaign: id, creative: art } = await live(app);
    const second = jpegOf(BILLBOARD.width, BILLBOARD.height);
    await creative(app, id, second, "Now with suya.", "https://example.com/menu", art);
    await creative(app, id, webpOf(BILLBOARD.width, BILLBOARD.height), "Now with fish.", "https://example.com/menu", art);
    await call(app, "POST", `/api/admin/adverts/creatives/${art}/3/refuse`, { checks: [], note: "Reads as a bank alert." });
    const image = (version: number, account: string | null = ADMIN) => app.request(`/api/admin/adverts/creatives/${art}/${String(version)}/image`, account === null ? {} : { headers: { "x-test-account": account } });

    for (const [version, format, bytes] of [[1, "png", pngOf(BILLBOARD.width, BILLBOARD.height)], [2, "jpeg", second], [3, "webp", webpOf(BILLBOARD.width, BILLBOARD.height)]] as const) {
      const reply = await image(version);
      expect(reply.status).toBe(200);
      expect(reply.headers.get("content-type")).toBe(`image/${format}`);
      expect(reply.headers.get("cache-control")).toBe("private, no-store");
      expect(reply.headers.get("x-content-type-options")).toBe("nosniff");
      expect(new Uint8Array(await reply.arrayBuffer())).toEqual(bytes);
    }
    expect((await app.request(`/api/adverts/image/${art}/1`)).status).toBe(200);
    for (const version of [2, 3]) expect((await app.request(`/api/adverts/image/${art}/${String(version)}`)).status).toBe(404);
    for (const account of [null, "account.player"]) expect((await image(2, account)).status).toBe(404);
    expect((await image(4)).status).toBe(404);
    expect((await app.request(`/api/admin/adverts/creatives/${art}/0/image`, { headers: { "x-test-account": ADMIN } })).status).toBe(404);
    expect((await app.request(`/api/admin/adverts/creatives/${art}/x/image`, { headers: { "x-test-account": ADMIN } })).status).toBe(404);
  });

  test("[R-ADVERT-011] given the adverts switch off, when an admin asks for a pending version's image, then it is still served for review", async () => {
    const app = makeApp(world());
    const id = ((await campaign(app)).body.campaign as { id: string }).id;
    const art = ((await creative(app, id)).body.creative as { id: string }).id;
    expect((await call(app, "POST", "/api/admin/switches", { name: "adverts", on: false, reason: "Paused for the review." })).status).toBe(200);
    expect((await app.request(`/api/admin/adverts/creatives/${art}/1/image`, { headers: { "x-test-account": ADMIN } })).status).toBe(200);
  });

  test("[R-ADVERT-012] given campaigns in NG and GB, general and restricted, and creatives with and without a link, when the campaigns are listed, then each row and each version carries the checks its approval needs, and approving with exactly those passes", async () => {
    const app = makeApp(world());
    const ng = ((await campaign(app)).body.campaign as { id: string }).id;
    const gb = ((await campaign(app, { regions: ["GB"], category: "telco" })).body.campaign as { id: string }).id;
    const linked = ((await creative(app, ng)).body.creative as { id: string }).id;
    const bare = ((await creative(app, ng, undefined, "Jollof on the island.", null)).body.creative as { id: string }).id;
    type Row = { campaign: { id: string }; checks: string[]; creatives: { id: string; version: number; checks: string[] }[] };
    const rows = (await call(app, "GET", "/api/admin/adverts/campaigns")).body.campaigns as Row[];
    const row = (id: string) => rows.find((each) => each.campaign.id === id);

    expect(row(ng)?.checks).toEqual(NG_CHECKS);
    expect(row(gb)?.checks).toEqual(["registered-business", "category", "no-prize-or-promo"]);
    expect(Object.fromEntries(row(ng)?.creatives.map((each) => [each.id, each.checks]) ?? [])).toEqual({ [linked]: CREATIVE_CHECKS, [bare]: ["format", "not-game-like", "text"] });
    for (const { id, checks } of [row(ng), row(gb)].map((each) => ({ id: each?.campaign.id ?? "", checks: each?.checks ?? [] }))) {
      expect((await call(app, "POST", `/api/admin/adverts/campaigns/${id}/approve`, { checks: checks.slice(1) })).body).toMatchObject({ code: "unchecked", missing: [checks[0]] });
      expect((await call(app, "POST", `/api/admin/adverts/campaigns/${id}/approve`, { checks })).body).toMatchObject({ ok: true });
    }
    for (const each of row(ng)?.creatives ?? []) expect((await call(app, "POST", `/api/admin/adverts/creatives/${each.id}/${String(each.version)}/approve`, { checks: each.checks })).body).toMatchObject({ ok: true });
  });

  test("[R-ADVERT-020] given a campaign's counts over two days, when the campaigns are listed, then its row carries the daily counts per slot and region, and a campaign with none carries none", async () => {
    const deps = world();
    const app = makeApp(deps);
    const { campaign: id } = await live(app);
    const quiet = ((await campaign(app)).body.campaign as { id: string }).id;
    const day = int.divFloor(EPOCH, time.DAY_MS);
    await addAdvertCounters(deps, "NG", EPOCH, [{ name: ADVERT_COUNTERS.impression, key: "advert.road-billboard", count: 7 }, { name: ADVERT_COUNTERS.tap, key: "advert.road-billboard", count: 2 }]);
    await addAdvertCounters(deps, "NG", EPOCH + time.DAY_MS, [{ name: ADVERT_COUNTERS.impression, key: "advert.road-billboard", count: 1 }]);
    type Row = { campaign: { id: string }; counts: unknown[] };
    const rows = (await call(app, "GET", "/api/admin/adverts/campaigns")).body.campaigns as Row[];
    expect(rows.find((each) => each.campaign.id === id)?.counts).toEqual([
      { day, slot: "advert.road-billboard", campaign: id, region: "NG", impressions: 7, taps: 2 },
      { day: day + 1, slot: "advert.road-billboard", campaign: id, region: "NG", impressions: 1, taps: 0 },
    ]);
    expect(rows.find((each) => each.campaign.id === quiet)?.counts).toEqual([]);
  });
});

describe("categories, regions and places", () => {
  test("[R-ADVERT-008] given a campaign for a region not in the table, when it is entered, then it is refused", async () => {
    const app = makeApp(world());
    const reply = await campaign(app, { regions: ["NG", "XX"] });
    expect(reply.status).toBe(422);
    expect(reply.body.refusals).toEqual(["XX is not a region of the table (R-ADVERT-021)."]);
    expect((await campaign(app, { regions: ["unknown"] })).status).toBe(422);
    expect((await campaign(app, { regions: ["FR", "default"] })).status).toBe(200);
  });

  test("[R-ADVERT-016] given a restricted category, when its campaign is approved without its conditions recorded, then it is not; with them it is", async () => {
    const app = makeApp(world());
    const id = ((await campaign(app, { category: "telco" })).body.campaign as { id: string }).id;
    expect((await call(app, "POST", `/api/admin/adverts/campaigns/${id}/approve`, { checks: NG_CHECKS })).body).toMatchObject({ missing: ["no-prize-or-promo"] });
    expect((await call(app, "POST", `/api/admin/adverts/campaigns/${id}/approve`, { checks: [...NG_CHECKS, "no-prize-or-promo"] })).body).toMatchObject({ ok: true });
  });

  test("[R-ADVERT-017] given a live campaign naming a private place, when the tick is made, then its world carries the real name and sign; before the start it does not, and content never holds it", async () => {
    const clock = { at: EPOCH };
    const deps = world(clock);
    const app = makeApp(deps);
    const place = { place: "place.yaba-hub", name: "Realname Hub", sign: "REALNAME HUB" };
    const made = await campaign(app, { category: "named-place", place, starts: EPOCH + time.DAY_MS });
    const named = (made.body.campaign as { id: string }).id;
    await call(app, "POST", `/api/admin/adverts/campaigns/${named}/approve`, { checks: [...NG_CHECKS, "place-agreement"] });
    expect((await tickRow(deps, 0)).world.placeNames).toEqual({});
    const started = int.divCeil(time.DAY_MS, deps.config.clock.worldTickMs);
    expect((await tickRow(deps, started - 1)).world.placeNames).toEqual({});
    expect((await tickRow(deps, started)).world.placeNames).toEqual({ "place.yaba-hub": { name: "Realname Hub", sign: "REALNAME HUB" } });
    expect(JSON.stringify(content)).not.toContain("Realname Hub");
  });

  test("[R-ADVERT-018] given a place that stages an offer that can be a fraud, when a campaign would name it, then it is refused", async () => {
    const app = makeApp(world());
    const reply = await campaign(app, { category: "named-place", place: { place: "place.agent-office", name: "Real Agents", sign: "REAL AGENTS" } });
    expect(reply.body.refusals).toEqual(["place.agent-office stages offer.held-funds-agent, offer.gulf-agent, which can be a fraud, and a named place hosts no bad event (R-ADVERT-018)."]);
  });

  test("[R-ADVERT-019] given a bank, an embassy, a visa centre, a test centre or a government office, when a campaign would name it, then it is refused", async () => {
    const app = makeApp(world());
    const institutions = Object.values(content.place).filter((place) => place.nameKind === "institution");
    expect(institutions.map((place) => place.id)).toEqual(expect.arrayContaining(["place.visa-centre", "place.passport-office", "place.english-test-centre"]));
    for (const place of institutions) {
      const reply = await campaign(app, { category: "named-place", place: { place: place.id, name: "Real Name", sign: "REAL NAME" } });
      expect(reply.body.refusals).toContain(`${place.id} is an institution and never takes a real name (R-ADVERT-019).`);
    }
  });
});

describe("what is stored and shared", () => {
  test("[R-ADVERT-022] [R-ADVERT-020] given counter rows from one batch, when they arrive, then the advert rows add to the day's totals for the campaign that slot showed, keyed by nothing but day, slot, campaign and region", async () => {
    const clock = { at: EPOCH };
    const deps = world(clock);
    const app = makeApp(deps);
    const { campaign: id } = await live(app);
    const used = await addAdvertCounters(deps, "NG", clock.at, [
      { name: ADVERT_COUNTERS.impression, key: "advert.road-billboard", count: 3 },
      { name: ADVERT_COUNTERS.tap, key: "advert.road-billboard", count: 1 },
      { name: ADVERT_COUNTERS.impression, key: "advert.phone-tile", count: 9 },
      { name: "screen/opened", key: "advert.road-billboard", count: 4 },
      { name: ADVERT_COUNTERS.impression, key: "advert.road-billboard", count: 0 },
    ]);
    expect(used).toBe(2);
    await addAdvertCounters(deps, "NG", clock.at + 1, [{ name: ADVERT_COUNTERS.impression, key: "advert.road-billboard", count: 2 }]);
    const day = int.divFloor(EPOCH, time.DAY_MS);
    expect(await deps.stores.adverts.counts(id)).toEqual([{ day, slot: "advert.road-billboard", campaign: id, region: "NG", impressions: 5, taps: 1 }]);
  });

  test("[R-ADVERT-021] given a campaign's counts, when the advertiser's report is read, then it holds the daily counts and nothing about any player", async () => {
    const deps = world();
    const app = makeApp(deps);
    const { campaign: id } = await live(app);
    await addAdvertCounters(deps, "NG", EPOCH, [{ name: ADVERT_COUNTERS.impression, key: "advert.road-billboard", count: 7 }]);
    const report = await call(app, "GET", `/api/admin/adverts/campaigns/${id}/counts`);
    expect(report.body).toEqual({ ok: true, campaign: id, counts: [{ day: int.divFloor(EPOCH, time.DAY_MS), slot: "advert.road-billboard" satisfies Id<"advert">, campaign: id, region: "NG", impressions: 7, taps: 0 }] });
    expect(JSON.stringify(report.body)).not.toMatch(/account|session|character/);
  });
});

describe("what one account can add to a campaign's day", () => {
  const player = (account: string) => ({ id: account, country: "NG", age: { passed: true, at: 0, method: "declared" as const }, createdAt: EPOCH, character: null, notifyBankFull: false, sendUsageCounts: true, state: "secured" as const, username: account.replaceAll(".", "_"), usernameChangedAt: null, lastPlayedAt: EPOCH });

  async function send(app: App, account: string, rows: { name: string; key: string; count: number }[]): Promise<number> {
    const reply = await app.request("/api/counters", { method: "POST", headers: { "content-type": "text/plain", "x-test-account": account }, body: JSON.stringify({ rows }) });
    return reply.status;
  }

  function totals(deps: ServerDeps, id: string) {
    return deps.stores.adverts.counts(id).then((rows) => rows.map(({ day, slot, impressions, taps }) => ({ day, slot, impressions, taps })));
  }

  test("[R-ADVERT-020] given one account, when its impressions and taps on a slot reach the day's allowance exactly, then all count; past it the batch is accepted and the rest is dropped", async () => {
    const clock = { at: EPOCH };
    const deps = world(clock);
    const app = makeApp(deps);
    const { campaign: id } = await live(app);
    await deps.stores.account.create(player("account.player"));
    const { impressions, taps } = deps.config.advert.countsPerAccountDay;
    expect({ impressions, taps }).toEqual({ impressions: 200, taps: 20 });
    const day = int.divFloor(EPOCH, time.DAY_MS);

    expect(await send(app, "account.player", [{ name: ADVERT_COUNTERS.impression, key: "advert.road-billboard", count: impressions - 1 }, { name: ADVERT_COUNTERS.tap, key: "advert.road-billboard", count: taps - 1 }])).toBe(204);
    expect(await send(app, "account.player", [{ name: ADVERT_COUNTERS.impression, key: "advert.road-billboard", count: 1 }, { name: ADVERT_COUNTERS.tap, key: "advert.road-billboard", count: 1 }])).toBe(204);
    expect(await totals(deps, id)).toEqual([{ day, slot: "advert.road-billboard", impressions, taps }]);

    expect(await send(app, "account.player", [{ name: ADVERT_COUNTERS.impression, key: "advert.road-billboard", count: 1 }, { name: ADVERT_COUNTERS.tap, key: "advert.road-billboard", count: 1 }])).toBe(204);
    expect(await totals(deps, id)).toEqual([{ day, slot: "advert.road-billboard", impressions, taps }]);
  });

  test("[R-ADVERT-020] given a row that crosses the allowance, when it arrives, then only the part within it counts, while another account, another slot and the next day each start afresh", async () => {
    const clock = { at: EPOCH };
    const deps = world(clock);
    const app = makeApp(deps);
    const { campaign: id } = await live(app, { slots: ["advert.road-billboard", "advert.park-billboard"] });
    await deps.stores.account.create(player("account.player"));
    await deps.stores.account.create(player("account.other"));
    const { impressions, taps } = deps.config.advert.countsPerAccountDay;
    const day = int.divFloor(EPOCH, time.DAY_MS);

    expect(await send(app, "account.player", [{ name: ADVERT_COUNTERS.impression, key: "advert.road-billboard", count: impressions - 3 }])).toBe(204);
    expect(await send(app, "account.player", [{ name: ADVERT_COUNTERS.impression, key: "advert.road-billboard", count: 10 }, { name: ADVERT_COUNTERS.tap, key: "advert.road-billboard", count: taps + 5 }])).toBe(204);
    expect(await send(app, "account.player", [{ name: ADVERT_COUNTERS.impression, key: "advert.park-billboard", count: 4 }])).toBe(204);
    expect(await send(app, "account.other", [{ name: ADVERT_COUNTERS.impression, key: "advert.road-billboard", count: 2 }])).toBe(204);
    expect(await totals(deps, id)).toEqual([
      { day, slot: "advert.park-billboard", impressions: 4, taps: 0 },
      { day, slot: "advert.road-billboard", impressions: impressions + 2, taps },
    ]);

    clock.at = EPOCH + time.DAY_MS;
    expect(await send(app, "account.player", [{ name: ADVERT_COUNTERS.impression, key: "advert.road-billboard", count: 1 }])).toBe(204);
    expect((await totals(deps, id)).filter((row) => row.day === day + 1)).toEqual([{ day: day + 1, slot: "advert.road-billboard", impressions: 1, taps: 0 }]);
  });
});

describe("the wiring to the admin log and the counters", () => {
  test("[R-MODERATION-015] [R-ADVERT-012] [R-ADVERT-014] given a campaign approved, a creative approved, another refused and the campaign pulled, when the admin log is read, then each decision is there once with the admin, the time and the item", async () => {
    const clock = { at: EPOCH };
    const deps = world(clock);
    const app = makeApp(deps);
    const { campaign: id, creative: art } = await live(app);
    const other = (await creative(app, id, undefined, "Suya by the bridge.")).body.creative as { id: string };
    expect((await call(app, "POST", `/api/admin/adverts/creatives/${other.id}/1/refuse`, { note: "too loud" })).status).toBe(200);
    expect((await call(app, "POST", `/api/admin/adverts/campaigns/${id}/pull`, {})).status).toBe(200);
    expect((await call(app, "POST", `/api/admin/adverts/campaigns/missing/pull`, {})).status).toBe(404);

    const onCampaign = await deps.stores.moderationLog.list({ item: id });
    expect(onCampaign.map((entry) => entry.action)).toEqual(["approve-advert", "pull-advert"]);
    expect(onCampaign[0]).toMatchObject({ admin: ADMIN, at: EPOCH, reason: "advert", params: { campaign: id } });
    expect((await deps.stores.moderationLog.list({ item: art })).map((entry) => entry.action)).toEqual(["approve-advert"]);
    expect(await deps.stores.moderationLog.list({ item: other.id })).toMatchObject([{ action: "refuse-advert", note: "too loud", params: { creative: other.id, version: 1, campaign: id } }]);
    expect(await deps.stores.moderationLog.list({ item: "missing" })).toEqual([]);
  });

  test("[R-ADVERT-020] [R-ANALYTICS-002] given a live campaign, when a player's batch holds advert rows, then POST /api/counters adds them to the campaign's day and to the interface counters, and an account with usage counts off adds neither", async () => {
    const deps = world();
    const app = makeApp(deps);
    const { campaign: id } = await live(app);
    const row = (account: string, sendUsageCounts: boolean) => ({ id: account, country: "NG", age: { passed: true, at: 0, method: "declared" as const }, createdAt: EPOCH, character: null, notifyBankFull: false, sendUsageCounts, state: "secured" as const, username: account.replaceAll(".", "_"), usernameChangedAt: null, lastPlayedAt: EPOCH });
    await deps.stores.account.create(row("account.player", true));
    await deps.stores.account.create(row("account.quiet", false));
    const batch = JSON.stringify({ rows: [{ name: ADVERT_COUNTERS.impression, key: "advert.road-billboard", count: 2 }] });
    for (const account of ["account.player", "account.quiet"]) {
      const sent = await app.request("/api/counters", { method: "POST", headers: { "content-type": "text/plain", "x-test-account": account }, body: batch });
      expect(sent.status).toBe(204);
    }
    expect(await deps.stores.adverts.counts(id)).toEqual([{ day: int.divFloor(EPOCH, time.DAY_MS), slot: "advert.road-billboard", campaign: id, region: "NG", impressions: 2, taps: 0 }]);
    expect((await deps.stores.counters.days("2000-01-01", "2100-01-01")).filter((each) => each.name === ADVERT_COUNTERS.impression)).toMatchObject([{ key: "advert.road-billboard", count: 2 }]);
  });
});

describe("the slots and images through the cache", () => {
  test("[R-ADVERT-008] [R-ADVERT-014] [R-SERVER-039] given caches.default and a live campaign, when the slots are asked for twice within five minutes from one region, then the campaigns are read once and both replies are the same, the browser told to keep them to the hour's end; another region, five minutes on and the next hour are read again", async () => {
    const clock = { at: EPOCH };
    const deps = world(clock);
    const { campaign: id } = await live(makeApp(deps));
    const edge = fakeEdge();
    const route = advertRoutes(deps, advertsOnByDefault, edge);
    const reads = vi.spyOn(deps.stores.adverts, "campaigns");
    const ask = async (region: string) => {
      const reply = await route.request(`/api/adverts?region=${region}`);
      return { text: await reply.text(), cache: reply.headers.get("cache-control") };
    };
    const first = await ask("NG");
    clock.at = EPOCH + time.MINUTE_MS;
    const second = await ask("ng");
    expect(reads).toHaveBeenCalledTimes(1);
    expect(second.text).toBe(first.text);
    expect((JSON.parse(second.text) as AdvertsReply).slots["advert.road-billboard"]?.campaign).toBe(id);
    const until = (int.divFloor(EPOCH, time.HOUR_MS) + 1) * time.HOUR_MS;
    expect(second.cache).toBe(`public, max-age=${String(int.divCeil(until - clock.at, time.SECOND_MS))}`);
    expect(edge.asked[0]).toBe(edgeKey("http://localhost", ["adverts", "NG", int.divFloor(EPOCH, time.HOUR_MS)]));
    expect(edge.stored[0]?.headers["cache-control"]).toBe(`public, max-age=${String(ADVERT_KEPT_MS / time.SECOND_MS)}`);
    await ask("GB");
    expect(reads).toHaveBeenCalledTimes(2);
    clock.at = EPOCH + ADVERT_KEPT_MS - 1;
    await ask("NG");
    expect(reads).toHaveBeenCalledTimes(2);
    clock.at = EPOCH + ADVERT_KEPT_MS;
    const later = await ask("NG");
    expect(reads).toHaveBeenCalledTimes(3);
    expect(later.cache).toBe(`public, max-age=${String(int.divCeil(until - clock.at, time.SECOND_MS))}`);
    clock.at = until;
    await ask("NG");
    expect(reads).toHaveBeenCalledTimes(4);
  });

  test("[R-SERVER-031] [R-SERVER-039] given slots kept in the cache, when the adverts switch goes off, then nothing is served and the cache is not asked; back on, the kept reply is served again", async () => {
    const deps = world();
    await live(makeApp(deps));
    const edge = fakeEdge();
    let on = true;
    const route = advertRoutes(deps, () => Promise.resolve(on), edge);
    const kept = await (await route.request("/api/adverts?region=NG")).text();
    on = false;
    const off = await (await route.request("/api/adverts?region=NG")).json<AdvertsReply>();
    expect(off.slots).toEqual({});
    expect(edge.asked).toHaveLength(1);
    on = true;
    expect(await (await route.request("/api/adverts?region=NG")).text()).toBe(kept);
  });

  test("[R-ADVERT-013] [R-ADVERT-014] [R-SERVER-039] given an approved image, when it is fetched twice within five minutes, then its bytes are read once and come back the same as its format, and five minutes on they are read again; a creative that is not live is 404 each time and never stored", async () => {
    const clock = { at: EPOCH };
    const deps = world(clock);
    const app = makeApp(deps);
    const { creative: art } = await live(app);
    const edge = fakeEdge();
    const route = advertRoutes(deps, advertsOnByDefault, edge);
    const reads = vi.spyOn(deps.stores.adverts, "image");
    const first = await route.request(`/api/adverts/image/${art}/1`);
    const second = await route.request(`/api/adverts/image/${art}/1`);
    expect(reads).toHaveBeenCalledTimes(1);
    expect(second.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await second.arrayBuffer())).toEqual(new Uint8Array(await first.arrayBuffer()));
    expect(new Uint8Array(await (await route.request(`/api/adverts/image/${art}/1`)).arrayBuffer())).toEqual(pngOf(1024, 512));
    expect((await route.request(`/api/adverts/image/${art}/2`)).status).toBe(404);
    expect((await route.request(`/api/adverts/image/${art}/2`)).status).toBe(404);
    expect(edge.stored.map((each) => each.key)).toEqual([edgeKey("http://localhost", ["advert-image", art, 1, int.divFloor(EPOCH, time.HOUR_MS)])]);
    clock.at = EPOCH + ADVERT_KEPT_MS;
    const fresh = await route.request(`/api/adverts/image/${art}/1`);
    expect(reads).toHaveBeenCalledTimes(2);
    expect(fresh.headers.get("cache-control")).toBe(`public, max-age=${String(int.divCeil((int.divFloor(EPOCH, time.HOUR_MS) + 1) * time.HOUR_MS - clock.at, time.SECOND_MS))}`);
  });
});
