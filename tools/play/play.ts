// pnpm play --out <folder> [--life developer] [--months 3]
// Plays the game on a phone-sized browser from the front door: the name it fills, an archetype's tile (or a
// ready life), the page and Begin, the page filling as the years go by and Go opening the world, the
// first chapter's title, then each month: the nudge followed, the month ended, the results read. Last it opens every app on the phone. It takes a
// picture at each step into the folder given and prints a plain log, also saved there as play.log.
// It changes nothing in the repository. See tools/play/README.md.
import { type ChildProcess, spawn } from "node:child_process";
import { appendFileSync, createWriteStream, mkdirSync, writeFileSync } from "node:fs";
import { request } from "node:https";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { text } from "@japacity/content";
import { type Browser, chromium, type Locator, type Page } from "@playwright/test";

import { doorButton, livesFrom, localCertificate, parseOptions, type PlayOptions, shotName, USAGE } from "./options";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
/** A mid-range phone, the size the game is built for (docs/design/03-feasibility-and-plan.md, "Screens") and the browser tests use. */
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
/** WebGL on the software renderer, so the place draws on a machine with no graphics card. */
const CHROMIUM_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const SHORT = 5_000;
const LONG = 30_000;

interface Run {
  readonly page: Page;
  readonly options: PlayOptions;
  readonly started: number;
  shots: number;
  monthsEnded: number;
  readonly problems: string[];
}

function oneLine(words: string, max = 200): string {
  const line = words.replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 3)}...` : line;
}

function log(run: Pick<Run, "started" | "options">, message: string): void {
  const seconds = Math.floor((Date.now() - run.started) / 1000);
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const line = `[${clock}] ${message}`;
  console.log(line);
  appendFileSync(join(run.options.out, "play.log"), `${line}\n`);
}

function problem(run: Run, message: string): void {
  run.problems.push(message);
  log(run, `PROBLEM ${message}`);
}

async function shown(locator: Locator): Promise<boolean> {
  return locator
    .first()
    .isVisible()
    .catch(() => false);
}

async function words(locator: Locator, max = 200): Promise<string> {
  return oneLine(await locator.first().innerText({ timeout: SHORT }).catch(() => ""), max);
}

async function appear(locator: Locator, timeout: number): Promise<boolean> {
  return locator
    .first()
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);
}

async function shot(run: Run, label: string): Promise<void> {
  run.shots += 1;
  const name = shotName(run.shots, label);
  // Every motion of the interface is under half a second (R-WORLD-023); a picture waits that out.
  await run.page.waitForTimeout(500);
  await run.page
    .screenshot({ path: join(run.options.out, name), timeout: LONG })
    .then(() => log(run, `picture ${name}`))
    .catch((error: unknown) => problem(run, `picture ${name} failed: ${oneLine(String(error), 120)}`));
}

async function tap(run: Run, locator: Locator, what: string, timeout = SHORT): Promise<boolean> {
  try {
    await locator.first().click({ timeout });
    return true;
  } catch (error) {
    problem(run, `could not tap ${what}: ${oneLine(String(error), 160)}`);
    return false;
  }
}

/** The place is drawn when the scene says so; a slow software renderer is waited on, never required. */
async function placeDrawn(run: Run): Promise<void> {
  const drawn = await run.page
    .waitForFunction("globalThis.__city?.ready === true", null, { timeout: 60_000 })
    .then(() => true)
    .catch(() => false);
  if (!drawn) log(run, "the place had not drawn after a minute; going on");
}

// The front door ---------------------------------------------------------------------------------

/**
 * Online, a signed-out visitor first sees the start screen (account.md R-ACCOUNT-029): Play, then the age screen
 * (R-ACCOUNT-012), answered with a grown-up's birthday, then the door as offline. Offline the door is first. True
 * once the door's first button shows.
 */
async function onlineDoor(run: Run, next: Locator): Promise<boolean> {
  const { page } = run;
  const play = page.getByRole("button", { name: "Play", exact: true });
  const day = page.getByRole("combobox", { name: "Day" });
  for (let step = 0; step < 4; step += 1) {
    await next.or(play).or(day).first().waitFor({ state: "visible", timeout: LONG }).catch(() => undefined);
    if (await shown(next)) return true;
    if (await shown(play)) {
      log(run, "online: the start screen");
      await shot(run, "start screen");
      if (!(await tap(run, play, "Play"))) return false;
      await play.waitFor({ state: "detached", timeout: LONG }).catch(() => undefined);
      continue;
    }
    if (await shown(day)) {
      log(run, "online: the age screen, answered 17 May 1990");
      await day.selectOption("17");
      await page.getByRole("combobox", { name: "Month" }).selectOption({ label: "May" });
      await page.getByRole("combobox", { name: "Year" }).selectOption("1990");
      await shot(run, "age screen");
      if (!(await tap(run, page.getByRole("button", { name: "Continue" }), "Continue on the age screen"))) return false;
      // The answer goes to the server; the age screen stays until it is taken.
      await day.waitFor({ state: "detached", timeout: LONG }).catch(() => undefined);
      continue;
    }
    return false;
  }
  return shown(next);
}

async function frontDoor(run: Run, button: string): Promise<boolean> {
  const { page, options } = run;
  if (options.played) await page.addInitScript({ content: 'localStorage.setItem("japacity.walkthrough", "1");' });
  await page.goto("/");
  // The ready lives are behind Settings (prologue.md R-PROLOGUE-013): the driver asks for them as Settings does, then opens the door again.
  if (options.ready) {
    await page.evaluate(() => localStorage.setItem("japacity.door.ready", "1"));
    await page.reload();
  }
  // Settings' run opens on the ready lives themselves; a new player's on the first screen.
  const next = page.getByRole("button", { name: options.ready ? /^Pick: / : /^Next/ }).first();
  if (!(await onlineDoor(run, next))) {
    problem(run, "the front door did not open");
    return false;
  }
  log(run, `front door: ${await words(page.locator("[data-gate-sheet]"))}`);
  if (!options.ready) {
    log(run, `name filled: ${await page.getByRole("textbox", { name: "Your name" }).inputValue().catch(() => "")}`);
    await shot(run, "front door");
    if (!(await tap(run, next, "Next"))) return false;
  }

  await shot(run, options.ready ? "ready lives" : "your life so far");
  if (!(await tap(run, page.getByRole(options.ready ? "button" : "radio", { name: button, exact: true }), button))) return false;
  log(run, `picked ${button}`);
  if (!options.ready) {
    log(run, `age: ${await words(page.locator("[data-door-age]"))}`);
    if (!(await tap(run, page.getByRole("button", { name: /^Print my page/ }), "Print my page"))) return false;
  }
  if (!(await appear(page.getByRole("button", { name: /^Begin/ }), LONG))) {
    problem(run, "the page never came");
    return false;
  }
  await shot(run, "your page");
  if (!(await tap(run, page.getByRole("button", { name: /^Begin/ }), "Begin"))) return false;
  await page.locator("[data-gate='page'], [data-gate='begun']").first().waitFor({ state: "detached", timeout: LONG }).catch(() => undefined);
  log(run, "begun");
  return true;
}

/**
 * The years before: the page fills as the presets run, with no card (prologue.md R-PROLOGUE-010, 014), then waits
 * for Go. A card is a problem now; it is answered with its first answer so the run goes on.
 */
async function yearsBefore(run: Run): Promise<void> {
  const { page } = run;
  const band = page.locator("[data-band]");
  // The marker wraps a fixed gate and has no size of its own; the sheet inside it is what shows.
  const handover = page.locator("[data-page-handover] [data-gate-sheet]");
  const answer = page.locator("[data-prologue-card] [data-answer] button:enabled");
  for (let wait = 0; wait < 80; wait += 1) {
    if (await shown(band)) return;
    if (await shown(handover)) {
      log(run, `page: ${await words(handover, 400)}`);
      await page.waitForTimeout(1_200);
      await shot(run, "your page filled");
      // The page waits for the player (R-PROLOGUE-014): Go opens the world.
      await tap(run, page.getByRole("button", { name: "Go", exact: true }), "Go on the page");
      return;
    }
    if (await shown(answer)) {
      problem(run, `a card showed for a new life: ${oneLine(await page.locator("[data-prologue-card]").first().innerText({ timeout: SHORT }).catch(() => ""), 160)}`);
      await tap(run, answer, await words(answer, 60));
      continue;
    }
    await page.waitForTimeout(300);
  }
  problem(run, "the page never handed over");
}

/** A ride the story or the nudge picked on the map: Go by danfo, a picture on the way, then Skip. */
async function ride(run: Run): Promise<void> {
  const { page } = run;
  const sheet = page.locator("[data-ride-sheet]");
  log(run, `ride: ${await words(sheet)}`);
  await shot(run, "map with a stop picked");
  // A fare the naira cannot pay shuts the main button (R-WORLD-017): the sheet is closed and the month goes on.
  const main = sheet.locator("[data-ride-main]");
  if ((await shown(main)) && !(await main.isEnabled())) {
    log(run, "the ride's main button is shut (no fare): closing the sheet");
    await closeSheets(run);
    return;
  }
  if (!(await tap(run, main, "the ride's main button"))) return;
  if (await appear(page.locator("[data-ride]"), SHORT)) {
    await page.waitForTimeout(1_500);
    await shot(run, "on the ride");
    // The ride ends itself after RIDE_MS plus its slack; on a slow machine the picture may have eaten that, so a
    // Skip that goes while the tap is reaching for it is the ride ending, not a problem.
    const skip = page.locator("[data-ride-skip]");
    if (await shown(skip)) {
      const tapped = await skip.first().click({ timeout: SHORT }).then(() => true).catch(() => false);
      if (tapped) log(run, "tapped Skip on the ride");
      else if (await shown(page.locator("[data-ride]"))) problem(run, "could not tap Skip on the ride, which was still on");
      else log(run, "the ride ended by itself before Skip was tapped");
    }
  }
  await appear(page.locator("[data-band]"), LONG);
  await placeDrawn(run);
  log(run, `arrived: ${await words(page.locator("[data-band]"))}`);
}

/** A later chapter's opening card: Go takes the step, which opens the map with the stop picked; the ride follows. */
async function openingWords(run: Run): Promise<void> {
  const { page } = run;
  log(run, `opening words: ${await words(page.locator("[data-opening]"), 300)}`);
  await shot(run, "opening words");
  await tap(run, page.locator("[data-opening-go]"), "Go on the opening words");
  const sheet = page.locator("[data-ride-sheet]");
  if (await appear(sheet, 8_000)) await ride(run);
  else if (await shown(page.locator("[data-map-close]"))) await tap(run, page.locator("[data-map-close]"), "Close the map");
}

/** Anything standing over the world before the player can act: the first chapter's title, a later chapter's card, a card. */
async function settle(run: Run, when: string): Promise<void> {
  const { page } = run;
  for (let step = 0; step < 12; step += 1) {
    const title = page.locator("[data-opening-title]");
    if (await shown(title)) {
      log(run, `chapter title: ${await words(title)}; nudge: ${await words(page.locator("[data-nudge]"))}`);
      await shot(run, `chapter title ${when}`);
      await title.waitFor({ state: "detached", timeout: SHORT }).catch(() => undefined);
      continue;
    }
    if (await shown(page.locator("[data-opening-go]"))) {
      await openingWords(run);
      continue;
    }
    if (await shown(page.locator("[data-ride-sheet]"))) {
      await ride(run);
      continue;
    }
    const card = page.getByRole("dialog");
    if (await shown(card)) {
      log(run, `card over the world ${when}: ${await words(card)}`);
      await shot(run, `card ${when}`);
      const closer = card.getByRole("button", { name: /^(Close|Carry on|Next|Go|Done|Not now|OK)$/ });
      await tap(run, (await shown(closer)) ? closer : card.getByRole("button").last(), "the card's button");
      await page.waitForTimeout(400);
      continue;
    }
    const labels = page.locator("[data-first-labels]");
    if (step === 0 && (await shown(labels))) log(run, `first-use labels: ${await words(labels)}`);
    return;
  }
}

async function intoTheWorld(run: Run): Promise<boolean> {
  const { page } = run;
  await yearsBefore(run);
  // A ready life may go straight in; a tile's life fills its page first. Either way the band ends it.
  for (let step = 0; step < 6 && !(await shown(page.locator("[data-band]"))); step += 1) {
    if (await shown(page.locator("[data-prologue-card], [data-page-handover] [data-gate-sheet], [data-page-running] [data-gate-sheet]"))) await yearsBefore(run);
    else await page.waitForTimeout(1_000);
  }
  if (!(await appear(page.locator("[data-band]"), LONG))) {
    problem(run, "the world never opened");
    return false;
  }
  await settle(run, "on arrival");
  await placeDrawn(run);
  await settle(run, "on arrival");
  log(run, `in the world: ${await words(page.locator("[data-band]"))}`);
  await shot(run, "the world");
  return true;
}

// A month ---------------------------------------------------------------------------------------

/** A sheet over the world that asks something: a world sheet other than the month's and its results, or a thing's own sheet. */
const OPEN_SHEET = "[data-world-sheet]:not([data-world-sheet='results']), [role='dialog']:not([data-world-sheet])";

/** Buttons that pick among choices rather than act: a job in a list, a tab. */
const PICKER_ROLES = new Set(["radio", "checkbox", "tab", "switch", "option"]);

/**
 * What a sheet asks the player to do: its main button, the way there, else its first act. The first
 * answer is taken, as on the cards of the years before: an offer's Accept, a repair's Pay.
 */
async function mainButton(sheet: Locator): Promise<Locator | null> {
  for (const chosen of [sheet.locator("[data-ask-main]:enabled"), sheet.locator("[data-ask-go]"), sheet.locator(".btn-main:enabled")]) if (await shown(chosen)) return chosen.first();
  for (const button of await sheet.locator("button:enabled").all()) {
    const name = oneLine((await button.getAttribute("aria-label")) ?? (await button.innerText().catch(() => "")));
    // A disclosure (aria-expanded) only shows more words; it is not an act.
    const picker = PICKER_ROLES.has((await button.getAttribute("role")) ?? "") || (await button.getAttribute("aria-expanded")) !== null;
    // The jobs list picks which job the hunt is for; the act is the card's own button under it.
    const aside = (await button.locator("xpath=ancestor::*[@data-asks-foot or @data-jobs or @data-jobs-out]").count()) > 0;
    // The phone's scrim is a button hidden from readers (aria-hidden, no name): a tap on it closes the phone, never an act.
    const hidden = (await button.getAttribute("aria-hidden")) === "true";
    if (!picker && !aside && !hidden && !/^(Close|Back)$/.test(name) && (await button.isVisible())) return button;
  }
  return null;
}

async function closeSheets(run: Run): Promise<void> {
  const { page } = run;
  for (let step = 0; step < 3; step += 1) {
    const sheet = page.locator(OPEN_SHEET);
    if (!(await shown(sheet))) return;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    if (await shown(sheet)) {
      const close = sheet.getByRole("button", { name: "Close", exact: true });
      if (await shown(close)) await tap(run, close, "Close on the sheet");
    }
  }
}

/** The nudge says the next thing to do; a tap on it opens what it names, and its main act is taken. */
async function followNudge(run: Run, month: number): Promise<void> {
  const { page } = run;
  const nudge = page.locator("[data-nudge]");
  if (!(await shown(nudge))) {
    log(run, `month ${String(month)}: no nudge showing`);
    return;
  }
  log(run, `month ${String(month)}: nudge says "${await words(nudge)}"`);
  // A card over the world (the month's results on a return, the real-story card) covers the nudge: it is read and passed first.
  if (await shown(page.getByRole("dialog"))) await settle(run, `before the nudge in month ${String(month)}`);
  const open = page.locator("[data-nudge-open]");
  if (!(await shown(open))) {
    log(run, "the nudge is not a button; nothing to open");
    return;
  }
  await tap(run, open, "the nudge");
  await page.waitForTimeout(800);
  for (let step = 0; step < 5; step += 1) {
    if (await shown(page.locator("[data-ride-sheet]"))) {
      await ride(run);
      continue;
    }
    // The phone's Japa app, opened by a step that reads the official page there (R-ADVICE-002): its card is read, then the phone is put away.
    const official = page.locator("[data-official-page]");
    if (await shown(official)) {
      log(run, `the official page in Japa: ${(await official.first().getAttribute("data-official-page")) ?? ""}`);
      await tap(run, official, "Read the official page");
      await page.waitForTimeout(1_200);
      const toast = page.locator("[data-speech], [data-corner] [data-told]:last-child");
      if (await shown(toast)) log(run, `toast: ${await words(toast)}`);
      await shot(run, `month ${String(month)} official page`);
      await tap(run, page.locator("[data-home-bar]"), "the phone's home bar");
      await page.waitForTimeout(600);
      break;
    }
    // A paper asked for by a call or a message opens the phone's Papers on its card (R-WORLD-019): the card's act is
    // taken, the corner's answer read, and the phone put away; with no card open, the papers are read as they stand.
    const papers = page.locator("[data-app-screen='papers']");
    if (await shown(papers)) {
      const card = papers.locator("[data-paper-card]");
      const act = card.locator("[data-activity-picker] button:enabled");
      if (await shown(act)) {
        log(run, `the nudge opened Papers on ${(await card.first().getAttribute("data-paper-card")) ?? ""}: ${await words(card, 240)}`);
        await shot(run, `month ${String(month)} papers card`);
        await tap(run, act, "the paper's act");
        await page.waitForTimeout(1_200);
        const toast = page.locator("[data-speech], [data-corner] [data-told]:last-child");
        if (await shown(toast)) log(run, `toast: ${await words(toast)}`);
      } else log(run, `the nudge opened Papers: ${await words(papers, 240)}`);
      await tap(run, page.locator("[data-home-bar]"), "the phone's home bar");
      await page.waitForTimeout(600);
      break;
    }
    // The step that is the month's end opens the phone's Calendar (R-WORLD-003): its month is read, and the phone put away.
    const calendar = page.locator("[data-app-screen='calendar']");
    if (await shown(calendar)) {
      log(run, `the nudge opened the Calendar: ${await words(calendar, 240)}`);
      await tap(run, page.locator("[data-home-bar]"), "the phone's home bar");
      await page.waitForTimeout(600);
      break;
    }
    if (await shown(page.locator("[data-map-close]"))) {
      log(run, "the nudge opened the map with no stop picked; closing it");
      await tap(run, page.locator("[data-map-close]"), "Close the map");
      break;
    }
    const sheet = page.locator(OPEN_SHEET);
    if (await shown(sheet)) {
      const mark = (await sheet.first().getAttribute("data-world-sheet")) ?? "thing";
      const before = await words(sheet, 400);
      log(run, `${mark} sheet: ${oneLine(before, 240)}`);
      await shot(run, `month ${String(month)} ${mark} sheet`);
      let main = await mainButton(sheet.first());
      if (main === null) {
        // A picker (which route, which school): the first row is chosen, as a player would, and the sheet's button follows.
        const row = sheet.first().locator('[role="radio"]:not([aria-checked="true"]):enabled, [role="option"]:enabled');
        if (await shown(row)) {
          log(run, `picking the first row: ${await words(row, 60)}`);
          await tap(run, row, "the first row");
          await page.waitForTimeout(600);
          main = await mainButton(sheet.first());
        }
      }
      if (main === null) {
        log(run, "nothing on the sheet to tap");
        break;
      }
      const name = oneLine((await main.getAttribute("aria-label")) ?? (await main.innerText().catch(() => "")), 80);
      log(run, `tapped "${name}"`);
      await tap(run, main, name);
      await page.waitForTimeout(1_200);
      const toast = page.locator("[data-speech], [data-corner] [data-told]:last-child");
      if (await shown(toast)) log(run, `toast: ${await words(toast)}`);
      // A sheet whose act is done closes or changes (to the next ask, or a card saying what happened);
      // one that stays as it was has nothing more to do here.
      if ((await shown(page.locator(OPEN_SHEET))) && (await words(page.locator(OPEN_SHEET), 400)) === before) break;
      continue;
    }
    // A thing shows a quiet mark and no chip until it is tapped (R-WORLD-005): the mark the nudge points at is tapped first.
    const nudged = page.locator("[data-thing-mark][data-nudged]");
    if (!(await shown(page.locator("[data-thing-chip]"))) && (await shown(nudged))) {
      log(run, `tapping the mark the nudge points at: ${(await nudged.first().getAttribute("data-thing-mark")) ?? ""}`);
      await tap(run, nudged, "the nudged thing's mark");
      await page.waitForTimeout(600);
    }
    // The act chips stay over the thing while its sheet is open, so they come after the sheet.
    const act = page.locator("[data-thing-chip] [data-act]");
    // An act that carries on in the plan says "Ongoing" and is shut (R-WORLD-007): only an open act can be tapped.
    const open = page.locator("[data-thing-chip] [data-act]:not([data-planned]):not([disabled])");
    if ((await shown(act)) && !(await shown(open))) {
      log(run, `acts over the thing: ${(await act.allInnerTexts()).map((name) => oneLine(name, 40)).join(", ")}; all ongoing, nothing to tap`);
      break;
    }
    if (await shown(act)) {
      const names = (await act.allInnerTexts()).map((name) => oneLine(name, 40)).join(", ");
      // The act the nudge's step opens, when the chips carry it and it is open; else the first open chip.
      const opens = await page.locator("[data-nudge]").first().getAttribute("data-nudge-opens", { timeout: 1_000 }).catch(() => null);
      const named = opens === null ? null : page.locator(`[data-act][data-activity="${opens}"]:not([data-planned]):not([disabled])`);
      const chosen = named !== null && (await shown(named)) ? named : open;
      const activities = (await act.evaluateAll((nodes) => nodes.map((node) => (node as { dataset: Record<string, string | undefined> }).dataset["activity"] ?? "-"))).join(", ");
      log(run, `acts over the thing: ${names} (${activities}); the nudge opens ${opens ?? "nothing named"}; tapping ${chosen === act ? "the first" : "the step's own"}`);
      await tap(run, chosen, "the act");
      // The character walks to the thing before its sheet opens (R-WORLD-005).
      await appear(page.locator(OPEN_SHEET), SHORT);
      continue;
    }
    break;
  }
  await closeSheets(run);
  await settle(run, `after the nudge in month ${String(month)}`);
}

/**
 * On the road (the desert route's screen): the set piece's question is answered with its first allowed answer that is
 * not the exit, then Wait a month ends the month. The life's end, or a month that cannot be waited, ends the run.
 */
async function onTheRoad(run: Run, month: number): Promise<boolean> {
  const { page } = run;
  const road = page.locator("[data-road]");
  log(run, `on the road in month ${String(month)}: ${await words(road, 240)}`);
  await shot(run, `month ${String(month)} on the road`);
  for (let step = 0; step < 4; step += 1) {
    const answers = road.locator("[data-chain-card] button:enabled:not([data-exit])");
    if (!(await shown(answers))) break;
    const name = await words(answers, 80);
    log(run, `road question: ${await words(road.locator("[data-chain-card]"), 240)}; answering "${name}"`);
    await tap(run, answers, name);
    await page.waitForTimeout(1_200);
  }
  const wait = road.locator("[data-road-wait]");
  if (!(await appear(wait, LONG))) {
    problem(run, `month ${String(month)}: no Wait a month on the road`);
    return false;
  }
  if (await wait.first().isDisabled()) {
    log(run, `month ${String(month)}: the road's month cannot be waited (the life ended, or nothing is banked)`);
    return false;
  }
  if (!(await tap(run, wait, "Wait a month"))) return false;
  // The button is busy while the month runs and enabled again after; a life that ended leaves it shut.
  await page.waitForTimeout(600);
  await wait.first().waitFor({ state: "visible", timeout: LONG }).catch(() => undefined);
  await page
    .waitForFunction("(() => { const wait = document.querySelector('[data-road-wait]'); return wait === null || !wait.disabled || document.querySelector('[data-road]') === null; })()", null, { timeout: LONG })
    .catch(() => undefined);
  run.monthsEnded += 1;
  log(run, `month ${String(month)} waited out on the road: ${await words(road, 200)}`);
  await shot(run, `month ${String(month)} road results`);
  return true;
}

async function endMonth(run: Run, month: number): Promise<boolean> {
  const { page } = run;
  // The city's own question may have put the life on the road this month (the night meeting, then the truth).
  if (await shown(page.locator("[data-road]"))) return onTheRoad(run, month);
  const end = page.locator("[data-end-month]");
  if (!(await appear(end, LONG))) {
    problem(run, `month ${String(month)}: no Next month button`);
    return false;
  }
  // An answer may open a new question (the road's deposit opens the night meeting): the nudge is followed again, twice at most.
  for (let again = 0; again < 2 && (await end.first().isDisabled()); again += 1) {
    log(run, `month ${String(month)}: Next month is shut (${(await end.first().getAttribute("title")) ?? "no reason given"}); following the nudge again`);
    await followNudge(run, month);
  }
  if (await end.first().isDisabled()) {
    problem(run, `month ${String(month)}: Next month is shut: ${(await end.first().getAttribute("title")) ?? "no reason given"}`);
    return false;
  }
  // The month is read in the phone's Calendar, opened by the band's calendar glyph, then the phone is put away (R-WORLD-002).
  const calendar = page.locator("[data-app-screen='calendar']");
  if (await tap(run, page.locator("[data-band] [data-month-count]"), "the calendar glyph")) {
    if (await appear(calendar, SHORT)) {
      log(run, `month ${String(month)} calendar: ${await words(calendar, 240)}`);
      await shot(run, `month ${String(month)} plan`);
      await tap(run, page.locator("[data-home-bar]"), "the phone's home bar");
      await page.waitForTimeout(600);
    } else problem(run, `month ${String(month)}: the calendar glyph did not open the Calendar`);
  }
  // Next month on the band turns the page at once; in the first month, or one with nothing planned and no job, it opens
  // the Calendar instead, whose own Next month turns it.
  if (!(await tap(run, end, "Next month"))) return false;
  if (await appear(calendar, 2_000)) {
    log(run, `month ${String(month)}: Next month opened the Calendar first`);
    if (!(await tap(run, calendar.locator("[data-month-end]"), "Next month in the Calendar"))) return false;
  }

  // Staged moments and cards come before the results; each is read and passed.
  const results = page.locator("[data-world-sheet='results']");
  for (let step = 0; step < 40 && !(await shown(results)); step += 1) {
    const moment = page.locator("[data-moment]");
    if (await shown(moment)) {
      log(run, `moment: ${await words(moment)}`);
      await shot(run, `month ${String(month)} moment`);
      await tap(run, page.getByRole("dialog").getByRole("button").last(), "the moment's button");
    }
    await page.waitForTimeout(500);
  }
  if (!(await shown(results))) {
    problem(run, `month ${String(month)}: no results after the month ended`);
    return false;
  }
  log(run, `month ${String(month)} results: ${await words(results, 600)}`);
  await shot(run, `month ${String(month)} results`);
  await tap(run, results.locator("[data-results-back]"), "Back on the results");
  await page.waitForTimeout(600);
  run.monthsEnded += 1;
  await settle(run, `after month ${String(month)}`);
  log(run, `band: ${await words(page.locator("[data-band]"))}`);
  return true;
}

// The phone -------------------------------------------------------------------------------------

async function phoneApps(run: Run): Promise<void> {
  // On the road there is no phone to open (features/road); the screen is read instead.
  if (await shown(run.page.locator("[data-road]"))) {
    log(run, "on the road at the end: no phone to open");
    return;
  }
  const { page } = run;
  // A life that ended, or a screen with no thumb bar, has no phone to open: read, not a problem.
  if (!(await shown(page.locator("[data-thumb='phone']")))) {
    log(run, "no phone thumb at the end: nothing to open");
    return;
  }
  if (!(await tap(run, page.locator("[data-thumb='phone']"), "the phone"))) return;
  if (!(await appear(page.locator("[data-app]"), SHORT))) {
    problem(run, "the phone opened with no apps");
    return;
  }
  const apps = (await Promise.all((await page.locator("[data-app]").all()).map((tile) => tile.getAttribute("data-app")))).filter((app): app is string => app !== null);
  log(run, `phone: ${String(apps.length)} apps: ${apps.join(", ")}`);
  await shot(run, "phone");
  for (const app of apps) {
    const tile = page.locator(`[data-app="${app}"]`);
    if (!(await shown(tile))) {
      problem(run, `the ${app} app's tile was not on the phone`);
      continue;
    }
    await tap(run, tile, `the ${app} app`);
    const opened = page.locator(`[data-phone-app="${app}"]`);
    if (await appear(opened, SHORT)) log(run, `${app}: ${await words(opened, 240)}`);
    else problem(run, `the ${app} app did not open`);
    await shot(run, `phone ${app}`);
    const back = page.getByRole("button", { name: "Back", exact: true });
    for (let step = 0; step < 3 && !(await shown(page.locator("[data-app]"))); step += 1) {
      if (await shown(back)) await tap(run, back, "Back on the phone");
      else await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
    }
  }
  const away = page.getByRole("button", { name: "Put the phone away" });
  if (await shown(away)) await tap(run, away, "Put the phone away");
}

// The dev server ----------------------------------------------------------------------------------

/** The local stack's own certificate is self-signed, so its page is asked for with the check off, and only there. */
function answersLocally(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const call = request(url, { rejectUnauthorized: false, timeout: 2_000 }, (reply) => {
      reply.resume();
      resolve((reply.statusCode ?? 0) >= 200 && (reply.statusCode ?? 0) < 300);
    });
    call.on("timeout", () => call.destroy());
    call.on("error", () => resolve(false));
    call.end();
  });
}

async function answers(url: string): Promise<boolean> {
  if (localCertificate(url)) return answersLocally(url);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
    return response.ok;
  } catch {
    return false;
  }
}

/** The address to play: the one given, one already answering on the port, or a dev server started here. */
async function server(options: PlayOptions, say: (message: string) => void): Promise<{ base: string; stop: () => void } | null> {
  if (options.url !== null) {
    if (await answers(options.url)) return { base: options.url, stop: () => undefined };
    say(`nothing answers at ${options.url}`);
    return null;
  }
  const base = `http://localhost:${String(options.port)}`;
  if (await answers(base)) {
    say(`using the dev server already at ${base}`);
    return { base, stop: () => undefined };
  }
  say(`starting the dev server at ${base} (its output goes to dev-server.log)`);
  const output = createWriteStream(join(options.out, "dev-server.log"));
  const child: ChildProcess = spawn("pnpm", ["--filter", "@japacity/client", "exec", "vite", "--port", String(options.port), "--strictPort"], {
    cwd: ROOT,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.pipe(output);
  child.stderr?.pipe(output);
  const stop = () => {
    if (child.pid !== undefined && child.exitCode === null) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill("SIGTERM");
      }
    }
  };
  for (let waited = 0; waited < 90; waited += 1) {
    if (await answers(base)) return { base, stop };
    if (child.exitCode !== null) break;
    await new Promise((done) => setTimeout(done, 1_000));
  }
  stop();
  say("the dev server did not start; see dev-server.log");
  return null;
}

// The run ---------------------------------------------------------------------------------------

async function play(options: PlayOptions, button: string): Promise<number> {
  const started = Date.now();
  writeFileSync(join(options.out, "play.log"), "");
  const head = { started, options };
  log(head, `play: ${options.ready ? "ready life" : "tile"} "${button}", ${String(options.months)} months, pictures in ${options.out}`);
  const served = await server(options, (message) => log(head, message));
  if (served === null) return 1;

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: !options.headed, args: CHROMIUM_ARGS });
    const context = await browser.newContext({ ...PHONE, baseURL: served.base, ignoreHTTPSErrors: localCertificate(served.base) });
    const page = await context.newPage();
    const run: Run = { page, options, started, shots: 0, monthsEnded: 0, problems: [] };
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(`page error: ${oneLine(error.message, 200)}`));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`console error: ${oneLine(message.text(), 200)}`);
    });

    const reached = (await frontDoor(run, button)) && (await intoTheWorld(run));
    if (reached) {
      for (let month = 1; month <= options.months; month += 1) {
        // A life that took the road is on its own screen, a list with no world (features/road): its month is waited out there.
        if (await shown(page.locator("[data-road]"))) {
          if (!(await onTheRoad(run, month))) break;
          continue;
        }
        await followNudge(run, month);
        if (!(await endMonth(run, month))) break;
      }
      await phoneApps(run);
      await shot(run, "the world at the end");
    }

    for (const error of errors) log(run, error);
    log(run, `done: ${String(run.monthsEnded)} of ${String(options.months)} months ended, ${String(run.shots)} pictures, ${String(run.problems.length)} problems, ${String(errors.length)} browser errors`);
    return reached && run.monthsEnded === options.months ? 0 : 1;
  } catch (error) {
    const message = String(error);
    log(head, `stopped: ${oneLine(message, 400)}`);
    if (message.includes("Executable doesn't exist")) log(head, "Playwright's browser is missing. Run: pnpm exec playwright install chromium");
    return 1;
  } finally {
    await browser?.close().catch(() => undefined);
    served.stop();
  }
}

async function main(): Promise<void> {
  const parsed = parseOptions(process.argv.slice(2), process.cwd(), ROOT);
  if (!parsed.ok) {
    if (parsed.help) {
      console.log(USAGE);
      return;
    }
    console.error(`${parsed.problem}\n\n${USAGE}`);
    process.exitCode = 2;
    return;
  }
  const door = doorButton(livesFrom(text), parsed.options.life, parsed.options.ready);
  if (!door.ok) {
    console.error(door.problem);
    process.exitCode = 2;
    return;
  }
  mkdirSync(parsed.options.out, { recursive: true });
  process.exitCode = await play(parsed.options, door.name);
}

await main();
