import { standInWorld } from "@japacity/sim";
import { finishPrologue, start } from "@japacity/sim/testing";
import { expect, test, type Page } from "@playwright/test";

// The start screen online (account:start-screen-over-live-city), played against a faked server on the online dev server: every
// /api route is answered here, in the shapes of @japacity/api, and the
// auth library's routes as Better Auth answers them.
import { content } from "../../../packages/content/src/index";
import { accountView } from "../src/shared/testing/fixtures";
import { type Answer, CAPTCHA_TOKEN as TOKEN, clockAt, fakeServer, ONLINE, SIGNED_OUT, viewReply } from "./support/api";
import { passThePage } from "./support/door";
import { previewDir, shootAtSize } from "./support/preview";

test.use({ baseURL: ONLINE });

/** The pictures for the report are taken at 390 by 844, a common phone, on the phone run. */
test.beforeEach(async ({ page }, info) => {
  if (previewDir !== null && info.project.name.startsWith("Pixel")) await page.setViewportSize({ width: 390, height: 844 });
});

const CLOCK = clockAt(3);

/** The faked server's side of one browser: where it stands, and every request it was sent. */
interface Faked {
  phase: "signed-out" | "no-character" | "playing";
  sent: { route: string; body: unknown; headers: Record<string, string> }[];
}

/** A life from sixteen as the server makes it at Begin, its years already lived, so the world opens at once. */
function lifeMade(): Answer {
  const game = start({ scenario: "scenario.prologue", content });
  finishPrologue(game);
  return { body: viewReply(game, CLOCK.tick) };
}

/** The faked server with the phase its answers follow; every request is kept with its body and headers. The bot check passes a moment after it is drawn. */
async function fakeDoor(page: Page, answers: Record<string, Answer | ((faked: Faked) => Answer)>): Promise<Faked> {
  const faked: Faked = { phase: "signed-out", sent: [] };
  const answering = Object.fromEntries(Object.entries(answers).map(([asked, given]) => [asked, typeof given === "function" ? () => given(faked) : given]));
  await fakeServer(page, answering, {
    heard: (asked, request) => faked.sent.push({ route: asked, body: request.postDataJSON() as unknown, headers: request.headers() }),
    check: { afterMs: 300 },
  });
  return faked;
}

const NO_CHARACTER: Answer = { status: 404, body: { ok: false, code: "no-character", detail: "This account has no character yet." } };
const USER = { id: "account-1", email: "ada@example.test", emailVerified: true, name: "", createdAt: "2026-10-10T00:00:00.000Z", updatedAt: "2026-10-10T00:00:00.000Z" };

const GUEST = accountView({ id: "account-guest", character: null, state: "guest", username: "Ada" });

/** The routes of a browser never refused, whose guest start and code sign-in work; the view follows the phase. */
function signUpRoutes(made: Answer): Record<string, Answer | ((faked: Faked) => Answer)> {
  return {
    "GET /api/age": { body: { refused: false } },
    "POST /api/age": { body: { ok: true } },
    "GET /api/username/available": { body: { ok: true, free: true } },
    "POST /api/guest": (faked) => {
      faked.phase = "no-character";
      return { body: { ok: true, account: GUEST } };
    },
    "POST /api/auth/email-otp/send-verification-otp": { body: { success: true } },
    "POST /api/auth/sign-in/email-otp": (faked) => {
      faked.phase = "no-character";
      return { body: { token: "session-1", user: USER } };
    },
    "GET /api/view": (faked) => (faked.phase === "signed-out" ? SIGNED_OUT : faked.phase === "no-character" ? NO_CHARACTER : made),
    "POST /api/character": (faked) => {
      faked.phase = "playing";
      return made;
    },
    "GET /api/world": { body: { tick: CLOCK.tick, world: standInWorld("world-1", CLOCK.tick, content), nextTickAt: CLOCK.nextTickAt } },
    "GET /api/account": { body: { ok: true, account: accountView({ id: USER.id, character: null }) } },
  };
}

/**
 * The start sheet at rest: it rises from the foot (`.rise`, index.css), so a door read while it moves stands lower than it
 * will, and two doors read a frame apart stand where neither is. Their boxes are read once nothing moves the sheet.
 */
async function doorsAtRest(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const door = document.querySelector("[data-gate-sheet] button");
      if (door === null) return false;
      return document.getAnimations().every((motion) => {
        const moved = (motion.effect as KeyframeEffect | null)?.target;
        return !(moved instanceof Element && moved.contains(door)) || motion.playState !== "running" || motion.effect?.getTiming().iterations === Infinity;
      });
    },
    null,
    { timeout: 20_000 },
  );
}

async function pickBirth(page: Page, day: string, month: string, year: string): Promise<void> {
  await page.getByRole("combobox", { name: "Day" }).selectOption(day);
  await page.getByRole("combobox", { name: "Month" }).selectOption({ label: month });
  await page.getByRole("combobox", { name: "Year" }).selectOption(year);
}

test("[account:start-screen-over-live-city] [account:guest-and-secured-states] [account:username-typed-and-checked] Play leads to the age screen, the three-screen door, the username typed into an empty box, Begin making the guest life with the bot check unseen, and the world", async ({ page }, info) => {
  const faked = await fakeDoor(page, signUpRoutes(lifeMade()));
  await page.goto("/");

  // The start screen over the compound: the hook, the three steps, Play, and the way back to a kept life (account:two-lights-and-wink-lines hangs the two lights over it).
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-gate="start"] [data-front-scene]')).toBeAttached();
  // The compound draws in its own chunk; the picture waits for it, where the browser can draw it at all.
  await page.locator("[data-front-scene] canvas").waitFor({ timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(800);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  // The lockup heads the start sheet, once; there is no title in words over the figure.
  await expect(page.getByRole("img", { name: "Japacity" })).toHaveCount(1);
  await expect(page.getByText("Japacity", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Day" })).toHaveCount(0);
  await shootAtSize(page, "start-screen", info.project.name);

  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("heading", { name: "When were you born?" })).toBeVisible();
  for (const name of ["Day", "Month", "Year"]) await expect(page.getByRole("combobox", { name })).toHaveValue("");
  await expect(page.getByText("Check passed")).toHaveCount(0);
  await shootAtSize(page, "start-age", info.project.name);
  await pickBirth(page, "12", "March", "1994");
  await shootAtSize(page, "start-age-picked", info.project.name);
  await page.getByRole("button", { name: "Continue" }).click();

  // The date as picked and no token: the bot check goes with the guest start (account:bot-check-on-guest-creation).
  const name = page.getByRole("textbox", { name: "Your name" });
  await expect(name).toBeVisible({ timeout: 20_000 });
  const declared = faked.sent.find((request) => request.route === "POST /api/age");
  expect(declared?.body).toEqual({ dateOfBirth: "1994-03-12" });
  expect(declared?.headers["x-captcha-response"]).toBeUndefined();
  // No way in at the door, and no username on a screen of its own.
  await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
  await expect(page.getByLabel("Username")).toHaveCount(0);
  await name.fill("Ọlámídé");
  await shootAtSize(page, "start-door", info.project.name);

  // The door: three screens with everything chosen, so Next, Next, Begin starts a life.
  await page.getByRole("button", { name: /^Next/ }).first().click();
  await page.locator("[data-gate='life']").getByRole("button", { name: /^Next/ }).click();
  // The page: the username box empty, never filled from the name (account:username-typed-and-checked); the player types
  // their own and the box says it is free; the guest line said once.
  const username = page.getByLabel("Username");
  await expect(username).toHaveValue("");
  await username.fill("Olamide");
  await expect(page.getByText("That name is free.")).toBeVisible();
  await expect(page.getByText("This life lives only on this phone until you save it.")).toHaveCount(1);
  await expect(page.getByText("Check passed")).toHaveCount(0);
  // The sheet rises into place before its picture.
  await page.waitForTimeout(800);
  await shootAtSize(page, "start-page", info.project.name);
  await page.getByRole("button", { name: /^Begin/ }).click();
  await passThePage(page, 20_000);
  await expect(page.locator("[data-thumb='map']")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-thumb='phone']")).toBeVisible();

  // The guest first, with the username and the unseen check's token; then the one character.
  const guest = faked.sent.find((request) => request.route === "POST /api/guest");
  expect(guest?.body).toEqual({ username: "Olamide" });
  expect(guest?.headers["x-captcha-response"]).toBe(TOKEN);
  const order = faked.sent.map((request) => request.route).filter((route) => route === "POST /api/guest" || route === "POST /api/character");
  expect(order).toEqual(["POST /api/guest", "POST /api/character"]);
  expect(faked.sent.some((request) => request.route.startsWith("POST /api/auth/"))).toBe(false);
  await shootAtSize(page, "start-world", info.project.name);
});

test("[account:start-screen-over-live-city] under 18 is refused on the age screen, and the refusal is remembered on the next visit", async ({ page }, info) => {
  let refused = false;
  const thisYear = new Date().getFullYear();
  await fakeDoor(page, {
    "GET /api/age": () => ({ body: { refused } }),
    "POST /api/age": () => {
      refused = true;
      return { status: 403, body: { ok: false, code: "under-age", detail: "This browser cannot sign up." } };
    },
    "GET /api/view": SIGNED_OUT,
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Play", exact: true }).click({ timeout: 20_000 });
  await pickBirth(page, "1", "January", String(thisYear - 10));
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("You cannot play Japacity.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
  await shootAtSize(page, "start-refused", info.project.name);

  await page.reload();
  await expect(page.getByText("You cannot play Japacity.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Play", exact: true })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Day" })).toHaveCount(0);
});

test("[account:start-screen-over-live-city] Sign in shows the ways back in, Google first, with no age screen", async ({ page }, info) => {
  const faked = await fakeDoor(page, signUpRoutes(lifeMade()));
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Sign back in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Use a passkey" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Day" })).toHaveCount(0);
  // The wordmark tops the ways back in, once.
  await expect(page.getByRole("img", { name: "Japacity" })).toHaveCount(1);
  await expect(page.getByRole("img", { name: "Japacity" })).toBeVisible();
  await shootAtSize(page, "start-returning", info.project.name);
  expect(faked.sent.some((request) => request.route === "POST /api/age")).toBe(false);

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
});

test("[account:start-screen-over-live-city] the returning door is a full-width button as tall as Play, and the age screen's one line turns back to the ways back in", async ({ page }, info) => {
  const faked = await fakeDoor(page, signUpRoutes(lifeMade()));
  await page.goto("/");
  const play = page.getByRole("button", { name: "Play", exact: true });
  const returning = page.getByRole("button", { name: "Sign in", exact: true });
  await expect(play).toBeVisible({ timeout: 20_000 });
  await doorsAtRest(page);
  const [playBox, returningBox] = await Promise.all([play.boundingBox(), returning.boundingBox()]);
  expect(returningBox?.height ?? 0).toBeCloseTo(playBox?.height ?? -1, 0);
  expect(returningBox?.width ?? 0).toBeCloseTo(playBox?.width ?? -1, 0);
  expect((returningBox?.y ?? 0) > (playBox?.y ?? 0)).toBe(true);

  await play.click();
  await expect(page.getByRole("heading", { name: "When were you born?" })).toBeVisible();
  const line = page.getByRole("button", { name: "Already have a life here? Sign in." });
  await expect(line).toBeVisible();
  await shootAtSize(page, "start-age-sign-in-line", info.project.name);
  await line.click();
  await expect(page.getByRole("heading", { name: "Sign back in" })).toBeVisible();
  expect(faked.sent.some((request) => request.route === "POST /api/age")).toBe(false);
});

test("[account:start-screen-over-live-city] in a browser a kept life was open in, the start screen offers Sign in first and Start a new life under it", async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem("japacity.account.kept", "1"));
  await fakeDoor(page, signUpRoutes(lifeMade()));
  await page.goto("/");
  const back = page.getByRole("button", { name: "Sign in", exact: true });
  const fresh = page.getByRole("button", { name: "Start a new life" });
  await expect(back).toBeVisible({ timeout: 20_000 });
  await expect(fresh).toBeVisible();
  await expect(page.getByRole("button", { name: "Play", exact: true })).toHaveCount(0);
  await doorsAtRest(page);
  const [backBox, freshBox] = await Promise.all([back.boundingBox(), fresh.boundingBox()]);
  expect((freshBox?.y ?? 0) > (backBox?.y ?? 0)).toBe(true);
  await page.locator("[data-front-scene] canvas").waitFor({ timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(800);
  await shootAtSize(page, "start-screen-kept", info.project.name);
  await back.click();
  await expect(page.getByRole("heading", { name: "Sign back in" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await fresh.click();
  await expect(page.getByRole("heading", { name: "When were you born?" })).toBeVisible();
});

test.describe("inside a messaging app's browser", () => {
  test.use({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 WhatsApp/2.24.1" });

  test("[account:guest-secures-the-life] the start screen says where the life is saved, with Open in my browser to Chrome, and Play still works", async ({ page }, info) => {
    await fakeDoor(page, signUpRoutes(lifeMade()));
    await page.goto("/");
    await expect(page.getByText("Opened inside an app? Your life lives in the browser you play in.")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("link", { name: "Open in my browser" })).toHaveAttribute("href", /^intent:\/\/.*package=com\.android\.chrome;S\.browser_fallback_url=/);
    await page.waitForTimeout(800);
    await shootAtSize(page, "start-screen-in-app", info.project.name);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("heading", { name: "When were you born?" })).toBeVisible();
  });
});
