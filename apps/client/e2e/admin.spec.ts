import { generateKeyPairSync } from "node:crypto";

import { expect, test, type Page, type Route } from "@playwright/test";

// The admin routes are answered in the browser from the page's own fixtures: the dev server has no server behind it.
import { ADMIN_GETS, ROLLBACK, SWITCHES } from "../src/features/admin/admin.testing";
import { json, ONLINE, quietSocket } from "./support/api";
import { type Broken, expectNothingBroken, NEVER_SHOWN } from "./support/check";
import { shootAtSize } from "./support/preview";

const TABS = ["Money", "Rejections", "Rollback", "Moderation", "Analytics", "Numbers", "Adverts", "Switches"] as const;

const BROKEN: readonly Broken[] = [...NEVER_SHOWN, ["a words key with no words", /\badmin\.[a-z-]+\.[a-z-]+/]];

/** A stand-in for a creative's image, which the admin image route serves for any version. */
const IMAGE = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320" fill="#1f6f5c"/><text x="160" y="170" font-size="28" fill="#fff" text-anchor="middle" font-family="sans-serif">Tea by the water</text></svg>';

interface Seen {
  method: string;
  path: string;
}

/** Answers every /api/ request the way the server's admin routes would, and records it. */
async function fakeServer(page: Page, admin: boolean): Promise<Seen[]> {
  const seen: Seen[] = [];
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route: Route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      seen.push({ method: request.method(), path });
      if (/^\/api\/admin\/adverts\/creatives\/[^/]+\/\d+\/image$/.test(path)) return route.fulfill({ contentType: "image/svg+xml", body: IMAGE });
      const account = ADMIN_GETS["/api/account"] as { account: object };
      const answer =
        path === "/api/account"
          ? { ok: true, account: { ...account.account, admin } }
          : path.startsWith("/api/admin/rollback/")
            ? ROLLBACK
            : request.method() === "POST" && (path === "/api/admin/switches" || path === "/api/admin/dials")
              ? SWITCHES
              : ADMIN_GETS[path];
      await (answer === undefined ? route.fulfill({ status: 404, body: "404 Not Found" }) : route.fulfill({ json: answer }));
    },
  );
  return seen;
}

test("an admin at /admin sees every area of the page, each from the admin routes only", async ({ page }, info) => {
  const seen = await fakeServer(page, true);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin", level: 1 })).toBeVisible();
  await expect(page.getByRole("tab")).toHaveText([...TABS]);

  const loaded: Record<(typeof TABS)[number], () => Promise<void>> = {
    Money: () => expect(page.getByRole("table", { name: "Created" })).toBeVisible(),
    Rejections: () => expect(page.getByRole("table", { name: "Rejected commands by code" })).toBeVisible(),
    Rollback: async () => {
      await page.getByLabel("Character id").fill("character.c-19bd");
      await page.getByRole("button", { name: "Run the check" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Send" }).click();
      await expect(page.getByText("First difference at version 88: stored a91f03c2, replayed 5be0d417.")).toBeVisible();
    },
    Moderation: () => expect(page.getByRole("heading", { name: "Report report.1: scam" })).toBeVisible(),
    Analytics: () => expect(page.getByRole("table", { name: "By sign-up week" })).toBeVisible(),
    Numbers: () => expect(page.getByRole("table", { name: "Online now (a command in the last five minutes)" })).toBeVisible(),
    Adverts: () => expect(page.getByRole("heading", { name: "Campaign campaign-a1" })).toBeVisible(),
    Switches: () => expect(page.getByRole("table", { name: "Changes, oldest first" })).toBeVisible(),
  };
  for (const tab of TABS) {
    await page.getByRole("tab", { name: tab }).click();
    await loaded[tab]();
    await expectNothingBroken(page, `on the ${tab} tab`, BROKEN);
    await shootAtSize(page, `admin-${tab.toLowerCase()}`, info.project.name, true);
  }
  for (const { path } of seen) expect(path === "/api/account" || path.startsWith("/api/admin/"), path).toBe(true);
});

test("an account off the admin list that visits /admin sees the ordinary app", async ({ page }) => {
  const seen = await fakeServer(page, false);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Who are you?" })).toBeVisible();
  await expect.poll(() => seen.some((each) => each.path === "/api/account")).toBe(true);
  await expect(page.getByRole("tablist", { name: "Admin areas" })).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).pathname).toBe("/");
  expect(seen.filter((each) => each.path.startsWith("/api/admin/"))).toEqual([]);
});

/** An account's row as the server answers it online; `listed` adds what the server tells an account on the admin list. */
function row(over: Record<string, unknown>): object {
  return { id: "account.ada", country: "NG", age: { passed: true, method: "declared" }, createdAt: 1, character: null, sendUsageCounts: true, admin: false, state: "secured", username: "ada_lagos", renameFrom: 0, ways: { google: null, email: "ada@example.com", passkeys: 1 }, ...over };
}

const SIGNED_OUT_ROW = { status: 401, body: { ok: false, code: "signed-out", detail: "Sign in first." } };

/** Online, the server answered in the page: the account's row as given, every other /api route as for no session. The requests the page made, by path. */
async function onlineServer(page: Page, account: { status: number; body: unknown }): Promise<{ api: string[]; modules: string[] }> {
  const seen = { api: [] as string[], modules: [] as string[] };
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/")) seen.api.push(`${request.method()} ${path}`);
    else if (path.includes("/features/admin/")) seen.modules.push(path);
  });
  await quietSocket(page);
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/account") return route.fulfill(json(account.body, account.status));
      return route.fulfill(json(SIGNED_OUT_ROW.body, 401));
    },
  );
  return seen;
}

/** What a visit to `path` online leaves: the address, the /api requests as a set, the admin modules fetched. */
async function visit(page: Page, path: string, account: { status: number; body: unknown }): Promise<{ at: string; api: string[]; modules: string[] }> {
  const seen = await onlineServer(page, account);
  await page.goto(`${ONLINE}${path}`);
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).toBe("/");
  await page.waitForLoadState("networkidle");
  return { at: new URL(page.url()).pathname, api: [...new Set(seen.api)].sort(), modules: seen.modules.filter((module) => !module.endsWith("/adminPath.ts")) };
}

test("[moderation:admin-view-for-admin-list] [server:unknown-address-becomes-root] online: a signed-out browser, a guest and a kept account off the admin list at /admin see what an unknown address shows, with the same requests, / in the address bar and no admin code fetched", async ({ browser }) => {
  test.setTimeout(180_000);
  const accounts = {
    "signed out": SIGNED_OUT_ROW,
    guest: { status: 200, body: { ok: true, account: row({ state: "guest", ways: { google: null, email: null, passkeys: 0 } }) } },
    "kept, off the list": { status: 200, body: { ok: true, account: row({}) } },
  };
  for (const [who, account] of Object.entries(accounts)) {
    const one = await browser.newContext();
    const unknown = await visit(await one.newPage(), "/somewhere-else", account);
    await one.close();
    const other = await browser.newContext();
    const admin = await visit(await other.newPage(), "/admin", account);
    await other.close();
    expect({ who, ...admin }).toEqual({ who, ...unknown });
    expect({ who, modules: admin.modules, adminApi: admin.api.filter((request) => request.includes("/api/admin")) }).toEqual({ who, modules: [], adminApi: [] });
  }
});

/** A passkey in the browser's own virtual authenticator, as a phone would hold it, for the address the online server runs at. */
async function virtualPasskey(page: Page): Promise<string> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  const credentialId = Buffer.from("owner-passkey").toString("base64");
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  await cdp.send("WebAuthn.addCredential", {
    authenticatorId,
    credential: { credentialId, isResidentCredential: true, rpId: "localhost", privateKey: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"), userHandle: Buffer.from("owner").toString("base64"), signCount: 0 },
  });
  return Buffer.from("owner-passkey").toString("base64url");
}

test("[moderation:admin-view-for-admin-list] online: a listed admin whose session has not shown a passkey is asked for it at /admin over the game, shows it from this browser, and the admin page opens at /admin", async ({ page }, info) => {
  test.setTimeout(120_000);
  const credential = await virtualPasskey(page);
  let held = false;
  const asked: string[] = [];
  await quietSocket(page);
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path === "/api/account") return route.fulfill(json({ ok: true, account: row({ id: "account.owner", admin: held, adminNeedsPasskey: !held }) }));
      if (path === "/api/auth/passkey/generate-authenticate-options") {
        asked.push(path);
        return route.fulfill(json({ challenge: Buffer.from("a challenge of the server's").toString("base64url"), rpId: "localhost", allowCredentials: [{ id: credential, type: "public-key", transports: ["internal"] }], userVerification: "preferred", timeout: 60_000 }));
      }
      if (path === "/api/auth/passkey/verify-authentication" && request.method() === "POST") {
        const body = request.postDataJSON() as { response: { id: string; response: { authenticatorData: string } } };
        asked.push(`${path} ${body.response.id}`);
        held = true;
        return route.fulfill(json({ session: { token: "stepped-up" }, user: { id: "account.owner" } }));
      }
      const answer = path.startsWith("/api/admin/") ? ADMIN_GETS[path] : undefined;
      return route.fulfill(answer === undefined ? json({ ok: false, code: "signed-out", detail: "Sign in first." }, 401) : json(answer));
    },
  );
  await page.goto(`${ONLINE}/admin`);
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("The admin view needs your passkey.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("tablist", { name: "Admin areas" })).toHaveCount(0);
  await shootAtSize(page, "admin-passkey", info.project.name);
  await sheet.getByRole("button", { name: "Use my passkey" }).click();
  await expect(page.getByRole("heading", { name: "Admin", level: 1 })).toBeVisible({ timeout: 30_000 });
  expect(new URL(page.url()).pathname).toBe("/admin");
  expect(asked).toEqual(["/api/auth/passkey/generate-authenticate-options", `/api/auth/passkey/verify-authentication ${credential}`]);
});
