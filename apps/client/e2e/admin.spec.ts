import { join } from "node:path";

import { expect, test, type Page, type Route } from "@playwright/test";

// The admin routes are answered in the browser from the page's own fixtures: the dev server has no server behind it.
import { ADMIN_GETS, ROLLBACK, SWITCHES } from "../src/features/admin/admin.fixtures";

/** Where the pictures for the build notes go, when asked for. */
const PREVIEW = process.env.PREVIEW_DIR;

const TABS = ["Money", "Rejections", "Rollback", "Moderation", "Analytics", "Adverts", "Switches"] as const;

const BROKEN: readonly [string, RegExp][] = [
  ["a raw object", /\[object Object\]/],
  ["a missing value", /\bundefined\b|\bNaN\b/],
  ["a words key with no words", /\badmin\.[a-z-]+\.[a-z-]+/],
];

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

async function expectNothingBroken(page: Page, when: string): Promise<void> {
  const shown = await page.evaluate(() => document.body.textContent);
  for (const [what, pattern] of BROKEN) expect(shown.match(pattern)?.[0], `${what} on screen ${when}`).toBeUndefined();
}

async function shoot(page: Page, name: string, project: string): Promise<void> {
  if (PREVIEW === undefined || PREVIEW === "") return;
  const size = project.startsWith("Pixel") ? "phone" : "desktop";
  await page.screenshot({ path: join(PREVIEW, `admin-${name}-${size}.png`), fullPage: true });
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
    Adverts: () => expect(page.getByRole("heading", { name: "Campaign campaign-a1" })).toBeVisible(),
    Switches: () => expect(page.getByRole("table", { name: "Changes, oldest first" })).toBeVisible(),
  };
  for (const tab of TABS) {
    await page.getByRole("tab", { name: tab }).click();
    await loaded[tab]();
    await expectNothingBroken(page, `on the ${tab} tab`);
    await shoot(page, tab.toLowerCase(), info.project.name);
  }
  for (const { path } of seen) expect(path === "/api/account" || path.startsWith("/api/admin/"), path).toBe(true);
});

test("an account off the admin list that visits /admin sees the ordinary app", async ({ page }) => {
  const seen = await fakeServer(page, false);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Who are you?" })).toBeVisible();
  await expect.poll(() => seen.some((each) => each.path === "/api/account")).toBe(true);
  await expect(page.getByRole("tablist", { name: "Admin areas" })).toHaveCount(0);
  expect(seen.filter((each) => each.path.startsWith("/api/admin/"))).toEqual([]);
});
