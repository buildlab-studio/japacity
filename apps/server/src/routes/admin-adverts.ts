// The admin view's advert routes (moderation.md R-MODERATION-012, 014;
// adverts.md R-ADVERT-010 to 017, 020, 021). A submission reaches the game only
// here, entered by an admin from the form or email it arrived by, and waits in
// review; nothing in it is served until a named person approves it. Only an
// account in `config.admin.accounts` may reach these routes; to anyone else
// they do not exist.
import type { Id } from "@japacity/sim";
import type { Campaign, NamedPlace } from "@japacity/store";
import type { Context } from "hono";
import { Hono } from "hono";

import { campaignRefusals, creativeFile, statusAt } from "../adverts/campaign";
import type { CampaignDraft } from "../adverts/campaign";
import type { Fetcher } from "../adverts/links";
import { failingLinks } from "../adverts/links";
import type { Decided, Decision } from "../adverts/review";
import { decideCampaign, decideCreative, pullCampaign } from "../adverts/review";
import type { ServerDeps } from "../deps";

interface AdminEnv {
  Variables: { admin: string };
}

type Body = Record<string, unknown>;

const VERSION = /^[1-9]\d{0,8}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function texts(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((each) => typeof each === "string") ? value : null;
}

async function bodyOf(c: Context): Promise<Body | null> {
  try {
    const body: unknown = await c.req.json();
    return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Body) : null;
  } catch {
    return null;
  }
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromBase64(value: string): Uint8Array | null {
  try {
    return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function namedPlace(value: unknown): NamedPlace | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object") return undefined;
  const { place, name, sign } = value as Body;
  return isText(place) && isText(name) && isText(sign) ? { place: place as Id<"place">, name, sign } : undefined;
}

function decisionOf(body: Body | null, reviewer: string): Decision | null {
  if (body === null) return null;
  const checks = body.checks === undefined ? [] : texts(body.checks);
  const note = body.note === undefined ? "" : body.note;
  return checks === null || typeof note !== "string" ? null : { reviewer, checks, note };
}

function decided<T>(c: Context, result: Decided<T>, key: string) {
  if (result.ok) return c.json({ ok: true, [key]: result.value });
  return c.json(result, result.code === "missing" ? 404 : 409);
}

const BAD_BODY = { ok: false, code: "bad-body", detail: "The request body is not the shape this route takes." } as const;

export function adminAdvertRoutes(deps: ServerDeps, fetcher: Fetcher = (input, init) => fetch(input, init)): Hono<AdminEnv> {
  const admin = new Hono<AdminEnv>();
  const newId = (prefix: string) => `${prefix}-${hex(deps.randomBytes(8))}`;

  admin.use("*", async (c, next) => {
    const session = await deps.session(c.req.raw);
    if (session === null || !deps.config.admin.accounts.includes(session.account)) return c.notFound();
    c.set("admin", session.account);
    await next();
    return undefined;
  });

  /** R-ADVERT-012, R-ADVERT-020: the business, its registration and one contact. */
  admin.post("/advertisers", async (c) => {
    const body = await bodyOf(c);
    const registration = body?.registration as Body | undefined;
    if (body === null || !isText(body.businessName) || !isText(registration?.country) || !isText(registration.number) || !isText(body.contactName) || typeof body.contactEmail !== "string" || !EMAIL.test(body.contactEmail)) return c.json(BAD_BODY, 400);
    const added = await deps.stores.adverts.addAdvertiser({
      id: newId("advertiser"),
      businessName: body.businessName,
      registration: { country: registration.country, number: registration.number },
      contactName: body.contactName,
      contactEmail: body.contactEmail,
    });
    return added.ok ? c.json({ ok: true, advertiser: added.value }) : c.json(added, 409);
  });

  /** R-ADVERT-008, R-ADVERT-015 to 017: a campaign enters review as `pending`, or is refused with every reason. */
  admin.post("/campaigns", async (c) => {
    const body = await bodyOf(c);
    const slots = texts(body?.slots);
    const regions = texts(body?.regions);
    const place = namedPlace(body?.place);
    if (body === null || !isText(body.advertiser) || slots === null || regions === null || typeof body.starts !== "number" || typeof body.ends !== "number" || !isText(body.category) || place === undefined) return c.json(BAD_BODY, 400);
    const draft: CampaignDraft = { advertiser: body.advertiser, slots, regions, starts: body.starts, ends: body.ends, category: body.category, place };
    const refusals = campaignRefusals(deps.contents.current, deps.config.regions, draft);
    if (refusals.length > 0) return c.json({ ok: false, code: "refused", detail: refusals.join(" "), refusals }, 422);
    const campaign: Campaign = { id: newId("campaign"), ...draft, slots: slots as Id<"advert">[], status: "pending" };
    const added = await deps.stores.adverts.addCampaign(campaign);
    return added.ok ? c.json({ ok: true, campaign: added.value }) : c.json(added, added.code === "missing" ? 404 : 409);
  });

  /** R-ADVERT-004, R-ADVERT-005, R-ADVERT-011: a new creative, or a new version of one, waits for review. */
  admin.post("/campaigns/:campaign/creatives", async (c) => {
    const body = await bodyOf(c);
    const image = typeof body?.image === "string" ? fromBase64(body.image) : null;
    const link = body?.link ?? null;
    if (body === null || image === null || typeof body.text !== "string" || (link !== null && typeof link !== "string") || (body.creative !== undefined && !isText(body.creative))) return c.json(BAD_BODY, 400);
    const campaign = await deps.stores.adverts.campaign(c.req.param("campaign"));
    if (campaign === null) return c.json({ ok: false, code: "missing", detail: `No campaign ${c.req.param("campaign")}.` }, 404);
    if (campaign.status === "refused") return c.json({ ok: false, code: "refused", detail: "The campaign was refused.", refusals: [] }, 422);
    const measured = creativeFile(deps.contents.current, campaign, { image, text: body.text, link });
    if (!measured.ok) return c.json({ ok: false, code: "refused", detail: measured.refusals.join(" "), refusals: measured.refusals }, 422);
    const id = typeof body.creative === "string" ? body.creative : newId("creative");
    const versions = (await deps.stores.adverts.creatives(campaign.id)).filter((each) => each.id === id).map((each) => each.version);
    if (typeof body.creative === "string" && versions.length === 0) return c.json({ ok: false, code: "missing", detail: `No creative ${id} in ${campaign.id}.` }, 404);
    const added = await deps.stores.adverts.addCreative({ id, campaign: campaign.id, file: measured.file, text: body.text, link, version: Math.max(0, ...versions) + 1, status: "pending" }, image);
    return added.ok ? c.json({ ok: true, creative: added.value }) : c.json(added, 409);
  });

  admin.post("/campaigns/:campaign/approve", async (c) => {
    const decision = decisionOf(await bodyOf(c), c.get("admin"));
    if (decision === null) return c.json(BAD_BODY, 400);
    return decided(c, await decideCampaign(deps, c.req.param("campaign"), "approved", decision), "campaign");
  });

  admin.post("/campaigns/:campaign/refuse", async (c) => {
    const decision = decisionOf(await bodyOf(c), c.get("admin"));
    if (decision === null) return c.json(BAD_BODY, 400);
    return decided(c, await decideCampaign(deps, c.req.param("campaign"), "refused", decision), "campaign");
  });

  for (const outcome of ["approved", "refused"] as const) {
    admin.post(`/creatives/:creative/:version/${outcome === "approved" ? "approve" : "refuse"}`, async (c) => {
      const decision = decisionOf(await bodyOf(c), c.get("admin"));
      const version = c.req.param("version");
      if (decision === null || !VERSION.test(version)) return c.json(BAD_BODY, 400);
      return decided(c, await decideCreative(deps, c.req.param("creative"), Number(version), outcome, decision), "creative");
    });
  }

  // R-MODERATION-015's log belongs to the moderation work; every decision here is written to it once it lands.
  /** R-ADVERT-014: out of rotation at once, back to review. */
  admin.post("/campaigns/:campaign/pull", async (c) => {
    const pulled = await pullCampaign(deps, c.req.param("campaign"));
    return pulled.ok ? c.json({ ok: true, campaign: pulled.value }) : c.json(pulled, 404);
  });

  /** R-ADVERT-014: a link that no longer holds pulls its campaign. */
  admin.post("/campaigns/:campaign/recheck", async (c) => {
    const id = c.req.param("campaign");
    if ((await deps.stores.adverts.campaign(id)) === null) return c.json({ ok: false, code: "missing", detail: `No campaign ${id}.` }, 404);
    const failing = await failingLinks(deps, fetcher, id);
    const pulled = failing.length > 0 && (await pullCampaign(deps, id)).ok;
    return c.json({ ok: true, failing, pulled });
  });

  /** The review queue's view: every campaign with its status now, its creatives and every review. */
  admin.get("/campaigns", async (c) => {
    const now = deps.now();
    const rows = [];
    for (const campaign of await deps.stores.adverts.campaigns()) {
      const creatives = await deps.stores.adverts.creatives(campaign.id);
      const reviews = [...(await deps.stores.adverts.reviews(campaign.id))];
      for (const id of new Set(creatives.map((each) => each.id))) reviews.push(...(await deps.stores.adverts.reviews(id)));
      rows.push({ campaign: { ...campaign, status: statusAt(campaign, now) }, advertiser: await deps.stores.adverts.advertiser(campaign.advertiser), creatives, reviews });
    }
    return c.json({ ok: true, campaigns: rows });
  });

  /** R-ADVERT-021: what an advertiser receives, the daily counts and nothing else. */
  admin.get("/campaigns/:campaign/counts", async (c) => {
    const id = c.req.param("campaign");
    if ((await deps.stores.adverts.campaign(id)) === null) return c.json({ ok: false, code: "missing", detail: `No campaign ${id}.` }, 404);
    return c.json({ ok: true, campaign: id, counts: await deps.stores.adverts.counts(id) });
  });

  return admin;
}
