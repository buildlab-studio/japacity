// The screen catalog (pnpm catalog; see CHECKLIST.md and docs/contributing/README.md): every screen of the game shot as
// a player sees it, at Pixel 7 size with three device pixels to each, into the catalog folder (where.ts), in the order
// screens.ts gives. Each test is one part of the game reached the way the browser suite reaches it: the front door
// played, a recorded life seeded (packages/sim/src/goldens/lives.data.ts), and the development build's hooks
// (`window.__city`, `__map`, `__sendOff`, `?clock=`). A screen that cannot be reached is written down as not reached,
// with why, and the test goes on. Nothing here asserts how a screen should look: the look is the review's.
import { devices, expect, test, type Page } from "@playwright/test";

import { content } from "../../../../packages/content/src/index";
import { lifeSaves } from "../../../../packages/sim/src/goldens/lives.data";
import { start } from "../../../../packages/sim/src/testing/play";
import { ADMIN_GETS } from "../../src/features/admin/admin.fixtures";
import { passOpeningWords, passThePage } from "../door";
import { backFromResults, bedThing, doAct, intoTheRoom, passCards, passHomeTeach, passMoments, placeReady, seedSave } from "../live";
import { attempt, missed, shot, shotPages } from "./shoot";

/** The second dev server, whose every /api route is answered here. */
const ONLINE = `http://localhost:${process.env.E2E_ONLINE_PORT ?? "5180"}`;
/** The day and the night as the development build pins them (`?clock=`), with the sleep cut short and the morning now. */
const DAY = "?sleep=2&morning=now&clock=afternoon";
const NIGHT = "?sleep=2&morning=now&clock=night";

/** The routes of a browser never signed in and never refused, as start.spec.ts answers them; the rest are not found. */
async function signedOut(page: Page): Promise<void> {
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => {
      const key = `${route.request().method()} ${new URL(route.request().url()).pathname}`;
      const json = (status: number, body: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (key === "GET /api/age") return json(200, { refused: false });
      if (key === "GET /api/view") return json(401, { ok: false, code: "signed-out", detail: "Sign in to play." });
      return json(404, { ok: false, code: "unknown-id", detail: "not faked" });
    },
  );
  await page.routeWebSocket(/\/api\/place\/.+\/socket$/, () => undefined);
  // The bot check as its always-pass test key behaves, drawing nothing.
  await page.route("https://challenges.cloudflare.com/**", (route) => route.fulfill({ contentType: "text/javascript", body: "window.turnstile = { render() { return 'widget-1'; }, reset() {}, remove() {} };" }));
}

/** The start screen's compound, drawn in its own chunk, given its moment to draw. */
async function startScreen(page: Page, search: string): Promise<void> {
  await page.goto(`${ONLINE}/${search}`);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible({ timeout: 30_000 });
  await page.locator("[data-front-scene] canvas").waitFor({ timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
}

test("front: the start screen, the age screen and the ways back in", async ({ page }) => {
  await signedOut(page);
  await attempt(page, "front-start-day", async () => {
    await startScreen(page, "?clock=afternoon");
    await shot(page, "front-start-day");
  });
  await attempt(page, "front-start-night", async () => {
    // The start screen has no world clock of its own: the night's paint is stood in as dedication.spec.ts stands it.
    await startScreen(page, "?clock=night&paint=night");
    await page.evaluate(() => {
      document.documentElement.dataset.paint = "night";
    });
    await shot(page, "front-start-night");
  });
  await attempt(page, "front-age", async () => {
    await startScreen(page, "?clock=afternoon");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("heading", { name: "When were you born?" })).toBeVisible();
    await shot(page, "front-age");
  });
  await attempt(page, "front-returning", async () => {
    await startScreen(page, "?clock=afternoon");
    await page.getByRole("button", { name: "I already have a life here" }).click();
    await expect(page.getByRole("heading", { name: "Sign back in" })).toBeVisible();
    await shot(page, "front-returning");
  });
});

/** The archetypes on the door's second step, by the name on each tile, and the key each picture takes. */
const ARCHETYPES: readonly [string, string][] = [
  ["The developer", "door-life-developer"],
  ["The nurse", "door-life-nurse"],
  ["The accountant", "door-life-accountant"],
  ["The writer", "door-life-writer"],
  ["The trader", "door-life-trader"],
  ["The shop worker", "door-life-shop-worker"],
  ["The child of the water", "door-life-water"],
];

/** The homes on Where you live, by the name on each card. */
const HOMES: readonly [string, string][] = [
  ["Your own room", "door-home-room"],
  ["A hostel room", "door-home-hostel"],
  ["The family house", "door-home-family"],
];

/** A tile of the door picked by its name: the tiles are radios, the older ones buttons. */
async function pick(page: Page, name: string): Promise<void> {
  const radio = page.getByRole("radio", { name, exact: true });
  if ((await radio.count()) > 0) await radio.first().click();
  else await page.getByRole("button", { name, exact: true }).first().click();
}

/** From the door's first step to Where you live, on an archetype. */
async function toWhereYouLive(page: Page, archetype: string): Promise<void> {
  await page.getByRole("button", { name: /^Next/ }).first().click({ timeout: 30_000 });
  await pick(page, archetype);
  await page.locator("[data-gate='life']").getByRole("button", { name: /^Next/ }).click();
  await page.locator("[data-gate='page']").waitFor();
}

/** Begin, and the page as it fills: a picture while the years go by, then the page full with Go. */
async function beginAndThePage(page: Page, filling: string | null, ready: string | null): Promise<void> {
  await page.getByRole("button", { name: /^Begin/ }).click();
  // The years go by in a few seconds: the picture is taken a moment after Begin, while they run.
  if (filling !== null) await shot(page, filling, 700);
  const go = page.locator("[data-page-handover]").getByRole("button", { name: "Go", exact: true });
  await go.waitFor({ timeout: 60_000 });
  if (ready !== null) await shot(page, ready);
}

test("door: the three steps, every path and every home, by day and with the night paint", async ({ page }) => {
  await page.goto(`/${DAY}`);
  await page.getByRole("button", { name: /^Next/ }).first().waitFor({ timeout: 30_000 });
  await attempt(page, "door-you-day", () => shot(page, "door-you-day", 1200));
  await attempt(page, "door-yours-day", async () => {
    await page.getByRole("button", { name: "Make it yours" }).click();
    await page.locator("[data-swatches]").first().scrollIntoViewIfNeeded();
    await shot(page, "door-yours-day");
    await page.keyboard.press("Escape");
    // The panel closes by its own button where Escape is not heard.
    const close = page.getByRole("button", { name: /^(Done|Close)$/ });
    if (await close.first().isVisible().catch(() => false)) await close.first().click();
  });
  await page.getByRole("button", { name: /^Next/ }).first().click();
  await page.locator("[data-gate='life']").waitFor();
  for (const [name, key] of ARCHETYPES) {
    await attempt(page, key, async () => {
      await pick(page, name);
      await shot(page, key);
    });
  }
  await pick(page, "The developer");
  await page.locator("[data-gate='life']").getByRole("button", { name: /^Next/ }).click();
  await page.locator("[data-gate='page']").waitFor();
  for (const [name, key] of HOMES) {
    await attempt(page, key, async () => {
      await pick(page, name);
      await shot(page, key, 900);
    });
  }
  await attempt(page, "door-page-filling", () => beginAndThePage(page, "door-page-filling", "door-page-ready"));

  // The night paint: a fresh door, the same steps.
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/${NIGHT}`);
  await page.getByRole("button", { name: /^Next/ }).first().waitFor({ timeout: 30_000 });
  await attempt(page, "door-you-night", () => shot(page, "door-you-night", 1200));
  await page.getByRole("button", { name: /^Next/ }).first().click();
  await page.locator("[data-gate='life']").waitFor();
  await attempt(page, "door-life-night", () => shot(page, "door-life-night"));
  await page.locator("[data-gate='life']").getByRole("button", { name: /^Next/ }).click();
  await page.locator("[data-gate='page']").waitFor();
  await attempt(page, "door-home-night", () => shot(page, "door-home-night", 900));
  await attempt(page, "door-page-night", () => beginAndThePage(page, null, "door-page-night"));
});

/** The first night of a new life: the bed's card, the sleep running, the first month's results, then back. */
async function firstNight(page: Page): Promise<void> {
  const slept = await attempt(page, "night-teach", async () => {
    await intoTheRoom(page);
    await doAct(page, await bedThing(page), "end-month");
    const card = page.locator("[data-night-teach]");
    await card.waitFor({ timeout: 5000 });
    await shot(page, "night-teach");
    await page.locator("[data-night-teach-ok]").click();
  });
  if (!slept) {
    missed("night-sleeping", "The bed's card did not show.");
    missed("night-results-first", "The bed's card did not show.");
    return;
  }
  await attempt(page, "night-sleeping", () => shot(page, "night-sleeping", 700));
  await attempt(page, "night-results-first", async () => {
    await passMoments(page, 30_000);
    await page.locator("[data-world-sheet='results']").waitFor({ timeout: 10_000 });
    await page.waitForTimeout(800);
    await passCards(page);
    await shotPages(page, "night-results-first", page.locator("[data-world-sheet='results']"), 3);
    await backFromResults(page);
  });
}

/** The homes a life starts in, each from the door: the archetype, the card on Where you live, and the keys. */
const STARTS: readonly { archetype: string; home: string | null; keys: [string, string, string | null] }[] = [
  { archetype: "The developer", home: "The family house", keys: ["home-family-first", "home-family-day", "home-family-night"] },
  { archetype: "The developer", home: "Your own room", keys: ["home-room-first", "home-room-day", "home-room-night"] },
  { archetype: "The developer", home: "A hostel room", keys: ["home-hostel-first", "home-hostel-day", "home-hostel-night"] },
  // The child of the water lives on the water (R-PROLOGUE-012): Where you live offers no other roof.
  { archetype: "The child of the water", home: null, keys: ["home-water-first", "home-water-day", null] },
];

for (const start of STARTS) {
  test(`home: ${start.keys[1]}`, async ({ page }) => {
    const [first, day, night] = start.keys;
    const reached = await attempt(page, first, async () => {
      await page.goto(`/${DAY}`);
      await toWhereYouLive(page, start.archetype);
      if (start.home !== null) await pick(page, start.home);
      await beginAndThePage(page, null, null);
      await passThePage(page);
      await expect(page.locator("[data-band]")).toBeVisible({ timeout: 30_000 });
      await placeReady(page);
      await shot(page, first, 1200);
    });
    if (!reached) {
      missed(day, "The life did not begin from the door.");
      if (night !== null) missed(night, "The life did not begin from the door.");
      return;
    }
    await attempt(page, day, async () => {
      // The first chapter's title stands a moment, then the home's card says what it is once.
      await page.locator("[data-opening-title]").waitFor({ state: "detached", timeout: 8000 }).catch(() => undefined);
      // The first brief's card is passed by its Let's go, then the home's card by its Got it.
      await passCards(page);
      await passHomeTeach(page);
      await passCards(page);
      await shot(page, day, 1500);
    });
    if (start.home === "The family house") await firstNight(page);
    if (night === null) return;
    await attempt(page, night, async () => {
      await page.goto(`/${NIGHT}`);
      await placeReady(page);
      await passCards(page);
      await passHomeTeach(page);
      await shot(page, night, 1500);
    });
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Recorded lives, seeded as the suite seeds them (live.ts seedSave), cut where the screen wanted stands.
// ---------------------------------------------------------------------------------------------------------------------

/** A recorded life's save, its commands cut at `upTo` (all of them when null), as the page keeps it. */
function lifeUpTo(name: string, upTo: number | null): string {
  const save = lifeSaves[name];
  if (save === undefined) throw new Error(`No recorded life ${name}.`);
  return JSON.stringify({ save: { ...save, commands: upTo === null ? save.commands : save.commands.slice(0, upTo) }, clock: { anchor: 0 } });
}

/** Ada's careful life the month before the visa's answer: the turn that grants it is the next command (index 285). */
const ADA_BEFORE_ANSWER = 285;
/** Ada's careful life with the visa granted, the month before she flies: every command but the flight. */
const ADA_GRANTED = (lifeSaves["ada-careful"]?.commands.length ?? 1) - 1;
/** Ada's careful life with the visa interview open: the act that opens it is the command before (index 280). */
const ADA_INTERVIEW = 281;
/** Ada's second life a few months into London on a sponsored job (she lands at command 420). */
const ADA_IN_LONDON = 440;

/** Where the city keeps the place the life stands in, read when the world opens (City.tsx, `lastPlace`). */
const LAST_KEY = "japacity.city.last";

/** Every card over the world passed: the granted card a recorded life owes on its decision day (R-SHARE-001) among them. */
async function clearTheWorld(page: Page): Promise<void> {
  for (let round = 0; round < 3; round += 1) {
    const granted = page.locator("[data-share-card='granted']");
    if (await granted.isVisible().catch(() => false)) {
      await page.getByRole("dialog").getByRole("button", { name: "Close" }).first().click();
      await page.waitForTimeout(300);
    }
    await passCards(page);
    const teach = page.locator("[data-home-teach-ok]");
    if (await teach.isVisible().catch(() => false)) await teach.click();
    await page.waitForTimeout(300);
  }
}

/** A recorded life opened in the world at `search`, past its opening words and every card. */
async function openLife(page: Page, life: string, upTo: number | null, search: string): Promise<void> {
  await seedSave(page, lifeUpTo(life, upTo));
  await page.goto(`/${search}`);
  await expect(page.locator("[data-band]")).toBeVisible({ timeout: 60_000 });
  await passOpeningWords(page);
  await clearTheWorld(page);
  await placeReady(page);
  await clearTheWorld(page);
}

/** The life opened again standing in a place, inside its door when asked, at `search`. */
async function standIn(page: Page, place: string, inside: boolean, search: string): Promise<void> {
  await page.evaluate(([key, id, within]) => localStorage.setItem(key, JSON.stringify(within ? [id, "inside"] : [id])), [LAST_KEY, place, inside] as const);
  await page.goto(`/${search}`);
  await expect(page.locator("[data-band]")).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction((id) => (window as unknown as { __city?: { ready?: boolean; place?: string } }).__city?.place === id && (window as unknown as { __city?: { ready?: boolean } }).__city?.ready === true, place, { timeout: 90_000 });
  await clearTheWorld(page);
}

/** The thing's fan, opened by a tap on its quiet mark, tried a few times from the whole place; true when it stands. */
async function openFan(page: Page, thing: string): Promise<boolean> {
  const fan = page.locator(`[data-fan="${thing}"] [data-fan-act] button, [data-fan-sheet="${thing}"] [data-fan-act] button`).first();
  for (let tries = 0; tries < 3; tries += 1) {
    const whole = page.getByRole("button", { name: "See the whole place" });
    if (await whole.isVisible().catch(() => false)) {
      await whole.click();
      await page.waitForTimeout(700);
    }
    await page.locator(`[data-mark="${thing}"]`).click({ force: true, timeout: 10_000 }).catch(() => undefined);
    if (await fan.waitFor({ state: "visible", timeout: 5000 }).then(() => true, () => false)) return true;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }
  return false;
}

/** Everything over the world closed: sheets by Escape, the phone by its home bar. */
async function closeAll(page: Page): Promise<void> {
  for (let round = 0; round < 3; round += 1) await page.keyboard.press("Escape");
  const bar = page.locator("[data-home-bar]");
  if (await bar.isVisible().catch(() => false)) await bar.click();
  await page.waitForTimeout(400);
}

/** The id of the thing whose quiet mark carries this label, read from the marks drawn. */
async function markNamed(page: Page, label: string): Promise<string> {
  const id = await page.evaluate((name) => {
    const mark = [...document.querySelectorAll<HTMLElement>("[data-mark]")].find((one) => (one.getAttribute("aria-label") ?? one.textContent).trim() === name);
    return mark?.dataset.mark ?? null;
  }, label);
  if (id === null) throw new Error(`No thing labelled ${label} here.`);
  return id;
}

/** An act from a thing's fan, and the sheet it opens. */
async function actFromFan(page: Page, thing: string, act: string): Promise<void> {
  if (!(await openFan(page, thing))) throw new Error(`The fan of ${thing} did not open.`);
  await page.locator(`[data-fan="${thing}"] [data-fan-act="${act}"] button, [data-fan-sheet="${thing}"] [data-fan-act="${act}"] button`).first().click({ timeout: 10_000 });
  // The character walks to the thing first; the act's sheet follows (R-WORLD-021).
  await page.getByRole("dialog").last().waitFor({ state: "visible", timeout: 20_000 });
}

/** A person standing in view tapped until their card opens, as city.spec.ts does. */
async function tapAPerson(page: Page): Promise<void> {
  const size = page.viewportSize() ?? { width: 412, height: 839 };
  const spots = await page.evaluate((box) => {
    const city = (window as unknown as { __city?: { screenOf: (slot: number) => { x: number; y: number } | null } }).__city;
    if (city === undefined) return [];
    return Array.from({ length: 16 }, (_, slot) => city.screenOf(slot)).filter((at): at is { x: number; y: number } => at !== null && at.y > box.height * 0.2 && at.y < box.height * 0.8 && at.x > 20 && at.x < box.width - 20);
  }, size);
  const card = page.locator("[data-card=person]");
  for (const spot of spots) {
    await page.mouse.click(spot.x, spot.y);
    if (await card.waitFor({ state: "visible", timeout: 1500 }).then(() => true, () => false)) return;
  }
  throw new Error("No person in view opened a card.");
}

/** The room's screens at one paint: the room, a fan, an act's sheet and the asks sheet; by day also the rest. */
async function roomAt(page: Page, paint: "day" | "night"): Promise<void> {
  await attempt(page, `room-${paint}`, () => shot(page, `room-${paint}`, 1500));
  if (paint === "day") {
    await attempt(page, "room-band-more", async () => {
      await page.getByRole("button", { name: "Show more" }).click();
      await shot(page, "room-band-more");
      await page.getByRole("button", { name: /^Show (less|fewer)/ }).click({ timeout: 3000 }).catch(() => page.keyboard.press("Escape"));
    });
    await closeAll(page);
  }
  await attempt(page, `room-fan-${paint}`, async () => {
    if (!(await openFan(page, "cooking"))) throw new Error("The cooking corner's fan did not open.");
    await shot(page, `room-fan-${paint}`);
  });
  await closeAll(page);
  await attempt(page, `room-act-${paint}`, async () => {
    await actFromFan(page, "table", "activity.study-english");
    await shot(page, `room-act-${paint}`);
  });
  await closeAll(page);
  if (paint === "day") {
    await attempt(page, "room-said-day", async () => {
      if (!(await openFan(page, "tv"))) throw new Error("The TV's fan did not open.");
      await page.locator('[data-fan="tv"] [data-fan-act="activity.watch-tv"] button').first().click();
      await page.waitForTimeout(2500);
      await shot(page, "room-said-day", 0);
    });
    await closeAll(page);
    await attempt(page, "room-ask-day", async () => {
      await actFromFan(page, "table", "offer.brother-fees");
      await shot(page, "room-ask-day");
    });
    await closeAll(page);
    await attempt(page, "room-person-day", async () => {
      await actFromFan(page, "friend-guest", "talk");
      await shot(page, "room-person-day");
    });
    await closeAll(page);
  }
  await attempt(page, `room-asks-${paint}`, async () => {
    await page.getByRole("button", { name: "Answer the person asking" }).click();
    const asks = page.locator("[data-world-sheet='asks']");
    await asks.waitFor({ timeout: 10_000 });
    await shotPages(page, `room-asks-${paint}`, asks, 3);
  });
  await closeAll(page);
  await attempt(page, `room-datapage-${paint}`, async () => {
    await page.getByRole("button", { name: "Your page" }).first().click();
    const sheet = page.getByRole("dialog").last();
    await sheet.waitFor({ timeout: 10_000 });
    await shotPages(page, `room-datapage-${paint}`, sheet, 3, 900);
  });
  await closeAll(page);
  if (paint === "day") {
    await attempt(page, "room-calendar-day", async () => {
      await page.locator("[data-band-month]").click();
      await page.locator("[data-app-screen='calendar']").waitFor({ timeout: 10_000 });
      await shot(page, "room-calendar-day", 900);
    });
    await closeAll(page);
  }
}

test("room: the family house lived in, its things, an ask and the data page, by day and by night", async ({ page }) => {
  await openLife(page, "ada-careful", ADA_BEFORE_ANSWER, DAY);
  await roomAt(page, "day");
  await page.goto(`/${NIGHT}`);
  await placeReady(page);
  await clearTheWorld(page);
  await roomAt(page, "night");
});

test("room: the visa interview", async ({ page }) => {
  await attempt(page, "room-interview", async () => {
    await openLife(page, "ada-careful", ADA_INTERVIEW, DAY);
    // The interview opens over the world as the asks sheet with the officer's question (R-INTERVIEW-004).
    const asked = page.locator("[data-world-sheet='asks'], [data-setpiece], [data-interview]").first();
    if (!(await asked.isVisible().catch(() => false))) await page.locator("[data-nudge] button").first().click({ timeout: 10_000 });
    await asked.waitFor({ timeout: 15_000 });
    await shotPages(page, "room-interview", asked, 3, 900);
  });
  await attempt(page, "room-interview-question", async () => {
    await page.getByRole("button", { name: "Enter the interview room" }).click();
    await page.waitForTimeout(2500);
    await shot(page, "room-interview-question", 900);
  });
});

/** The drawn places of Lagos, by id, with the door taken where the picture is of the room inside, and their keys. */
const LAGOS_PLACES: readonly { id: string; inside?: boolean; key: string; night: boolean }[] = [
  { id: "place.ojuelegba", key: "place-ojuelegba", night: true },
  { id: "place.ojuelegba", inside: true, key: "place-hub-room", night: false },
  { id: "place.yaba", key: "place-yaba", night: true },
  { id: "place.yaba-hub", key: "place-inverter-room", night: true },
  { id: "place.bode-thomas", key: "place-bode-thomas", night: true },
  { id: "place.tejuosho-market", key: "place-tejuosho", night: true },
  { id: "place.computer-village", key: "place-computer-village", night: true },
  { id: "place.national-stadium", key: "place-stadium", night: true },
  { id: "place.third-mainland-bridge", key: "place-bridge", night: true },
  { id: "place.makoko", key: "place-makoko", night: true },
  { id: "place.airport-lagos", key: "place-airport", night: true },
  { id: "place.visa-centre", key: "place-visa-centre", night: true },
  // The passport office is drawn from the visa centre's file (content's `assets`), so by day alone.
  { id: "place.passport-office", key: "place-passport-office", night: false },
  { id: "place.english-test-centre", key: "place-english-test", night: true },
  { id: "place.tb-clinic", key: "place-clinic", night: true },
  { id: "place.olokun-office", key: "place-olokun", night: true },
  { id: "place.agent-office", key: "place-agent-office", night: true },
  { id: "place.their-room", key: "place-their-room", night: false },
];

/** Each place stood in by day and, where asked, by night. */
async function shootPlaces(page: Page, places: readonly { id: string; inside?: boolean; key: string; night: boolean }[]): Promise<void> {
  for (const place of places) {
    await attempt(page, `${place.key}-day`, async () => {
      await standIn(page, place.id, place.inside === true, DAY);
      await shot(page, `${place.key}-day`, 1500);
    });
    if (!place.night) continue;
    await attempt(page, `${place.key}-night`, async () => {
      await standIn(page, place.id, place.inside === true, NIGHT);
      await shot(page, `${place.key}-night`, 1500);
    });
  }
}

test("places: Lagos, the first half", async ({ page }) => {
  await openLife(page, "ada-careful", ADA_GRANTED, DAY);
  await shootPlaces(page, LAGOS_PLACES.slice(0, 9));
});

test("places: Lagos, the second half", async ({ page }) => {
  await openLife(page, "ada-careful", ADA_GRANTED, DAY);
  await shootPlaces(page, LAGOS_PLACES.slice(9));
});

test("places: abroad", async ({ page }) => {
  await openLife(page, "ada-abroad", ADA_IN_LONDON, DAY);
  await shootPlaces(page, [
    { id: "place.the-room", key: "place-the-room", night: true },
    { id: "place.peckham", key: "place-peckham", night: true },
  ]);
  missed("place-deira-day", "Every recorded life that flies goes to the UK; no life stands in the UAE, so Deira is never open to one.");
});

test("street: a thing's fan and sheet, the paper slip and a person, at Bode Thomas", async ({ page }) => {
  await openLife(page, "ada-careful", ADA_BEFORE_ANSWER, DAY);
  await standIn(page, "place.bode-thomas", false, DAY);
  await attempt(page, "street-fan", async () => {
    const barber = await markNamed(page, "Barber");
    if (!(await openFan(page, barber))) throw new Error("The barber's fan did not open.");
    await shot(page, "street-fan");
  });
  await attempt(page, "street-act", async () => {
    await page.locator("[data-fan-act] button").first().click({ timeout: 10_000 });
    await page.getByRole("dialog").last().waitFor({ state: "visible", timeout: 20_000 });
    await shot(page, "street-act");
  });
  await closeAll(page);
  await attempt(page, "street-slip", async () => {
    const kiosk = await markNamed(page, "Lotto");
    if (!(await openFan(page, kiosk))) throw new Error("The kiosk's fan did not open.");
    await page.locator("[data-fan-act] button").first().click({ timeout: 10_000 });
    const sheet = page.getByRole("dialog").last();
    await sheet.waitFor({ state: "visible", timeout: 20_000 });
    // The ticket bought: the slip stays in the hand with the answer on it.
    const buy = sheet.getByRole("button").filter({ hasText: /₦|Buy|ticket/i }).first();
    if (await buy.isVisible().catch(() => false)) await buy.click();
    await page.waitForTimeout(1500);
    await shot(page, "street-slip");
  });
  await closeAll(page);
  await attempt(page, "street-person", async () => {
    await tapAPerson(page);
    await shot(page, "street-person");
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The map and the ride.
// ---------------------------------------------------------------------------------------------------------------------

/** The map from its thumb, drawn: folded on the player's card (R-WORLD-015). */
async function mapReady(page: Page): Promise<void> {
  await page.locator('[data-thumb="map"]').click();
  await page.waitForFunction(() => (window as unknown as { __map?: { ready?: boolean } }).__map?.ready === true, null, { timeout: 60_000 });
}

/** The map put away, from whichever state it stands in. */
async function closeMap(page: Page): Promise<void> {
  if ((await page.locator("[data-map]").count()) === 0) return;
  await page.keyboard.press("Escape");
  // The open map's paper never holds still for the stability check, so the button is pressed as the page's own click.
  await page.evaluate(() => {
    const close = [...document.querySelectorAll<HTMLButtonElement>("[data-map-close]")].find((button) => button.getBoundingClientRect().width > 0);
    close?.click();
  });
  await page.locator("[data-map]").waitFor({ state: "detached", timeout: 5000 }).catch(() => undefined);
}

/** A stop picked by the stops list beside the painted map, as rideTo in live.ts picks it, and its ride sheet. */
async function pickStop(page: Page, stop: string): Promise<void> {
  await page.evaluate((id) => document.querySelector<HTMLButtonElement>(`[data-stop="${id}"]`)?.click(), stop);
  await page.locator(`[data-ride-sheet="${stop}"]`).waitFor({ timeout: 10_000 });
}

/** The map's screens at one paint: folded, a stop's ride sheet, the whole map open; by day the country menu. */
async function mapAt(page: Page, paint: "day" | "night"): Promise<void> {
  await attempt(page, `map-folded-${paint}`, async () => {
    await mapReady(page);
    await shot(page, `map-folded-${paint}`, 1200);
  });
  await attempt(page, `map-ride-sheet-${paint}`, async () => {
    await pickStop(page, "place.bode-thomas");
    await shot(page, `map-ride-sheet-${paint}`);
  });
  await attempt(page, `map-open-${paint}`, async () => {
    await page.keyboard.press("Escape");
    await page.locator("[data-strip]").click();
    await page.waitForFunction(() => (window as unknown as { __map?: { phase?: string } }).__map?.phase === "open", null, { timeout: 30_000 });
    await shot(page, `map-open-${paint}`, 1500);
  });
  if (paint === "day") {
    await attempt(page, "map-countries", async () => {
      await page.locator("[data-country-menu] > button").click();
      await shot(page, "map-countries");
      await page.keyboard.press("Escape");
    });
  }
  await closeMap(page);
}

test("map: folded, open, the ride sheet and the country menu, by day and by night, and a danfo ride", async ({ page }) => {
  await openLife(page, "ada-careful", ADA_GRANTED, DAY);
  await mapAt(page, "day");
  // The ride: the danfo picked on the sheet, each of its four angles shot as it comes (R-WORLD-032).
  const angles = ["outside", "above", "window", "seat"];
  const rode = await attempt(page, "ride-outside", async () => {
    await mapReady(page);
    await pickStop(page, "place.bode-thomas");
    await page.locator('[data-way="danfo"]').click();
    await page.locator("[data-ride-main]").click();
    await page.locator("[data-ride]").waitFor({ timeout: 20_000 });
    const seen = new Set<string>();
    for (let poll = 0; poll < 300 && seen.size < angles.length; poll += 1) {
      const angle = await page.evaluate(() => document.querySelector<HTMLElement>("[data-ride]")?.dataset.rideAngle ?? null);
      if (angle === null && seen.size > 0) break;
      if (angle !== null && !seen.has(angle) && angles.includes(angle)) {
        seen.add(angle);
        // The first angle fades in from the map; the later ones cut.
        await shot(page, `ride-${angle}`, angle === "outside" ? 900 : 350);
      }
      await page.waitForTimeout(80);
    }
    if (!seen.has("outside")) throw new Error("The ride's first angle was not seen.");
    for (const angle of angles.slice(1)) if (!seen.has(angle)) missed(`ride-${angle}`, "The ride moved past this angle before the picture could be taken.");
  });
  if (!rode) for (const angle of angles.slice(1)) missed(`ride-${angle}`, "The ride did not start.");
  await page.waitForFunction(() => (window as unknown as { __city?: { ready?: boolean; place?: string } }).__city?.place === "place.bode-thomas", null, { timeout: 90_000 }).catch(() => undefined);
  await page.goto(`/${NIGHT}`);
  await placeReady(page);
  await clearTheWorld(page);
  await mapAt(page, "night");
});

// ---------------------------------------------------------------------------------------------------------------------
// The phone.
// ---------------------------------------------------------------------------------------------------------------------

/** The phone's apps, in the order its home lays them out. */
const APPS = ["calendar", "bank", "chats", "japa", "papers", "jobs", "market", "lotto", "bills", "news", "settings"] as const;

/** The phone from its thumb, on its home. */
async function openPhone(page: Page): Promise<void> {
  if ((await page.locator("[data-phone]").count()) === 0) await page.locator('[data-thumb="phone"]').click();
  const back = page.locator("[data-phone-back]");
  if (await back.isVisible().catch(() => false)) await back.click();
  await page.locator("[data-phone-home]").waitFor({ timeout: 10_000 });
}

/** An app opened from the phone's home; its screen. */
async function app(page: Page, id: string) {
  await openPhone(page);
  await page.locator(`[data-app="${id}"]`).click();
  const screen = page.locator(`[data-app-screen="${id}"]`);
  await screen.waitFor({ timeout: 10_000 });
  return screen;
}

/** The phone's screens at one paint: its home and every app, each paged down; by day the Bank's choosers and a chat. */
async function phoneAt(page: Page, paint: "day" | "night"): Promise<void> {
  await attempt(page, `phone-home-${paint}`, async () => {
    await openPhone(page);
    await shot(page, `phone-home-${paint}`, 900);
  });
  if (paint === "day") {
    await attempt(page, "phone-big-day", async () => {
      await page.getByRole("button", { name: "Make the phone bigger" }).click();
      await shot(page, "phone-big-day", 900);
      await page.getByRole("button", { name: /Make the phone smaller|smaller/ }).first().click({ timeout: 3000 }).catch(() => undefined);
    });
  }
  for (const id of APPS) {
    await attempt(page, `phone-${id}-${paint}`, async () => {
      const screen = await app(page, id);
      await shotPages(page, `phone-${id}-${paint}`, screen, paint === "day" ? 5 : 2);
    });
    if (id === "bank" && paint === "day") {
      for (const [act, name] of [["change", "Change money"], ["move", "Move money"]] as const) {
        await attempt(page, `phone-bank-${act}-day`, async () => {
          const button = page.locator("[data-app-screen='bank'], [data-phone]").getByRole("button", { name, exact: true }).last();
          await button.click();
          await page.locator(`[data-chooser="${act}"]`).scrollIntoViewIfNeeded().catch(() => undefined);
          await shot(page, `phone-bank-${act}-day`);
          await button.click({ timeout: 3000 }).catch(() => undefined);
        });
      }
    }
    if (id === "chats") {
      await attempt(page, `phone-chat-${paint}`, async () => {
        await page.locator("[data-app-screen='chats'] button").filter({ hasText: "Family Group" }).first().click();
        await page.waitForTimeout(500);
        await shotPages(page, `phone-chat-${paint}`, page.locator("[data-phone-screen]"), 2);
        await page.locator("[data-phone-back]").click();
      });
      if (paint === "day") {
        await attempt(page, "phone-people-day", async () => {
          await app(page, "chats");
          await page.locator("[data-app-screen='chats'] button").filter({ hasText: /^People/ }).first().click();
          await page.waitForTimeout(500);
          await shotPages(page, "phone-people-day", page.locator("[data-phone-screen]"), 3);
          await page.locator("[data-phone-back]").click();
        });
      }
    }
  }
  await closeAll(page);
}

test("phone: its home and every app, by day and by night", async ({ page }) => {
  await openLife(page, "ada-careful", ADA_BEFORE_ANSWER, DAY);
  await phoneAt(page, "day");
  missed("phone-me", "The phone has no Me app: the player's own page is the data page, opened from the band's name (room-datapage).");
  await page.goto(`/${NIGHT}`);
  await placeReady(page);
  await clearTheWorld(page);
  await phoneAt(page, "night");
});

// ---------------------------------------------------------------------------------------------------------------------
// A month turned: the moment, the results, the share card, the morning.
// ---------------------------------------------------------------------------------------------------------------------

/** The bed's Sleep from wherever the life stands in its home; the first night's card passed if it comes. */
async function sleepNow(page: Page): Promise<void> {
  await clearTheWorld(page);
  await intoTheRoom(page);
  await doAct(page, await bedThing(page), "end-month");
  const firstNight = page.locator("[data-night-teach-ok]");
  if (await firstNight.waitFor({ state: "visible", timeout: 1500 }).then(() => true, () => false)) await firstNight.click();
}

/** Until the results stand alone: each moment card shot once under `moment` (when given) and passed. */
async function toResults(page: Page, moment: string | null): Promise<void> {
  const results = page.locator("[data-world-sheet='results']");
  let shotOne = moment === null;
  for (let wait = 0; wait < 120; wait += 1) {
    const card = page.locator("[data-moment-screen], [data-brief-close-go], [data-brief-go]").first();
    if (await card.isVisible().catch(() => false)) {
      if (!shotOne && moment !== null) {
        await shot(page, moment, 700);
        shotOne = true;
      }
      await passCards(page);
      continue;
    }
    if ((await results.isVisible().catch(() => false)) && wait > 6) return;
    await page.waitForTimeout(250);
  }
  await results.waitFor({ timeout: 5000 });
}

/** Back from the results to the place, past what comes over them. */
async function leaveResults(page: Page): Promise<void> {
  const back = page.locator("[data-results-back]");
  for (let tries = 0; tries < 8 && (await back.count()) > 0; tries += 1) {
    await passCards(page);
    await back.click({ timeout: 3000 }).catch(() => undefined);
    await page.waitForTimeout(500);
  }
}

test("month: the visa's answer, its moment, the results, the share card and the morning", async ({ page }) => {
  await openLife(page, "ada-careful", ADA_BEFORE_ANSWER, DAY);
  const slept = await attempt(page, "month-moment", async () => {
    await sleepNow(page);
    await toResults(page, "month-moment");
  });
  if (!slept) {
    for (const key of ["month-results", "month-share-granted", "month-morning"]) missed(key, "The month did not turn.");
    return;
  }
  await attempt(page, "month-results", () => shotPages(page, "month-results", page.locator("[data-world-sheet='results']"), 4, 900));
  await leaveResults(page);
  await attempt(page, "month-share-granted", async () => {
    const card = page.locator("[data-share-card='granted']");
    await card.waitFor({ timeout: 20_000 });
    await shotPages(page, "month-share-granted", page.getByRole("dialog").last(), 2, 900);
    await page.getByRole("button", { name: "Close", exact: true }).last().click();
  });
  await attempt(page, "month-chapter-close", async () => {
    const card = page.locator("[data-brief-close-go]").first();
    await card.waitFor({ timeout: 8000 });
    await shot(page, "month-chapter-close", 900);
    await card.click();
  });
});

/** Ada's careful life the month her English test's band comes: the turn that brings it is the next command (index 222). */
const ADA_BEFORE_BAND = 222;

test("month: the morning's envelope on the phone's lock screen", async ({ page }) => {
  await attempt(page, "month-morning", async () => {
    // The result sealed until the morning (R-CLOCK-032): the month slept with the morning switch off, then on.
    await openLife(page, "ada-careful", ADA_BEFORE_BAND, "?sleep=2&morning=off&clock=afternoon");
    await sleepNow(page);
    await toResults(page, null);
    await leaveResults(page);
    await page.goto(`/${DAY}`);
    await placeReady(page);
    await clearTheWorld(page);
    await openPhone(page);
    await page.locator("[data-morning]").waitFor({ timeout: 15_000 });
    await shot(page, "month-morning", 900);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Abroad: the map as a list, the phone and its money, a month's results, and the status clock once the job is quit.
// ---------------------------------------------------------------------------------------------------------------------

test("abroad: the map's list, the phone, the Bank's Send money, a month, and the status clock", async ({ page }) => {
  await openLife(page, "ada-abroad", ADA_IN_LONDON, DAY);
  await attempt(page, "map-abroad", async () => {
    // Abroad the map is a list, with no painted map to wait for.
    await page.locator('[data-thumb="map"]').click();
    await page.locator("[data-map] [data-stop]").first().waitFor({ timeout: 30_000 });
    await shot(page, "map-abroad", 900);
    await closeMap(page);
  });
  await attempt(page, "abroad-phone-home", async () => {
    await openPhone(page);
    await shot(page, "abroad-phone-home", 900);
  });
  await attempt(page, "abroad-bank", async () => {
    const screen = await app(page, "bank");
    await shotPages(page, "abroad-bank", screen, 4);
  });
  await attempt(page, "abroad-bank-send", async () => {
    await page.locator('[data-bank-act="send"]').click();
    await page.locator('[data-chooser="send"]').scrollIntoViewIfNeeded();
    await shot(page, "abroad-bank-send");
  });
  await attempt(page, "abroad-jobs", async () => {
    const screen = await app(page, "jobs");
    await shotPages(page, "abroad-jobs", screen, 3);
  });
  await closeAll(page);
  await attempt(page, "abroad-results", async () => {
    await sleepNow(page);
    await toResults(page, null);
    await shotPages(page, "abroad-results", page.locator("[data-world-sheet='results']"), 3, 900);
    await leaveResults(page);
  });
  // The job quit in Jobs: on a sponsored visa the status clock starts (R-STATUS-003) and stands on the phone.
  const quit = await attempt(page, "warning-clock-home", async () => {
    await clearTheWorld(page);
    const screen = await app(page, "jobs");
    await screen.getByRole("button", { name: "Quit" }).first().click();
    const confirm = page.getByRole("dialog").last().getByRole("button", { name: /Quit|Yes|Leave/ });
    if (await confirm.first().isVisible().catch(() => false)) await confirm.first().click();
    await page.waitForTimeout(800);
    await openPhone(page);
    await page.locator("[data-clock]").first().waitFor({ timeout: 10_000 });
    await shot(page, "warning-clock-home", 900);
  });
  if (quit) {
    await attempt(page, "warning-clock-app", async () => {
      await app(page, "bank");
      await shot(page, "warning-clock-app", 900);
    });
  } else missed("warning-clock-app", "The job could not be quit, so no clock ran.");
  missed("warning-run-down", "No recorded life is ever run down: wellbeing stays far above the line in all six (R-HEALTH-001), and a played month mends it faster than work wears it.");
});

// ---------------------------------------------------------------------------------------------------------------------
// The send-off: Ada's own flight through the six beats, the landing, then the other three landings through the hook.
// ---------------------------------------------------------------------------------------------------------------------

/** The send-off's store, as the development build hangs it on the window (City.tsx). */
type SendOffHook = { getState: () => { open: (flight: { route: string; country: string }) => void; to: (beat: string) => void; close: () => void } };

/** The other landings, each through the hook, over the landed life. Italy's route is the road's (no flight goes there). */
const LANDINGS: readonly { route: string; country: string; name: string }[] = [
  { route: "route.canada-points", country: "country.canada", name: "calgary" },
  { route: "route.gulf-contract", country: "country.uae", name: "dubai" },
  { route: "route.road", country: "country.italy", name: "naples" },
];

test("send-off: the six beats of Ada's flight, the landing abroad, the other landings, and the card kept", async ({ page }) => {
  await openLife(page, "ada-careful", ADA_GRANTED, DAY);
  const scene = page.locator("[data-send-off]");
  const opened = await attempt(page, "sendoff-departures", async () => {
    await mapReady(page);
    await pickStop(page, "place.airport-lagos");
    await page.locator('[data-ride-sheet="place.airport-lagos"] [data-ride-main]').click();
    await page.waitForFunction(() => {
      const city = (window as unknown as { __city?: { ready?: boolean; place?: string } }).__city;
      return city?.place === "place.airport-lagos" && city.ready === true;
    }, null, { timeout: 120_000 });
    await clearTheWorld(page);
    await doAct(page, "gate", "depart");
    await expect(scene).toHaveAttribute("data-send-off", "departures", { timeout: 20_000 });
    await shot(page, "sendoff-departures", 1200);
  });
  if (opened) {
    await attempt(page, "sendoff-departures-step", async () => {
      await scene.locator("[data-so-go='step']").click();
      await shot(page, "sendoff-departures-step", 900);
    });
    await attempt(page, "sendoff-departures-front", async () => {
      await scene.locator("[data-so-go='step']").click();
      await scene.locator("[data-so-go='step']").click();
      await shot(page, "sendoff-departures-front", 600);
    });
    await attempt(page, "sendoff-counter", async () => {
      await expect(scene).toHaveAttribute("data-send-off", "counter", { timeout: 6000 });
      await shot(page, "sendoff-counter", 900);
    });
    await attempt(page, "sendoff-gate", async () => {
      await scene.locator("[data-so-go='take']").click({ timeout: 10_000 });
      await expect(scene).toHaveAttribute("data-send-off", "gate");
      await shot(page, "sendoff-gate", 900);
    });
    await attempt(page, "sendoff-plane", async () => {
      await scene.locator("[data-so-go='board']").click();
      await expect(scene).toHaveAttribute("data-send-off", "plane");
      await shot(page, "sendoff-plane", 1200);
    });
    await attempt(page, "sendoff-landing-london", async () => {
      await expect(scene).toHaveAttribute("data-send-off", "landing", { timeout: 10_000 });
      await shot(page, "sendoff-landing-london", 1500);
    });
    await attempt(page, "sendoff-ride-london", async () => {
      await scene.locator("[data-so-go='ride']").click({ timeout: 30_000 });
      await expect(scene).toHaveAttribute("data-send-off", "ride");
      await shot(page, "sendoff-ride-london", 2500);
    });
    await attempt(page, "sendoff-arrived", async () => {
      await scene.locator("[data-so-go='ring']").click();
      await expect(scene).toHaveCount(0);
      await placeReady(page);
      await shot(page, "sendoff-arrived", 1500);
      await clearTheWorld(page);
    });
  } else {
    for (const key of ["sendoff-departures-step", "sendoff-departures-front", "sendoff-counter", "sendoff-gate", "sendoff-plane", "sendoff-landing-london", "sendoff-ride-london", "sendoff-arrived"]) missed(key, "The send-off did not open at the airport's gate.");
  }
  // The other landings, through the development hook, over the landed life (or over Lagos when the flight failed).
  for (const landing of LANDINGS) {
    await attempt(page, `sendoff-landing-${landing.name}`, async () => {
      await page.evaluate((flight) => {
        const hook = (window as unknown as { __sendOff?: SendOffHook }).__sendOff;
        if (hook === undefined) throw new Error("The send-off hook is not on the window.");
        hook.getState().open(flight);
        hook.getState().to("landing");
      }, { route: landing.route, country: landing.country });
      await expect(scene).toHaveAttribute("data-send-off", "landing", { timeout: 10_000 });
      await shot(page, `sendoff-landing-${landing.name}`, 2000);
    });
    await attempt(page, `sendoff-ride-${landing.name}`, async () => {
      await page.evaluate(() => (window as unknown as { __sendOff?: SendOffHook }).__sendOff?.getState().to("ride"));
      await expect(scene).toHaveAttribute("data-send-off", "ride", { timeout: 10_000 });
      await shot(page, `sendoff-ride-${landing.name}`, 2500);
    });
    await page.evaluate(() => (window as unknown as { __sendOff?: SendOffHook }).__sendOff?.getState().close());
    await page.waitForTimeout(400);
  }
  await clearTheWorld(page);
  await attempt(page, "sendoff-keepsake", async () => {
    await openPhone(page);
    await page.locator("[data-keepsake]").waitFor({ timeout: 10_000 });
    await shot(page, "sendoff-keepsake", 900);
  });
  await attempt(page, "sendoff-card", async () => {
    await page.locator("[data-keepsake-open]").click();
    await page.locator("[data-share-card='send-off']").waitFor({ timeout: 10_000 });
    await shotPages(page, "sendoff-card", page.getByRole("dialog").last(), 2, 900);
  });
  await attempt(page, "sendoff-stub", async () => {
    await page.getByRole("dialog").last().locator("[data-pick='stub']").click();
    await shotPages(page, "sendoff-stub", page.getByRole("dialog").last(), 2, 900);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The dedication: the canoe and its page offline, the page online over a faked server, and the admin's lights list.
// ---------------------------------------------------------------------------------------------------------------------

/** The map unfolded whole: the open map of Lagos, the canoe on its water. */
async function openTheWholeMap(page: Page): Promise<void> {
  await mapReady(page);
  await page.locator("[data-strip]").click();
  await page.waitForFunction(() => (window as unknown as { __map?: { phase?: string } }).__map?.phase === "open", null, { timeout: 30_000 });
  await page.waitForTimeout(600);
}

test("dedication: the canoe by day and night, the page offline, and Settings' five taps", async ({ page }) => {
  await openLife(page, "ada-careful", ADA_GRANTED, DAY);
  const canoe = page.getByRole("button", { name: "A canoe with a lantern" });
  await attempt(page, "dedication-canoe-day", async () => {
    await openTheWholeMap(page);
    await canoe.waitFor({ timeout: 10_000 });
    await shot(page, "dedication-canoe-day");
  });
  await attempt(page, "dedication-canoe-night", async () => {
    await page.evaluate(() => {
      document.documentElement.dataset.paint = "night";
    });
    await page.locator("[data-canoe-glow='night']").waitFor({ timeout: 5000 });
    await shot(page, "dedication-canoe-night");
    await page.evaluate(() => {
      document.documentElement.dataset.paint = "day";
    });
  });
  await attempt(page, "dedication-offline", async () => {
    await canoe.click();
    const sheet = page.getByRole("dialog", { name: "Dedication" });
    await sheet.waitFor({ timeout: 10_000 });
    await shotPages(page, "dedication-offline", sheet, 3, 900);
    await sheet.getByRole("button", { name: "Close" }).click();
  });
  await closeMap(page);
  await attempt(page, "dedication-settings", async () => {
    const settings = await app(page, "settings");
    const version = settings.locator("[data-version] button");
    await version.scrollIntoViewIfNeeded();
    for (let tap = 0; tap < 5; tap += 1) await version.click();
    await page.getByRole("dialog", { name: "Dedication" }).waitFor({ timeout: 10_000 });
    await shot(page, "dedication-settings", 900);
  });
});

/** The lights on the water as the design's picture has them: lit by others, a few named and looked over. */
function water(): { account: string; id: string; name: string; approved: boolean; litAt: number; from: number | null; to: number | null }[] {
  const named = ["Baba Segun", "Grandma", "Aunty Ronke", "Chidi", "Iya Bisi", "Uncle T"];
  return Array.from({ length: 305 }, (_, at) => ({ account: `account.other-${String(at)}`, id: `light.o${String(at)}`, name: named[at] ?? `Someone ${String(at)}`, approved: at < named.length, litAt: 1000 + at, from: null, to: null }));
}

test("dedication: the page online over a faked server, a light named and lit, and the admin's lights list", async ({ page, browser }) => {
  const kept = water();
  const account = "account.ada";
  const game = start({ scenario: "scenario.tunde", content });
  game.grant(1);
  game.endTurn([]);
  game.grant(1);
  const clock = { tick: 3, nextTickAt: Date.now() + 3_600_000, nextTurnAt: null };
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => {
      const request = route.request();
      const key = `${request.method()} ${new URL(request.url()).pathname}`;
      const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (key === "GET /api/view") return json({ ok: true, view: game.view(), lines: [], clock });
      if (key === "GET /api/moderation/standing") return json({ ok: true, standing: { actions: [], mutedUntil: null, suspendedUntil: null, banned: false, reports: [] } });
      if (key === "GET /api/dedication/lights") {
        const ordered = [...kept].sort((a, b) => Number(b.approved) - Number(a.approved) || b.litAt - a.litAt);
        const own = kept.find((light) => light.account === account);
        return json({ ok: true, count: kept.length, lights: ordered.slice(0, 240).map((light) => (light.approved ? { id: light.id, name: light.name } : { id: light.id })), ...(own === undefined ? {} : { mine: { id: own.id, name: own.name, years: { from: own.from, to: own.to }, approved: own.approved } }) });
      }
      if (key === "PUT /api/dedication/light") {
        const body = request.postDataJSON() as { name: string; from?: number; to?: number };
        const light = { account, id: `light.${account}`, name: body.name, from: body.from ?? null, to: body.to ?? null, litAt: Date.now(), approved: false };
        kept.push(light);
        return json({ ok: true, mine: { id: light.id, name: light.name, years: { from: light.from, to: light.to }, approved: false } });
      }
      return json({ ok: false, code: "unknown-id", detail: "not faked" }, 404);
    },
  );
  await page.routeWebSocket(/\/api\/place\/.+\/socket$/, () => undefined);
  await page.addInitScript(() => localStorage.setItem("japacity.walkthrough", "1"));
  const sheet = page.getByRole("dialog", { name: "Dedication" });
  await attempt(page, "dedication-water", async () => {
    await page.goto(`${ONLINE}/${DAY}`);
    await expect(page.locator("[data-band]")).toBeVisible({ timeout: 60_000 });
    await passOpeningWords(page);
    await placeReady(page);
    await clearTheWorld(page);
    await openTheWholeMap(page);
    await page.getByRole("button", { name: "A canoe with a lantern" }).click();
    await sheet.locator("[data-dedication-count]").waitFor({ timeout: 15_000 });
    await page.waitForTimeout(600);
    await shotPages(page, "dedication-water", sheet, 3, 600);
  });
  await attempt(page, "dedication-name-it", async () => {
    await sheet.getByRole("button", { name: "Light one for yours" }).click();
    await sheet.getByRole("textbox", { name: "Who is it for?" }).fill("Mama Nkechi");
    await sheet.getByRole("textbox", { name: "First year" }).fill("1951");
    await sheet.getByRole("textbox", { name: "Last year" }).fill("2024");
    await shot(page, "dedication-name-it");
  });
  await attempt(page, "dedication-lit", async () => {
    await sheet.getByRole("button", { name: "Light it" }).click();
    await sheet.locator("[data-own-light]").waitFor({ timeout: 10_000 });
    await shotPages(page, "dedication-lit", sheet, 3, 600);
  });

  // The admin's page, signed in as an admin, its own fixtures and the lights awaiting a look.
  await attempt(page, "dedication-admin-lights", async () => {
    const admin = await (await browser.newContext({ ...devices["Pixel 7"], deviceScaleFactor: Number(process.env.CATALOG_SCALE ?? "3") })).newPage();
    await admin.route(
      (url) => url.pathname.startsWith("/api/"),
      (route) => {
        const path = new URL(route.request().url()).pathname;
        const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
        if (path === "/api/admin/dedication/pending") {
          const waiting = kept.filter((light) => !light.approved && !light.account.startsWith("account.other-"));
          return json({ ok: true, lights: waiting.map((light) => ({ account: light.account, id: light.id, name: light.name, years: { from: light.from, to: light.to }, username: light.account.replace("account.", ""), region: "NG", litAt: light.litAt })) });
        }
        const answer = ADMIN_GETS[path];
        return answer === undefined ? json({ ok: false }, 404) : json(answer);
      },
    );
    await admin.goto(`${ONLINE}/admin`);
    await expect(admin.getByRole("heading", { name: "Admin", level: 1 })).toBeVisible({ timeout: 30_000 });
    await admin.getByRole("tab", { name: "Moderation" }).click();
    const list = admin.getByRole("list", { name: "Lights awaiting a look" });
    await list.waitFor({ timeout: 10_000 });
    await list.scrollIntoViewIfNeeded();
    await shot(admin, "dedication-admin-lights", 900);
    await admin.context().close();
  });
});
