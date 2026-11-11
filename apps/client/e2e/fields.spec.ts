import { expect, type Locator, type Page } from "@playwright/test";
import { test } from "./support/policy";

// The fields' lines as drawn (world:field-says-its-state): at each size and in both paints, a problem stands directly under its
// box in the out colour with its icon, the box's edge in the same colour and the yellow focus ring outside it, and a free name
// stands with the tick in money in's colour. Played against a faked server as guest.spec.ts does; PREVIEW_DIR saves the pictures.
import { GUEST } from "./support/account";
import { type Answer, fakeServer, NO_CHARACTER, ONLINE, SIGNED_OUT } from "./support/api";
import { giveName } from "./support/door";
import { shoot } from "./support/preview";

test.use({ baseURL: ONLINE });

/** The sizes a project draws: the two phones on the phone project, the laptop on the desktop one. */
function sizes(project: string): { width: number; height: number }[] {
  return project.startsWith("Pixel")
    ? [
        { width: 390, height: 844 },
        { width: 360, height: 780 },
      ]
    : [{ width: 1440, height: 900 }];
}

const PAINTS = ["day", "night"] as const;
/** The yellow of the one action, as the focus ring outside a marked box draws it. */
const ACTION = "rgb(242, 183, 5)";

/** What the box and its line draw, and the paint's out and in colours, read in the page. */
async function drawn(box: Locator, line: Locator): Promise<{ out: string; in: string; ink: string; edge: string; ring: string; gap: number; icon: boolean }> {
  const note = await line.elementHandle();
  return box.evaluate((input, held) => {
    const said = held as Element;
    const probe = document.createElement("span");
    document.body.append(probe);
    probe.style.color = "var(--out)";
    const out = getComputedStyle(probe).color;
    probe.style.color = "var(--in)";
    const inside = getComputedStyle(probe).color;
    probe.remove();
    const icon = said.querySelector("svg");
    return {
      out,
      in: inside,
      ink: getComputedStyle(said).color,
      edge: getComputedStyle(input).borderTopColor,
      ring: getComputedStyle(input).boxShadow,
      gap: said.getBoundingClientRect().top - input.getBoundingClientRect().bottom,
      icon: icon !== null && icon.getBoundingClientRect().width > 0,
    };
  }, note);
}

/** A problem as the player sees it: under the box, the out colour on the line and on the box's edge, the icon drawn. */
async function isProblem(box: Locator, line: Locator, { under = 12 }: { under?: number } = {}): Promise<void> {
  await expect(line).toBeVisible();
  const seen = await drawn(box, line);
  expect(seen.ink).toBe(seen.out);
  expect(seen.edge).toBe(seen.out);
  expect(seen.icon).toBe(true);
  expect(seen.gap).toBeGreaterThanOrEqual(0);
  expect(seen.gap).toBeLessThanOrEqual(under);
  if (await box.evaluate((input) => input === document.activeElement)) expect(seen.ring).toContain(ACTION);
}

/** A good state: the tick and money in's colour under the box, the box's edge not the out colour. */
async function isGood(box: Locator, line: Locator): Promise<void> {
  await expect(line).toBeVisible();
  const seen = await drawn(box, line);
  expect(seen.ink).toBe(seen.in);
  expect(seen.edge).not.toBe(seen.out);
  expect(seen.icon).toBe(true);
}

/** Each size and paint the project draws: the paint set, the field brought into view, checked and shot as `fields-<name>-<size>-<paint>`. */
async function eachLook(page: Page, project: string, name: string, box: Locator, check: () => Promise<void>): Promise<void> {
  for (const size of sizes(project)) {
    await page.setViewportSize(size);
    for (const paint of PAINTS) {
      await page.evaluate((asked) => {
        document.documentElement.dataset.paint = asked;
      }, paint);
      await box.scrollIntoViewIfNeeded();
      await check();
      await shoot(page, `fields-${name}-${String(size.width)}x${String(size.height)}-${paint}`, { settleMs: 300 });
    }
  }
}

const SIGNED_OUT_DOOR: Record<string, Answer> = {
  "GET /api/view": SIGNED_OUT,
  "GET /api/age": { body: { refused: false } },
  "POST /api/age": { body: { ok: true } },
  "POST /api/guest": { body: { ok: true, account: GUEST } },
  "POST /api/character": { status: 404, body: NO_CHARACTER },
  "GET /api/account": { body: { ok: true, account: GUEST } },
};

async function toTheAge(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Play", exact: true }).click({ timeout: 20_000 });
  await expect(page.getByRole("combobox", { name: "Day" })).toBeVisible();
}

test("[world:field-says-its-state] the age answer refused for no date: the line under the three fields is a problem, each field's edge in the out colour", async ({ page }, info) => {
  await fakeServer(page, { ...SIGNED_OUT_DOOR });
  await toTheAge(page);
  await page.getByRole("button", { name: "Continue" }).click();
  const line = page.locator("[data-age-said]");
  await expect(line).toHaveText("Pick the day, the month and the year.");
  const day = page.getByRole("combobox", { name: "Day" });
  await eachLook(page, info.project.name, "age-empty", day, async () => {
    for (const field of ["Day", "Month", "Year"]) await isProblem(page.getByRole("combobox", { name: field }), line);
  });
});

test("[world:field-says-its-state] the door's character name and its username: Begin with the name empty is a problem under the name's box; a username of the wrong shape and one taken are problems under its box, a free one the tick", async ({ page }, info) => {
  test.setTimeout(240_000);
  const answers: Record<string, Answer> = { ...SIGNED_OUT_DOOR, "GET /api/username/available": { body: { ok: true, free: false } } };
  await fakeServer(page, answers);
  await toTheAge(page);
  await page.getByRole("combobox", { name: "Day" }).selectOption("17");
  await page.getByRole("combobox", { name: "Month" }).selectOption({ label: "May" });
  await page.getByRole("combobox", { name: "Year" }).selectOption("1990");
  await page.getByRole("button", { name: "Continue" }).click();

  // The name left empty: Begin comes back to it, the line under its box.
  const name = page.locator("#door-name");
  await name.waitFor({ state: "visible", timeout: 30_000 });
  await page.getByRole("button", { name: /^Next/ }).first().click({ timeout: 20_000 });
  await page.locator("[data-gate='life']").getByRole("button", { name: /^Next/ }).click();
  await page.getByLabel("Username").fill("ada_lagos");
  await page.getByRole("button", { name: /^Begin/ }).click();
  const needed = page.locator("[data-door-name-needed]");
  await expect(needed).toHaveText("Your story needs a name.");
  await name.blur();
  await eachLook(page, info.project.name, "name-empty", name, () => isProblem(name, needed));

  // The username on the door's page.
  await giveName(page, 20_000);
  await page.getByRole("button", { name: /^Next/ }).first().click({ timeout: 20_000 });
  await page.locator("[data-gate='life']").getByRole("button", { name: /^Next/ }).click();
  const box = page.getByLabel("Username");
  const check = page.locator("[data-username-check]");
  await box.fill("a");
  await expect(check).toHaveText("Use 3 to 20 letters, numbers or _ and nothing else.");
  await expect(page.locator("[data-username-help]")).toBeVisible();
  await eachLook(page, info.project.name, "username-format", box, () => isProblem(box, check));
  await box.fill("ada_lagos");
  await expect(check).toHaveText("Someone has that name. Pick another.");
  await eachLook(page, info.project.name, "username-taken", box, () => isProblem(box, check));
  answers["GET /api/username/available"] = { body: { ok: true, free: true } };
  await box.fill("ada_ikeja");
  await expect(check).toHaveText("That name is free.");
  await eachLook(page, info.project.name, "username-free", box, () => isGood(box, check));
});

test("[world:field-says-its-state] the ways back in: an email of the wrong shape and a wrong code are each a problem directly under their box", async ({ page }, info) => {
  test.setTimeout(240_000);
  await fakeServer(page, {
    ...SIGNED_OUT_DOOR,
    "POST /api/auth/email-otp/send-verification-otp": { body: { success: true } },
    "POST /api/auth/sign-in/email-otp": { status: 400, body: { message: "Invalid OTP", code: "INVALID_OTP" } },
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click({ timeout: 20_000 });
  const email = page.getByLabel("Email");
  await email.fill("ada@example");
  await page.getByRole("button", { name: "Send me a code" }).click();
  const slot = page.locator("[data-code-said='problem']");
  await expect(slot).toHaveText("That email does not look right.");
  await eachLook(page, info.project.name, "email-shape", email, () => isProblem(email, slot));
  await email.fill("ada@example.com");
  await page.getByRole("button", { name: "Send me a code" }).click();
  const code = page.getByLabel("6-digit code");
  await code.fill("111111");
  await expect(slot).toHaveText("That code is not right.");
  await eachLook(page, info.project.name, "code-wrong", code, () => isProblem(code, slot));
});
