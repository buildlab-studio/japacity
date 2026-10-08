import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

// The guest start and keeping a guest life (docs/rules/account.md R-ACCOUNT-021
// to 027), played against a faked server as online.spec.ts does: every /api
// route is answered here, in the shapes apps/client/src/shared/net/contract.ts
// copies from the server.
import { content } from "../../../packages/content/src/index";
import { start } from "../../../packages/sim/src/testing/play";

const ONLINE = `http://localhost:${process.env.E2E_ONLINE_PORT ?? "5180"}`;
test.use({ baseURL: ONLINE });

const PREVIEW = process.env.PREVIEW_DIR;

/** R-ACCOUNT pictures are phone pictures, at the size the build notes keep. */
async function shoot(page: Page, name: string, project: string): Promise<void> {
  if (PREVIEW === undefined || PREVIEW === "" || !project.startsWith("Pixel")) return;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(PREVIEW, `${name}-phone.png`), fullPage: false });
}

type Answer = { status?: number; body: unknown };

const SIGNED_OUT: Answer = { status: 401, body: { ok: false, code: "signed-out", detail: "Sign in to play." } };
const NO_CHARACTER: Answer = { status: 404, body: { ok: false, code: "no-character", detail: "No character yet." } };
const CLOCK = { tick: 3, nextTickAt: Date.now() + 3_600_000, nextTurnAt: null };
const GUEST = { id: "account-guest", country: "NG", age: { passed: true, method: "declared" }, createdAt: 1, character: "c-1", sendUsageCounts: true, admin: false, state: "guest", username: "ada_lagos", renameFrom: 0 };
const STANDING = { body: { ok: true, standing: { actions: [], mutedUntil: null, suspendedUntil: null, banned: false, reports: [] } } };

const TURNSTILE = `window.turnstile = {
  render(container, options) {
    const box = document.createElement("div");
    box.textContent = "Check passed";
    box.style.cssText = "border:1px solid #bbb;border-radius:6px;padding:10px 12px;font:14px system-ui;width:max-content";
    container.append(box);
    setTimeout(() => options.callback("XXXX.DUMMY.TOKEN.XXXX"), 0);
    return "widget-1";
  },
  reset() {},
  remove() {},
};`;

/** Answers every /api route from `answers`, read at each request so a test can change an answer as the server's state moves. */
async function fakeServer(page: Page, answers: Record<string, Answer>, sent: string[] = []): Promise<void> {
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => {
      const request = route.request();
      const key = `${request.method()} ${new URL(request.url()).pathname}`;
      sent.push(key);
      const answer = answers[key];
      if (answer === undefined) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ ok: false, code: "unknown-id", detail: "not faked" }) });
      return route.fulfill({ status: answer.status ?? 200, contentType: "application/json", body: JSON.stringify(answer.body) });
    },
  );
  await page.routeWebSocket(/\/api\/place\/.+\/socket$/, () => undefined);
  await page.route("https://challenges.cloudflare.com/**", (route) => route.fulfill({ contentType: "text/javascript", body: TURNSTILE }));
}

/** A guest's life past its first chapter, so the early win is in and the first ask is due. */
function pastFirstChapter(): Answer {
  const game = start({ scenario: "scenario.tunde", content });
  game.grant(1);
  const view = game.view();
  return { body: { ok: true, view: { ...view, chapter: { ...view.chapter, done: ["chapter.find-your-feet"], current: "chapter.build-the-file" } }, lines: [], clock: CLOCK } };
}

test("[R-ACCOUNT-021] [R-GUIDE-015] a new visitor passes the age screen, picks a username and starts a life; no sign-in method is asked at the door", async ({ page }, info) => {
  const sent: string[] = [];
  const answers: Record<string, Answer> = {
    "GET /api/view": SIGNED_OUT,
    "GET /api/age": { body: { refused: false } },
    "POST /api/age": { body: { ok: true } },
    "POST /api/guest": { body: { ok: true, account: GUEST } },
    "GET /api/account": { body: { ok: true, account: GUEST } },
  };
  await fakeServer(page, answers, sent);
  await page.goto("/");
  await page.getByLabel("Date of birth").fill("1990-05-17");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Pick a username" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await page.getByLabel("Username").fill("ada_lagos");
  await expect(page.getByText("Check passed")).toBeVisible();
  await shoot(page, "username", info.project.name);
  answers["GET /api/view"] = NO_CHARACTER;
  await page.getByRole("button", { name: "Start my life" }).click();
  await expect(page.getByRole("heading", { name: "Pick a username" })).toHaveCount(0);
  expect(sent).toContain("POST /api/guest");
  expect(sent.some((route) => route.includes("/api/auth/"))).toBe(false);
});

test("[R-ACCOUNT-023] [R-ACCOUNT-027] a guest past its first chapter is asked once to keep the life, and the month's line stays after", async ({ page }, info) => {
  await fakeServer(page, {
    "GET /api/view": pastFirstChapter(),
    "GET /api/account": { body: { ok: true, account: GUEST } },
    "GET /api/moderation/standing": STANDING,
  });
  await page.goto("/");
  const ask = page.getByRole("dialog", { name: "Keep this life" });
  await expect(ask).toBeVisible({ timeout: 20_000 });
  await expect(ask.getByText("You finished your first chapter.", { exact: false })).toBeVisible();
  await expect(ask.getByRole("button", { name: "Keep it with Google" })).toBeVisible();
  await shoot(page, "first-chapter-ask", info.project.name);
  await ask.getByRole("button", { name: "Not now" }).click();
  await expect(ask).toHaveCount(0);
});

test.describe("inside a messaging app's browser", () => {
  test.use({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 WhatsApp/2.24.1" });

  test("[R-ACCOUNT-023] the securing sheet offers the emailed code and the way out to the browser, and no Google", async ({ page }, info) => {
    const view = pastFirstChapter();
    await fakeServer(page, {
      "GET /api/view": view,
      "GET /api/account": { body: { ok: true, account: GUEST } },
      "GET /api/moderation/standing": STANDING,
    });
    await page.goto("/");
    const sheet = page.getByRole("dialog", { name: "Keep this life" });
    await expect(sheet).toBeVisible({ timeout: 20_000 });
    await expect(sheet.getByRole("button", { name: "Keep it with Google" })).toHaveCount(0);
    await expect(sheet.getByText("Google sign-in does not work inside this app.", { exact: false })).toBeVisible();
    await expect(sheet.getByRole("link", { name: "Open in your browser" })).toHaveAttribute("href", /^intent:\/\//);
    await sheet.getByLabel("Email").fill("ada@example.com");
    await shoot(page, "securing-sheet-in-app", info.project.name);
  });
});
