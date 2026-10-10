import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

// The start screen online (account.md R-ACCOUNT-029), played against a faked server on the online dev server: every
// /api route is answered here, in the shapes apps/client/src/shared/net/contract.ts copies from the server, and the
// auth library's routes as Better Auth answers them.
import { content } from "../../../packages/content/src/index";
import { finishPrologue, start } from "../../../packages/sim/src/testing/play";
import { standInWorld } from "../../../packages/sim/src/world/standIn";

const ONLINE = `http://localhost:${process.env.E2E_ONLINE_PORT ?? "5180"}`;
test.use({ baseURL: ONLINE });

const PREVIEW = process.env.PREVIEW_DIR;
const TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

async function shoot(page: Page, name: string, project: string): Promise<void> {
  if (PREVIEW === undefined || PREVIEW === "") return;
  const size = project.startsWith("Pixel") ? "phone" : "desktop";
  await page.screenshot({ path: join(PREVIEW, `start-${name}-${size}.png`), fullPage: false });
}

/** The pictures for the report are taken at 390 by 844, a common phone, on the phone run. */
test.beforeEach(async ({ page }, info) => {
  if (PREVIEW !== undefined && PREVIEW !== "" && info.project.name.startsWith("Pixel")) await page.setViewportSize({ width: 390, height: 844 });
});

type Answer = { status?: number; body: unknown };

/** Cloudflare's widget as its always-pass test key behaves; with `interaction-only` it draws nothing, as the real one does when no tap is needed. */
const TURNSTILE = `window.turnstile = {
  render(container, options) {
    if (options.appearance !== "interaction-only") container.append("Check passed");
    setTimeout(() => options.callback("${TOKEN}"), 300);
    return "widget-1";
  },
  reset() {},
  remove() {},
};`;

const CLOCK = { tick: 3, nextTickAt: Date.now() + 3_600_000, nextTurnAt: null };

/** The faked server's side of one browser: where it stands, and every request it was sent. */
interface Faked {
  phase: "signed-out" | "no-character" | "playing";
  sent: { route: string; body: unknown; headers: Record<string, string> }[];
}

/** A life from sixteen as the server makes it at Begin, its years already lived, so the world opens at once. */
function lifeMade(): Answer {
  const game = start({ scenario: "scenario.prologue", content });
  finishPrologue(game);
  if (game.state.turn.banked === 0) game.grant(1);
  return { body: { ok: true, view: game.view(), lines: [], clock: CLOCK } };
}

async function fakeServer(page: Page, answers: Record<string, Answer | ((faked: Faked) => Answer)>): Promise<Faked> {
  const faked: Faked = { phase: "signed-out", sent: [] };
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => {
      const request = route.request();
      const key = `${request.method()} ${new URL(request.url()).pathname}`;
      faked.sent.push({ route: key, body: request.postDataJSON() as unknown, headers: request.headers() });
      const given = answers[key];
      const answer = typeof given === "function" ? given(faked) : given;
      if (answer === undefined) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ ok: false, code: "unknown-id", detail: "not faked" }) });
      return route.fulfill({ status: answer.status ?? 200, contentType: "application/json", body: JSON.stringify(answer.body) });
    },
  );
  await page.routeWebSocket(/\/api\/place\/.+\/socket$/, () => undefined);
  await page.route("https://challenges.cloudflare.com/**", (route) => route.fulfill({ contentType: "text/javascript", body: TURNSTILE }));
  return faked;
}

const NO_SESSION: Answer = { status: 401, body: { ok: false, code: "signed-out", detail: "Sign in to play." } };
const NO_CHARACTER: Answer = { status: 404, body: { ok: false, code: "no-character", detail: "This account has no character yet." } };
const USER = { id: "account-1", email: "ada@example.test", emailVerified: true, name: "", createdAt: "2026-10-10T00:00:00.000Z", updatedAt: "2026-10-10T00:00:00.000Z" };

const GUEST = { id: "account-guest", country: "NG", age: { passed: true, method: "declared" }, createdAt: 1, character: null, sendUsageCounts: true, admin: false, state: "guest", username: "Ada", renameFrom: 0 };

/** The routes of a browser never refused, whose guest start and code sign-in work; the view follows the phase. */
function signUpRoutes(made: Answer): Record<string, Answer | ((faked: Faked) => Answer)> {
  return {
    "GET /api/age": { body: { refused: false } },
    "POST /api/age": { body: { ok: true } },
    "POST /api/guest": (faked) => {
      faked.phase = "no-character";
      return { body: { ok: true, account: GUEST } };
    },
    "POST /api/auth/email-otp/send-verification-otp": { body: { success: true } },
    "POST /api/auth/sign-in/email-otp": (faked) => {
      faked.phase = "no-character";
      return { body: { token: "session-1", user: USER } };
    },
    "GET /api/view": (faked) => (faked.phase === "signed-out" ? NO_SESSION : faked.phase === "no-character" ? NO_CHARACTER : made),
    "POST /api/character": (faked) => {
      faked.phase = "playing";
      return made;
    },
    "GET /api/world": { body: { tick: CLOCK.tick, world: standInWorld("world-1", CLOCK.tick, content), nextTickAt: CLOCK.nextTickAt } },
    "GET /api/account": { body: { ok: true, account: { id: USER.id, country: "NG", age: { passed: true, method: "declared" }, createdAt: 1, character: null } } },
  };
}

async function pickBirth(page: Page, day: string, month: string, year: string): Promise<void> {
  await page.getByRole("combobox", { name: "Day" }).selectOption(day);
  await page.getByRole("combobox", { name: "Month" }).selectOption({ label: month });
  await page.getByRole("combobox", { name: "Year" }).selectOption(year);
}

test("[R-ACCOUNT-029] [R-ACCOUNT-021] Play leads to the age screen, the three-screen door, Begin making the guest life with the bot check unseen, and the world", async ({ page }, info) => {
  const faked = await fakeServer(page, signUpRoutes(lifeMade()));
  await page.goto("/");

  // The start screen over the compound: the game's name, one line, Play, and the way back to a kept life.
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-gate="start"] [data-front-scene]')).toBeAttached();
  // The compound draws in its own chunk; the picture waits for it, where the browser can draw it at all.
  await page.locator("[data-front-scene] canvas").waitFor({ timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(800);
  await expect(page.getByRole("button", { name: "I already have a life here" })).toBeVisible();
  await expect(page.locator("[data-start-name]")).toHaveText("Japacity");
  await expect(page.getByRole("combobox", { name: "Day" })).toHaveCount(0);
  await shoot(page, "screen", info.project.name);

  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("heading", { name: "When were you born?" })).toBeVisible();
  for (const name of ["Day", "Month", "Year"]) await expect(page.getByRole("combobox", { name })).toHaveValue("");
  await expect(page.getByText("Check passed")).toHaveCount(0);
  await shoot(page, "age", info.project.name);
  await pickBirth(page, "12", "March", "1994");
  await shoot(page, "age-picked", info.project.name);
  await page.getByRole("button", { name: "Continue" }).click();

  // The date as picked and no token: the bot check goes with the guest start (R-ACCOUNT-013).
  const name = page.getByRole("textbox", { name: "Your name" });
  await expect(name).toBeVisible({ timeout: 20_000 });
  const declared = faked.sent.find((request) => request.route === "POST /api/age");
  expect(declared?.body).toEqual({ dateOfBirth: "1994-03-12" });
  expect(declared?.headers["x-captcha-response"]).toBeUndefined();
  // No way in at the door, and no username on a screen of its own.
  await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
  await expect(page.getByLabel("Username")).toHaveCount(0);
  await name.fill("Ọlámídé");
  await shoot(page, "door", info.project.name);

  // The door: three screens with everything chosen, so Next, Next, Begin starts a life.
  await page.getByRole("button", { name: /^Next/ }).first().click();
  await page.getByRole("button", { name: /^Next/ }).first().click();
  // The page: the username filled in from the name, and the guest line said once.
  await expect(page.getByLabel("Username")).toHaveValue("Olamide");
  await expect(page.getByText("This life lives only on this phone until you keep it.")).toHaveCount(1);
  await expect(page.getByText("Check passed")).toHaveCount(0);
  // The sheet rises into place before its picture.
  await page.waitForTimeout(800);
  await shoot(page, "page", info.project.name);
  await page.getByRole("button", { name: /^Begin/ }).click();
  await expect(page.locator("[data-thumb='map']")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-thumb='phone']")).toBeVisible();

  // The guest first, with the username and the unseen check's token; then the one character.
  const guest = faked.sent.find((request) => request.route === "POST /api/guest");
  expect(guest?.body).toEqual({ username: "Olamide" });
  expect(guest?.headers["x-captcha-response"]).toBe(TOKEN);
  const order = faked.sent.map((request) => request.route).filter((route) => route === "POST /api/guest" || route === "POST /api/character");
  expect(order).toEqual(["POST /api/guest", "POST /api/character"]);
  expect(faked.sent.some((request) => request.route.startsWith("POST /api/auth/"))).toBe(false);
  await shoot(page, "world", info.project.name);
});

test("[R-ACCOUNT-029] under 18 is refused on the age screen, and the refusal is remembered on the next visit", async ({ page }, info) => {
  let refused = false;
  const thisYear = new Date().getFullYear();
  await fakeServer(page, {
    "GET /api/age": () => ({ body: { refused } }),
    "POST /api/age": () => {
      refused = true;
      return { status: 403, body: { ok: false, code: "under-age", detail: "This browser cannot sign up." } };
    },
    "GET /api/view": NO_SESSION,
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Play", exact: true }).click({ timeout: 20_000 });
  await pickBirth(page, "1", "January", String(thisYear - 10));
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("You cannot play Japacity.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
  await shoot(page, "refused", info.project.name);

  await page.reload();
  await expect(page.getByText("You cannot play Japacity.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Play", exact: true })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Day" })).toHaveCount(0);
});

test("[R-ACCOUNT-029] I already have a life here shows the ways back in, Google first, with no age screen", async ({ page }, info) => {
  const faked = await fakeServer(page, signUpRoutes(lifeMade()));
  await page.goto("/");
  await page.getByRole("button", { name: "I already have a life here" }).click({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Sign back in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Use a passkey" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Day" })).toHaveCount(0);
  await shoot(page, "returning", info.project.name);
  expect(faked.sent.some((request) => request.route === "POST /api/age")).toBe(false);

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
});
