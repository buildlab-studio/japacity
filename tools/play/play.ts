// pnpm play --out <folder> [--life developer] [--months 3]
// Plays the game on a phone-sized browser from the front door: an archetype's tile (or a ready life),
// a name, the years before, the opening words and the ride to the first stop, then each month: the
// nudge followed, the month ended, the results read. Last it opens every app on the phone. It takes a
// picture at each step into the folder given and prints a plain log, also saved there as play.log.
// It changes nothing in the repository. See tools/play/README.md.
import { type ChildProcess, spawn } from "node:child_process";
import { appendFileSync, createWriteStream, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { text } from "@japacity/content";
import { type Browser, chromium, devices, type Locator, type Page } from "@playwright/test";

import { doorButton, livesFrom, parseOptions, type PlayOptions, shotName, USAGE } from "./options";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
/** The phone the game is built for (docs/design/03-feasibility-and-plan.md, "Screens"), as the browser tests use it. */
const PHONE = { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } };
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

async function frontDoor(run: Run, button: string): Promise<boolean> {
  const { page, options } = run;
  if (options.skipWalkthrough) await page.addInitScript({ content: 'localStorage.setItem("japacity.walkthrough", "1");' });
  await page.goto("/");
  const next = page.getByRole("button", { name: /^Next/ });
  if (!(await appear(next, LONG))) {
    problem(run, "the front door did not open");
    return false;
  }
  log(run, `front door: ${await words(page.locator("[data-gate-sheet]"))}`);
  await shot(run, "front door");
  if (!(await tap(run, next, "Next"))) return false;

  if (options.ready && !(await tap(run, page.getByRole("button", { name: /^Start from a ready life/ }), "Start from a ready life"))) return false;
  await shot(run, options.ready ? "ready lives" : "archetypes");
  if (!(await tap(run, page.getByRole("button", { name: button, exact: true }), button))) return false;
  log(run, `picked ${button}`);

  const names = page.getByRole("group", { name: "Names to take" }).getByRole("button");
  if (!(await appear(names, LONG))) {
    problem(run, "no names were offered");
    return false;
  }
  log(run, `name taken: ${await words(names)}`);
  await tap(run, names, "a name");
  const age = page.getByRole("button", { name: /^Next Your age/ });
  if (await shown(age)) {
    await tap(run, age, "Next to the age");
    log(run, `age: ${await words(page.locator("[data-gate-sheet]"))}`);
  }
  if (!(await tap(run, page.getByRole("button", { name: /^Print my page/ }), "Print my page", LONG))) return false;
  await shot(run, "your page");
  if (!(await tap(run, page.getByRole("button", { name: /^Begin/ }), "Begin"))) return false;
  await page.locator("[data-door-progress]").waitFor({ state: "detached", timeout: LONG }).catch(() => undefined);
  log(run, "begun");
  return true;
}

/** The years before, card by card (the first answer each time), to the handover and its Go. */
async function yearsBefore(run: Run): Promise<void> {
  const { page } = run;
  const band = page.locator("[data-band]");
  const opening = page.locator("[data-opening-go]");
  const handover = page.locator("[data-prologue-handover]");
  const answer = page.locator("[data-prologue-card] [data-answer] button:enabled");
  for (let card = 0; card < 80; card += 1) {
    if ((await shown(band)) || (await shown(opening))) return;
    if (await shown(handover)) {
      log(run, `handover: ${await words(handover, 300)}`);
      await shot(run, "handover");
      await tap(run, page.getByRole("button", { name: "Go", exact: true }), "Go on the handover");
      return;
    }
    if (!(await shown(answer))) {
      await page.waitForTimeout(300);
      continue;
    }
    const before = await page.locator("[data-prologue]").first().getAttribute("data-v").catch(() => null);
    const question = oneLine((await page.locator("[data-prologue-card]").first().innerText({ timeout: SHORT }).catch(() => "")).split("\n").find((line) => line.trim() !== "") ?? "", 160);
    const picked = await words(answer, 60);
    if (card === 0) await shot(run, "first card");
    await tap(run, answer, picked);
    log(run, `card ${String(card + 1)}: ${question} -> ${picked}`);
    if (before !== null) await page.locator(`[data-prologue][data-v="${before}"]`).waitFor({ state: "detached", timeout: SHORT }).catch(() => undefined);
  }
  problem(run, "the years before did not end in 80 cards");
}

/** A ride the story or the nudge picked on the map: Go by danfo, a picture on the way, then Skip. */
async function ride(run: Run): Promise<void> {
  const { page } = run;
  const sheet = page.locator("[data-ride-sheet]");
  log(run, `ride: ${await words(sheet)}`);
  await shot(run, "map with a stop picked");
  if (!(await tap(run, sheet.locator("[data-ride-main]"), "the ride's main button"))) return;
  if (await appear(page.locator("[data-ride]"), SHORT)) {
    await page.waitForTimeout(1_500);
    await shot(run, "on the ride");
    const skip = page.locator("[data-ride-skip]");
    if (await shown(skip)) await tap(run, skip, "Skip on the ride");
  }
  await appear(page.locator("[data-band]"), LONG);
  await placeDrawn(run);
  log(run, `arrived: ${await words(page.locator("[data-band]"))}`);
}

/** The chapter's opening words: Go takes the step, which opens the map with the stop picked; the ride follows. */
async function openingWords(run: Run): Promise<void> {
  const { page } = run;
  log(run, `opening words: ${await words(page.locator("[data-opening]"), 300)}`);
  await shot(run, "opening words");
  await tap(run, page.locator("[data-opening-go]"), "Go on the opening words");
  const sheet = page.locator("[data-ride-sheet]");
  if (await appear(sheet, 8_000)) await ride(run);
  else if (await shown(page.locator("[data-map-close]"))) await tap(run, page.locator("[data-map-close]"), "Close the map");
}

/** Anything standing over the world before the player can act: opening words, the walkthrough, a card. */
async function settle(run: Run, when: string): Promise<void> {
  const { page } = run;
  for (let step = 0; step < 12; step += 1) {
    if (await shown(page.locator("[data-opening-go]"))) {
      await openingWords(run);
      continue;
    }
    const walkthrough = page.locator("[data-walkthrough]");
    if (await shown(walkthrough)) {
      log(run, `walkthrough: ${await words(walkthrough)}`);
      if (step === 0) await shot(run, `walkthrough ${when}`);
      const on = page.locator("[data-walk-on]");
      if (!(await tap(run, (await shown(on)) ? on : walkthrough, "the walkthrough"))) return;
      await page.waitForTimeout(400);
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
      const closer = card.getByRole("button", { name: /^(Close|Carry on|Next|Go|Not now|OK)$/ });
      await tap(run, (await shown(closer)) ? closer : card.getByRole("button").last(), "the card's button");
      await page.waitForTimeout(400);
      continue;
    }
    return;
  }
}

async function intoTheWorld(run: Run): Promise<boolean> {
  const { page } = run;
  await yearsBefore(run);
  // A ready life may go straight in; a tile's life hands over first. Either way the band ends it.
  for (let step = 0; step < 6 && !(await shown(page.locator("[data-band]"))); step += 1) {
    if (await shown(page.locator("[data-prologue-card], [data-prologue-handover]"))) await yearsBefore(run);
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

const OPEN_SHEET = "[data-world-sheet]:not([data-world-sheet='month']):not([data-world-sheet='results'])";

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
    if (!picker && !aside && !/^(Close|Back)$/.test(name) && (await button.isVisible())) return button;
  }
  return null;
}

async function closeSheets(run: Run): Promise<void> {
  const { page } = run;
  for (let step = 0; step < 3; step += 1) {
    const sheet = page.locator("[data-world-sheet]");
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
    if (await shown(page.locator("[data-map-close]"))) {
      log(run, "the nudge opened the map with no stop picked; closing it");
      await tap(run, page.locator("[data-map-close]"), "Close the map");
      break;
    }
    const act = page.locator("[data-act]");
    if (await shown(act)) {
      const names = (await act.allInnerTexts()).map((name) => oneLine(name, 40)).join(", ");
      log(run, `acts over the thing: ${names}; tapping the first`);
      await tap(run, act, "the first act");
      await page.waitForTimeout(1_000);
      continue;
    }
    const sheet = page.locator(OPEN_SHEET);
    if (await shown(sheet)) {
      const mark = (await sheet.first().getAttribute("data-world-sheet")) ?? "sheet";
      log(run, `${mark} sheet: ${await words(sheet, 240)}`);
      await shot(run, `month ${String(month)} ${mark} sheet`);
      const main = await mainButton(sheet.first());
      if (main === null) {
        log(run, "nothing on the sheet to tap");
        break;
      }
      const name = oneLine((await main.getAttribute("aria-label")) ?? (await main.innerText().catch(() => "")), 80);
      log(run, `tapped "${name}"`);
      await tap(run, main, name);
      await page.waitForTimeout(1_200);
      const toast = page.locator("[data-toast]");
      if (await shown(toast)) log(run, `toast: ${await words(toast)}`);
      // A sheet whose act is done closes itself; one that stays open has said what it had to.
      if (await shown(page.locator(OPEN_SHEET))) break;
      continue;
    }
    break;
  }
  await closeSheets(run);
  await settle(run, `after the nudge in month ${String(month)}`);
}

async function endMonth(run: Run, month: number): Promise<boolean> {
  const { page } = run;
  const end = page.locator("[data-end-month]");
  if (!(await appear(end, LONG))) {
    problem(run, `month ${String(month)}: no Next month button`);
    return false;
  }
  if (await end.first().isDisabled()) {
    problem(run, `month ${String(month)}: Next month is shut: ${(await end.first().getAttribute("title")) ?? "no reason given"}`);
    return false;
  }
  if (!(await tap(run, end, "Next month"))) return false;
  const sheet = page.locator("[data-world-sheet='month']");
  if (!(await appear(sheet, SHORT))) {
    problem(run, `month ${String(month)}: the Month sheet did not open`);
    return false;
  }
  log(run, `month ${String(month)} sheet: ${await words(sheet, 240)}`);
  await shot(run, `month ${String(month)} plan`);
  if (!(await tap(run, sheet.locator("[data-month-end]"), "End month"))) return false;

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
  const { page } = run;
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

async function answers(url: string): Promise<boolean> {
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
    const context = await browser.newContext({ ...PHONE, baseURL: served.base });
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
