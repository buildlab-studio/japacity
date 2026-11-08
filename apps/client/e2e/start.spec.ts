import { generateKeyPairSync } from "node:crypto";

import { standInWorld } from "@japacity/sim";
import { finishPrologue, start } from "@japacity/sim/testing";
import { expect, type Page } from "@playwright/test";
import { test } from "./support/policy";

// The start screen online (account:start-screen-over-live-city), played against a faked server on the online dev server: every
// /api route is answered here, in the shapes of @japacity/api, and the
// auth library's routes as Better Auth answers them.
import { content } from "../../../packages/content/src/index";
import { accountView } from "../src/shared/testing/fixtures";
import { type Answer, CAPTCHA_TOKEN as TOKEN, clockAt, fakeServer, ONLINE, SIGNED_OUT, viewReply } from "./support/api";
import { passThePage } from "./support/door";
import { opensWithFocus } from "./support/focus";
import { previewDir, shoot, shootAtSize } from "./support/preview";

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

/** The auth library's passkey sign-in options, as the server answers each request for a fresh challenge. */
const AUTHENTICATE_OPTIONS: Answer = { body: { challenge: Buffer.from("a challenge of the server's").toString("base64url"), rpId: "localhost", userVerification: "preferred", timeout: 60_000 } };

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
  const name = page.getByRole("textbox", { name: "Character name" });
  await expect(name).toBeVisible({ timeout: 20_000 });
  const declared = faked.sent.find((request) => request.route === "POST /api/age");
  expect(declared?.body).toEqual({ dateOfBirth: "1994-03-12" });
  expect(declared?.headers["x-captcha-response"]).toBeUndefined();
  // No way in at the door, and no username on a screen of its own.
  await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
  await expect(page.getByLabel("Username")).toHaveCount(0);
  // prologue:front-door-builds-a-person: on Play's path the username comes last, so the empty box suggests the pool's name as its
  // placeholder, under the character's label, and holds the focus as the first field to fill on a desktop, none on a phone.
  await expect(name).toHaveValue("");
  await expect(name).not.toHaveAttribute("placeholder", "");
  await opensWithFocus(page, name);
  if (previewDir !== null) await page.waitForTimeout(600);
  await shootAtSize(page, "focus-door-open", info.project.name);
  await expect(page.locator("label[for='door-name']")).toHaveText("Character name");
  await shootSmall(page, "char-name-door-play", info.project.name);
  await name.fill("Ọlámídé");
  await shootAtSize(page, "start-door", info.project.name);

  // The door: three screens with everything chosen but the name, so with the name typed, Next, Next, Begin starts a life.
  await page.getByRole("button", { name: /^Next/ }).first().click();
  await page.locator("[data-gate='life']").getByRole("button", { name: /^Next/ }).click();
  // The page: the username box empty, never filled from the name (account:username-typed-and-checked); the player types
  // their own and the box says it is free; the guest line said once.
  const username = page.getByLabel("Username");
  await expect(username).toHaveValue("");
  await opensWithFocus(page, username);
  if (previewDir !== null) await page.waitForTimeout(600);
  await shootAtSize(page, "focus-page-open", info.project.name);
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
  // The field's passkey request gets its challenge as the server gives it, and waits for a pick, as a field with no passkey picked does.
  const faked = await fakeDoor(page, { ...signUpRoutes(lifeMade()), "GET /api/auth/passkey/generate-authenticate-options": AUTHENTICATE_OPTIONS });
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Sign back in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  // This browser offers passkeys in the email field's autofill, so the field is the passkey's way and there is no button (account:passkey-in-email-autofill).
  await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "username webauthn");
  await expect(page.getByRole("button", { name: "Use a passkey" })).toHaveCount(0);
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

/** The two phones the ways back in fit whole, keyboard closed: an iPhone SE and a common phone. */
const FIT_SIZES = [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
] as const;

/** The small phone's picture of the screen, on the phone run, the viewport put back after. */
async function shootSmall(page: Page, name: string, project: string): Promise<void> {
  if (previewDir === null || !project.startsWith("Pixel")) return;
  const was = page.viewportSize();
  await page.setViewportSize(FIT_SIZES[0]);
  await shoot(page, `${name}-375x667`, { settleMs: 500 });
  if (was !== null) await page.setViewportSize(was);
}

/** account:code-form-forgives: the sheet's body holds the whole step at each size, with nothing to scroll; the viewport put back after. */
async function fitsWhole(page: Page, step: string): Promise<void> {
  const was = page.viewportSize();
  for (const size of FIT_SIZES) {
    await page.setViewportSize(size);
    await page.waitForTimeout(300);
    const body = page.locator("[data-gate-sheet] > div").first();
    const { scroll, client } = await body.evaluate((element) => ({ scroll: element.scrollHeight, client: element.clientHeight }));
    expect(scroll, `${step} at ${String(size.width)} by ${String(size.height)}: ${String(scroll)} tall in ${String(client)}`).toBeLessThanOrEqual(client);
  }
  if (was !== null) await page.setViewportSize(was);
}

/** The address no account uses in the sign-in tests, and the account the username's step makes for it. */
const NEW_EMAIL = "new@example.test";
const KEPT = accountView({ id: "account-new", character: null, state: "secured", username: "Olamide", ways: { google: null, email: NEW_EMAIL, passkeys: 0 } });
const KEPT_USER = { ...USER, id: KEPT.id, email: NEW_EMAIL };

/** What the faked server holds across browsers: the codes mailed, newest last, and whether the username's step made the account. */
interface Shared {
  mailed: string[];
  made: boolean;
}

/**
 * The faked server of one browser for a life started by sign-in: the send answers every address alike and mails each a code;
 * the right code signs in where an account uses the address (ada's, or the new one once made) and otherwise answers new-life
 * and holds a proof for this browser, which the age standing names; the guest start by the code makes the account kept by the
 * email. `gone` answers the first Continue proof-gone, as a proof that ran out.
 */
async function fakeSignInStart(page: Page, shared: Shared, { gone = false }: { gone?: boolean } = {}): Promise<Faked> {
  let proved = false;
  let passed = false;
  let goneLeft = gone ? 1 : 0;
  return fakeDoor(page, {
    ...signUpRoutes(lifeMade()),
    "GET /api/auth/passkey/generate-authenticate-options": AUTHENTICATE_OPTIONS,
    "GET /api/age": () => ({ body: { refused: false, passed, ...(proved ? { newLife: NEW_EMAIL } : {}) } }),
    "POST /api/age": () => {
      passed = true;
      return { body: { ok: true } };
    },
    "POST /api/auth/email-otp/send-verification-otp": () => {
      shared.mailed.push(String(400000 + shared.mailed.length * 7919));
      return { body: { success: true } };
    },
    "POST /api/auth/sign-in/email-otp": (faked) => {
      const body = faked.sent.at(-1)?.body as { email?: string; otp?: string } | undefined;
      if (body?.otp !== shared.mailed.at(-1)) return { status: 400, body: { message: "Invalid OTP", code: "INVALID_OTP" } };
      if (body?.email === USER.email || (body?.email === NEW_EMAIL && shared.made)) {
        faked.phase = "no-character";
        return { body: { token: "session-1", user: body.email === USER.email ? USER : KEPT_USER } };
      }
      proved = true;
      return { body: { next: "new-life" } };
    },
    "POST /api/guest": (faked) => {
      if (goneLeft > 0) {
        goneLeft -= 1;
        proved = false;
        return { status: 403, body: { ok: false, code: "proof-gone", detail: "Your code ran out. Send a new one." } };
      }
      shared.made = true;
      proved = false;
      faked.phase = "no-character";
      return { body: { ok: true, account: KEPT } };
    },
    "GET /api/account": { body: { ok: true, account: KEPT } },
  });
}

/** Sign in, the address no account uses, its code: the gate stands on the age screen under the line that says why. */
async function signInWithNewEmail(page: Page, shared: Shared): Promise<void> {
  await page.getByRole("button", { name: "Sign in", exact: true }).click({ timeout: 20_000 });
  await page.getByLabel("Email").fill(NEW_EMAIL);
  await page.getByRole("button", { name: "Send me a code" }).click();
  await expect(page.getByText(`We sent a code to ${NEW_EMAIL}.`)).toBeVisible();
  await page.getByLabel("6-digit code").fill(shared.mailed.at(-1) ?? "");
  await expect(page.getByRole("heading", { name: "When were you born?" })).toBeVisible({ timeout: 20_000 });
}

test("[account:sign-in-without-secret] [account:guest-secures-the-life] [account:code-form-forgives] Sign back in: the code step stands alone and answers every address alike; the right code for an address no account uses leads to the age screen under its line, the username's own step, the door with no username box and the world, the life kept by that email from the start", async ({ page, browser }, info) => {
  // The whole way: the ways back in, the code, the age screen, the username, the door, the world and the account sheet.
  test.setTimeout(150_000);
  const shared: Shared = { mailed: [], made: false };
  const faked = await fakeSignInStart(page, shared);
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Sign back in" })).toBeVisible();
  // The email box is the first field to fill there: focused on a desktop, and no keyboard raised on a phone.
  await opensWithFocus(page, page.getByLabel("Email"));
  await page.waitForTimeout(800);
  await fitsWhole(page, "the ways back in");
  await shootAtSize(page, "code-step-first", info.project.name);
  await shootSmall(page, "code-step-first", info.project.name);

  // A kept address: the code step alone, under Check your email.
  await page.getByLabel("Email").fill(USER.email);
  await page.getByRole("button", { name: "Send me a code" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await opensWithFocus(page, page.getByLabel("6-digit code"));
  await expect(page.getByText(`We sent a code to ${USER.email}.`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Use a passkey" })).toHaveCount(0);
  await expect(page.getByText("Use the way you signed in before.")).toHaveCount(0);
  await fitsWhole(page, "the code step");
  // Change wraps with the address and never starts a line of its own, at either size.
  const before = page.viewportSize();
  for (const size of FIT_SIZES) {
    await page.setViewportSize(size);
    const [line, change] = await Promise.all([page.locator("[data-code-sent]").boundingBox(), page.getByRole("button", { name: "Change", exact: true }).boundingBox()]);
    expect((change?.x ?? 0) - (line?.x ?? 0), `Change at ${String(size.width)} by ${String(size.height)}`).toBeGreaterThan(8);
  }
  if (before !== null) await page.setViewportSize(before);
  await shootAtSize(page, "code-step-code", info.project.name);
  await shootSmall(page, "code-step-code", info.project.name);
  await page.getByRole("button", { name: "Change", exact: true }).click();
  await expect(page.getByLabel("Email")).toHaveValue(USER.email);
  await opensWithFocus(page, page.getByLabel("Email"));

  // An address no account uses: the same answer, the same code step, a code mailed to it.
  await page.getByLabel("Email").fill(NEW_EMAIL);
  await page.getByRole("button", { name: "Send me a code" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.getByText(`We sent a code to ${NEW_EMAIL}.`)).toBeVisible();
  await expect(page.getByText(/No account uses/)).toHaveCount(0);
  expect(shared.mailed).toHaveLength(2);
  expect(faked.sent.filter((request) => request.route === "POST /api/auth/email-otp/send-verification-otp").map((request) => request.body)).toEqual([
    { email: USER.email, type: "sign-in" },
    { email: NEW_EMAIL, type: "sign-in" },
  ]);
  await shootAtSize(page, "one-code-code-step", info.project.name);
  await shootSmall(page, "one-code-code-step", info.project.name);
  await page.getByLabel("6-digit code").fill(shared.mailed.at(-1) ?? "");

  // The age screen under the line that says why, with no line back to the ways back in just tried.
  await expect(page.getByRole("heading", { name: "When were you born?" })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-kept-line]")).toHaveText(`No life is saved with ${NEW_EMAIL} yet. Let's start one. Use another email`);
  await expect(page.getByRole("button", { name: "Use another email" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Already have a life here? Sign in." })).toHaveCount(0);
  await page.waitForTimeout(500);
  await shootAtSize(page, "one-code-age", info.project.name);
  await shootSmall(page, "one-code-age", info.project.name);
  await pickBirth(page, "12", "March", "1994");
  await page.getByRole("button", { name: "Continue" }).click();

  // The username's own step: the door's box, its check as it is typed, no guest line, one main button.
  await expect(page.getByRole("heading", { name: "Choose a username" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("Username")).toHaveValue("");
  await opensWithFocus(page, page.getByLabel("Username"));
  await expect(page.getByText("This life lives only on this phone until you save it.")).toHaveCount(0);
  await page.getByLabel("Username").fill("Olamide");
  await expect(page.getByText("That name is free.")).toBeVisible();
  await fitsWhole(page, "the username's step");
  await shootAtSize(page, "one-code-username", info.project.name);
  await shootSmall(page, "one-code-username", info.project.name);
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  // The door as a signed-in account with no character meets it: the name, Next, Next, Begin, and no username box anywhere.
  const name = page.getByRole("textbox", { name: "Character name" });
  await expect(name).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("Username")).toHaveCount(0);
  // prologue:front-door-builds-a-person: the username was chosen first, so the empty box suggests the character's name from it.
  await expect(name).toHaveValue("");
  await expect(name).toHaveAttribute("placeholder", "Olamide");
  await shootSmall(page, "char-name-door-signin", info.project.name);
  const guest = faked.sent.find((request) => request.route === "POST /api/guest");
  expect(guest?.body).toEqual({ username: "Olamide", proved: true });
  expect(guest?.headers["x-captcha-response"]).toBe(TOKEN);
  // Escape, as Back, leaves the door where it is: there is no start screen behind it for a signed-in player.
  await page.keyboard.press("Escape");
  await expect(name).toBeVisible();
  await expect(page.getByRole("button", { name: "Play", exact: true })).toHaveCount(0);
  await page.waitForTimeout(500);
  await shootAtSize(page, "one-code-door", info.project.name);
  await shootSmall(page, "one-code-door", info.project.name);

  // Another browser, after Continue and before Begin: signing in with the email finds the account, and the door opens there too.
  const other = await browser.newContext({ ...(info.project.use.viewport === undefined ? {} : { viewport: info.project.use.viewport }), baseURL: ONLINE });
  const elsewhere = await other.newPage();
  await fakeSignInStart(elsewhere, shared);
  await elsewhere.goto("/");
  await elsewhere.getByRole("button", { name: "Sign in", exact: true }).click({ timeout: 20_000 });
  await elsewhere.getByLabel("Email").fill(NEW_EMAIL);
  await elsewhere.getByRole("button", { name: "Send me a code" }).click();
  await elsewhere.getByLabel("6-digit code").fill(shared.mailed.at(-1) ?? "");
  await expect(elsewhere.getByRole("textbox", { name: "Character name" })).toHaveAttribute("placeholder", "Olamide", { timeout: 20_000 });
  await expect(elsewhere.getByRole("heading", { name: "When were you born?" })).toHaveCount(0);
  await expect(elsewhere.getByLabel("Username")).toHaveCount(0);
  await other.close();

  await name.fill("Ọlámídé");
  await page.getByRole("button", { name: /^Next/ }).first().click();
  await page.locator("[data-gate='life']").getByRole("button", { name: /^Next/ }).click();
  await expect(page.getByLabel("Username")).toHaveCount(0);
  await page.getByRole("button", { name: /^Begin/ }).click();
  await passThePage(page, 20_000);
  await expect(page.locator("[data-thumb='map']")).toBeVisible({ timeout: 20_000 });
  expect(faked.sent.filter((request) => request.route === "POST /api/guest")).toHaveLength(1);
  expect(faked.sent.map((request) => request.route).filter((route) => route === "POST /api/guest" || route === "POST /api/character")).toEqual(["POST /api/guest", "POST /api/character"]);

  // The life is kept by that email: the Kept sheet over the world with the passkey as its next step, as after any keep, its line as
  // it closes, no chip, the account sheet naming the address, and nothing asking to save it. The first chapter's card stands first;
  // the Kept sheet waits for it.
  await page.locator("[data-brief]").getByRole("button", { name: "Let's go" }).click({ timeout: 20_000 });
  const kept = page.getByRole("dialog", { name: "Saved" });
  await expect(kept).toBeVisible({ timeout: 10_000 });
  await expect(kept.getByRole("heading", { name: "Sign in faster next time" })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("[data-passkey-card]")).toHaveCount(0);
  await shootSmall(page, "one-code-kept", info.project.name);
  await shootAtSize(page, "one-code-kept", info.project.name);
  await kept.locator("[data-passkey-step]").getByRole("button", { name: "Not now" }).click();
  await expect(kept).toHaveCount(0);
  await expect(page.locator("[data-way-toast]")).toHaveText("Saved with your email");
  // The line stands a few seconds: the small phone's picture first, while it does.
  await shootSmall(page, "one-code-welcome", info.project.name);
  await shootAtSize(page, "one-code-welcome", info.project.name);
  await expect(page.locator("[data-save-chip]")).toHaveCount(0);
  await page.locator('[data-thumb="phone"]').click();
  await page.locator('[data-app="settings"]').click();
  const row = page.locator("[data-account-row]");
  await expect(row).toContainText("Signed in with your email");
  await row.click();
  const sheet = page.getByRole("dialog", { name: "Account" });
  await expect(sheet).toContainText(NEW_EMAIL);
  // account:username-and-unconfirmed-email: the username and the character's name as two labelled rows.
  await expect(sheet.locator("[data-username]")).toContainText("Username");
  await expect(sheet.locator("[data-username]")).toContainText("@Olamide");
  await expect(sheet.locator("[data-life-name]")).toHaveText("Character nameỌlámídé");
  await sheet.locator("[data-life-name]").scrollIntoViewIfNeeded();
  await shootSmall(page, "char-name-sheet-rows", info.project.name);
  await expect(sheet.getByRole("button", { name: "Save this life" })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Save this life" })).toHaveCount(0);
  await expect(page.getByText("This life lives only on this phone until you save it.")).toHaveCount(0);
});

test("[account:sign-in-without-secret] a proof that ran out before Continue is told on the username's step with a new code sent and the code form there; its right code lets Continue go on with the username kept, and a reload before it opens on the step again", async ({ page }, info) => {
  test.setTimeout(90_000);
  const shared: Shared = { mailed: [], made: false };
  const faked = await fakeSignInStart(page, shared, { gone: true });
  await page.goto("/");
  await signInWithNewEmail(page, shared);
  // A reload on the age screen opens on it again: the server names this browser's proof, never the address in the page's storage.
  await page.reload();
  await expect(page.getByRole("heading", { name: "When were you born?" })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-kept-line]")).toContainText(NEW_EMAIL);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + location.href)).not.toContain(NEW_EMAIL);
  await pickBirth(page, "12", "March", "1994");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Username").fill("Olamide");
  await expect(page.getByText("That name is free.")).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(page.locator("[data-code-sent]")).toHaveText(`Your code ran out. We sent a new one to ${NEW_EMAIL}.`);
  await opensWithFocus(page, page.getByLabel("6-digit code"));
  await expect(page.getByLabel("Username")).toHaveValue("Olamide");
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toHaveCount(1);
  expect(shared.mailed).toHaveLength(2);
  await page.waitForTimeout(500);
  await shootAtSize(page, "one-code-proof-gone", info.project.name);
  // On the small phone the step scrolls to the code form, as its focus brings it into view.
  if (previewDir !== null && info.project.name.startsWith("Pixel")) {
    const was = page.viewportSize();
    await page.setViewportSize(FIT_SIZES[0]);
    await page.getByLabel("6-digit code").scrollIntoViewIfNeeded();
    await shoot(page, "one-code-proof-gone-375x667", { settleMs: 500 });
    if (was !== null) await page.setViewportSize(was);
  }
  await page.getByLabel("6-digit code").fill(shared.mailed.at(-1) ?? "");
  await expect(page.getByRole("textbox", { name: "Character name" })).toBeVisible({ timeout: 20_000 });
  expect(faked.sent.filter((request) => request.route === "POST /api/guest").map((request) => request.body)).toEqual([
    { username: "Olamide", proved: true },
    { username: "Olamide", proved: true },
  ]);
});

/** The account Google's new life makes at Continue: kept by the address Google verified, with Google as its way in. */
const KEPT_WITH_GOOGLE = accountView({ id: "account-google", character: null, state: "secured", username: "Olamide", ways: { google: NEW_EMAIL, email: NEW_EMAIL, passkeys: 0 } });

/**
 * The faked server of one browser for a life started by Google: "Continue with Google" is answered as the library answers it, with
 * the address to go to, and Google's stand-in is the callback's own redirect home with the new life's error (no page of Google's is
 * reached); the age standing then names the proof Google made, and the guest start by the proof makes the account kept with Google.
 */
async function fakeGoogleStart(page: Page): Promise<Faked> {
  let proved = false;
  let passed = false;
  return fakeDoor(page, {
    ...signUpRoutes(lifeMade()),
    "GET /api/auth/passkey/generate-authenticate-options": AUTHENTICATE_OPTIONS,
    "POST /api/auth/sign-in/social": () => {
      proved = true;
      return { body: { url: `${ONLINE}/?error=new-life&error_description=No+life+is+saved+with+this+Google+account+yet.+Start+one.`, redirect: true } };
    },
    "GET /api/age": () => ({ body: { refused: false, passed, ...(proved ? { newLife: NEW_EMAIL, newLifeBy: "google" } : {}) } }),
    "POST /api/age": () => {
      passed = true;
      return { body: { ok: true } };
    },
    "POST /api/guest": (faked) => {
      proved = false;
      faked.phase = "no-character";
      return { body: { ok: true, account: KEPT_WITH_GOOGLE } };
    },
    "GET /api/account": { body: { ok: true, account: KEPT_WITH_GOOGLE } },
  });
}

test("[account:sign-in-without-secret] [account:guest-secures-the-life] Continue with Google with no life leads to the age screen under the code's line with Use another way, the username's own step, the door and the world, the life saved with Google from the start", async ({ page }, info) => {
  test.setTimeout(150_000);
  const faked = await fakeGoogleStart(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click({ timeout: 20_000 });
  await page.getByRole("button", { name: "Continue with Google" }).click();

  // Home from Google with the new life's mark: the age screen under the line, the address left clean, no code sent.
  await expect(page.getByRole("heading", { name: "When were you born?" })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-kept-line]")).toHaveText(`No life is saved with ${NEW_EMAIL} yet. Let's start one. Use another way`);
  await expect(page.getByRole("button", { name: "Use another email" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Already have a life here? Sign in." })).toHaveCount(0);
  expect(new URL(page.url()).search).toBe("");
  expect(faked.sent.filter((request) => request.route === "POST /api/auth/email-otp/send-verification-otp")).toEqual([]);
  await page.waitForTimeout(500);
  await shootAtSize(page, "google-start-age", info.project.name);
  await shootSmall(page, "google-start-age", info.project.name);
  await pickBirth(page, "12", "March", "1994");
  await page.getByRole("button", { name: "Continue" }).click();

  // The username's own step, under the same line.
  await expect(page.getByRole("heading", { name: "Choose a username" })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-kept-line]")).toContainText(NEW_EMAIL);
  await page.getByLabel("Username").fill("Olamide");
  await expect(page.getByText("That name is free.")).toBeVisible();
  await fitsWhole(page, "Google's username step");
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  // The door as a signed-in account with no character meets it.
  const name = page.getByRole("textbox", { name: "Character name" });
  await expect(name).toBeVisible({ timeout: 20_000 });
  const guest = faked.sent.find((request) => request.route === "POST /api/guest");
  expect(guest?.body).toEqual({ username: "Olamide", proved: true });
  expect(guest?.headers["x-captcha-response"]).toBe(TOKEN);
  await name.fill("Ọlámídé");
  await page.getByRole("button", { name: /^Next/ }).first().click();
  await page.locator("[data-gate='life']").getByRole("button", { name: /^Next/ }).click();
  await page.getByRole("button", { name: /^Begin/ }).click();
  await passThePage(page, 20_000);
  await expect(page.locator("[data-thumb='map']")).toBeVisible({ timeout: 20_000 });

  // The Kept sheet stands once the first brief's card is handed, with the passkey as its next step; its line is said as it closes,
  // and the account sheet shows Google as the way in, with nothing asking to save the life.
  await page.locator("[data-brief]").getByRole("button", { name: "Let's go" }).click({ timeout: 20_000 });
  const kept = page.getByRole("dialog", { name: "Saved" });
  await expect(kept).toBeVisible({ timeout: 10_000 });
  await expect(kept.getByRole("heading", { name: "Sign in faster next time" })).toBeVisible({ timeout: 10_000 });
  await kept.locator("[data-passkey-step]").getByRole("button", { name: "Not now" }).click();
  await expect(page.locator("[data-way-toast]")).toHaveText("Saved with Google");
  await shootSmall(page, "google-start-welcome", info.project.name);
  await shootAtSize(page, "google-start-welcome", info.project.name);
  await expect(page.locator("[data-passkey-card]")).toHaveCount(0);
  await page.locator('[data-thumb="phone"]').click();
  await page.locator('[data-app="settings"]').click();
  const row = page.locator("[data-account-row]");
  await expect(row).toContainText("Signed in with Google");
  await expect(row).not.toContainText(NEW_EMAIL);
  await row.click();
  const sheet = page.getByRole("dialog", { name: "Account" });
  await expect(sheet.getByText(`Signed in with Google as ${NEW_EMAIL}`)).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Save this life" })).toHaveCount(0);
  await expect(page.getByText("This life lives only on this phone until you save it.")).toHaveCount(0);
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

/** A passkey of this game's kept by the browser's own authenticator, which answers with no prompt; its id as the server reads it. */
async function virtualPasskey(page: Page): Promise<string> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  await cdp.send("WebAuthn.addCredential", {
    authenticatorId,
    credential: { credentialId: Buffer.from("ada-passkey").toString("base64"), isResidentCredential: true, rpId: "localhost", privateKey: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"), userHandle: Buffer.from(USER.id).toString("base64"), signCount: 0 },
  });
  return Buffer.from("ada-passkey").toString("base64url");
}

// The browser's virtual authenticator answers the email field's conditional request as a person picking the passkey in the
// field's autofill would, so the sign-in runs whole, through the browser's own WebAuthn, with no button on the sheet.
test("[account:passkey-in-email-autofill] the email field's request for this browser's passkeys signs in with the passkey picked there, with no button", async ({ page }) => {
  const credential = await virtualPasskey(page);
  const faked = await fakeDoor(page, {
    ...signUpRoutes(lifeMade()),
    "GET /api/auth/passkey/generate-authenticate-options": AUTHENTICATE_OPTIONS,
    "POST /api/auth/passkey/verify-authentication": (given) => {
      given.phase = "playing";
      return { body: { session: { token: "session-1" }, user: USER } };
    },
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click({ timeout: 20_000 });
  await expect.poll(() => faked.sent.filter((request) => request.route === "POST /api/auth/passkey/verify-authentication").map((request) => (request.body as { response: { id: string } }).response.id), { timeout: 20_000 }).toEqual([credential]);
  await expect(page.getByRole("heading", { name: "Sign back in" })).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Your page" })).toBeVisible({ timeout: 20_000 });
});

test("[account:passkey-errors-told-apart] a passkey picked in the email field that no account holds is told in plain words, the button comes back and the sheet stays", async ({ page }) => {
  const credential = await virtualPasskey(page);
  const faked = await fakeDoor(page, {
    ...signUpRoutes(lifeMade()),
    "GET /api/auth/passkey/generate-authenticate-options": AUTHENTICATE_OPTIONS,
    // The server holds no passkey of that id: its account was deleted, the phone still keeps it.
    "POST /api/auth/passkey/verify-authentication": { status: 401, body: { code: "PASSKEY_NOT_FOUND", message: "Passkey not found" } },
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click({ timeout: 20_000 });
  await expect.poll(() => faked.sent.filter((request) => request.route === "POST /api/auth/passkey/verify-authentication").map((request) => (request.body as { response: { id: string } }).response.id), { timeout: 20_000 }).toContain(credential);
  await expect(page.getByRole("alert")).toHaveText("This passkey is not linked to any account. Sign in another way.");
  await expect(page.getByRole("button", { name: "Use a passkey" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign back in" })).toBeVisible();
});
