// pnpm teaser:record [--port 5183] [--only door,house]
// Plays the game on the phone profile (390 by 844 at scale 2, touch) on a development server and records the moments the
// teaser shows, each as a short WebM under apps/teaser/clips/: the front door's stickers, the map and the ride, the
// family house whole and turned a quarter, the fan on the sofa, the house at night, the Bank's passbook and a results
// morning. A development server already answering on the port is used; otherwise one is started and stopped after.
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { type Browser, type BrowserContext, chromium, type Page } from "@playwright/test";

import { CLIPS, type ClipName } from "../src/clips";
import { cutClip, type Frame, startScreencast } from "./screencast";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const OUT = fileURLToPath(new URL("../clips", import.meta.url));
const WORK = join(OUT, ".frames");
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } as const;
/** A laptop's screen at the teaser's own 1920 by 1080: the world fills it round the centred column (design page 13). */
const WIDE = { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 } as const;
const PIXELS = { phone: { width: 780, height: 1688 }, wide: { width: 1920, height: 1080 } } as const;
/** The world alone: every surface over the scene hidden while a wide shot rolls, so the shot is the city and its people. */
const CLEAN = "html[data-teaser-clean] body * { visibility: hidden !important; } html[data-teaser-clean] canvas { visibility: visible !important; }";
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";

interface Options {
  readonly port: number;
  readonly only: readonly string[];
}

function parse(argv: readonly string[]): Options {
  const value = (flag: string) => {
    const at = argv.indexOf(flag);
    return at === -1 ? undefined : argv[at + 1];
  };
  const only = value("--only");
  return { port: Number(value("--port") ?? "5183"), only: only === undefined ? [] : only.split(",") };
}

async function answers(url: string): Promise<boolean> {
  return fetch(url).then((response) => response.ok, () => false);
}

async function devServer(port: number): Promise<ChildProcess | null> {
  const url = `http://localhost:${String(port)}/`;
  if (await answers(url)) return null;
  const server = spawn("pnpm", ["--filter", "@japacity/client", "dev", "--port", String(port), "--strictPort"], { cwd: ROOT, stdio: "ignore" });
  for (let wait = 0; wait < 120; wait += 1) {
    if (await answers(url)) return server;
    await new Promise((done) => setTimeout(done, 500));
  }
  server.kill();
  throw new Error(`The development server did not answer on ${url}`);
}

type Probe = { ready?: boolean; place?: string; frames?: unknown[] } | undefined;

async function placeReady(page: Page, place?: string): Promise<void> {
  await page.waitForFunction(
    (id) => {
      const city = (window as unknown as { __city?: Probe }).__city;
      return city?.ready === true && (id === null || city.place === id) && (city.frames?.length ?? 0) > 3;
    },
    place ?? null,
    { timeout: 90_000 },
  );
}

async function visible(page: Page, selector: string, timeout = 0): Promise<boolean> {
  const found = page.locator(selector).first();
  if (timeout === 0) return found.isVisible().catch(() => false);
  return found.waitFor({ state: "visible", timeout }).then(() => true, () => false);
}

/** The cards that stand over the world (a moment's Close, a brief's Let's go, the home's teaching card), passed. */
async function passCards(page: Page): Promise<void> {
  for (let step = 0; step < 8; step += 1) {
    if (await visible(page, "[data-home-teach-ok]")) await page.locator("[data-home-teach-ok]").click();
    else if (await visible(page, "[data-moment-screen]")) await page.locator("[data-moment-screen]").getByRole("button", { name: "Close" }).first().click();
    else if (await visible(page, "[data-brief-close-go], [data-brief-go]")) await page.locator("[data-brief-close-go], [data-brief-go]").first().click();
    else if (await visible(page, "[data-map-close]")) await page.locator("[data-map-close]").click();
    else return;
    await page.waitForTimeout(500);
  }
}

/** A thing tapped where it stands: its quiet mark, or the thing in the scene. */
async function tapThing(page: Page, thing: string): Promise<void> {
  const mark = page.locator(`[data-mark="${thing}"]`);
  if (await mark.isVisible().catch(() => false)) {
    await mark.click({ force: true });
    return;
  }
  const at = await page.evaluate((id) => (window as unknown as { __city?: { screenOfThing?: (one: string) => { x: number; y: number } | null } }).__city?.screenOfThing?.(id) ?? null, thing);
  if (at !== null) await page.mouse.click(at.x, at.y);
}

/** A thing's act from its fan (R-WORLD-034). */
async function fanAct(page: Page, thing: string, act: string): Promise<void> {
  const button = page.locator(`[data-fan="${thing}"] [data-fan-act="${act}"] button, [data-fan-sheet="${thing}"] [data-fan-act="${act}"] button`).first();
  for (let tries = 0; tries < 4 && !(await button.isVisible().catch(() => false)); tries += 1) {
    await tapThing(page, thing);
    await button.waitFor({ state: "visible", timeout: 3000 }).catch(() => undefined);
  }
  await button.click({ timeout: 10_000 });
}

interface Session {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly now: () => number;
  readonly stop: () => Promise<readonly Frame[]>;
}

async function session(browser: Browser, base: string, name: string, save: string | null, wide = false): Promise<Session> {
  const context = await browser.newContext({ ...(wide ? WIDE : PHONE), baseURL: base });
  await context.addInitScript((css) => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = css;
      document.head.append(style);
    });
  }, CLEAN);
  // The device marked as played, so the first-use labels at the thumbs stay out of the picture (R-WORLD-033).
  await context.addInitScript(() => localStorage.setItem("japacity.walkthrough", "1"));
  if (save !== null) {
    await context.addInitScript((stored) => {
      if (sessionStorage.getItem("seeded") === null) {
        localStorage.setItem("japacity.save", stored);
        sessionStorage.setItem("seeded", "1");
      }
    }, save);
  }
  const page = await context.newPage();
  const recording = await startScreencast(page, join(WORK, name), wide ? PIXELS.wide : PIXELS.phone);
  return { context, page, now: recording.now, stop: recording.stop };
}

type Marks = Partial<Record<ClipName, readonly [number, number]>>;

/** The front door's three sticker screens, the page and the world opening. Returns the save it made. */
async function door(s: Session, marks: Marks): Promise<string> {
  const { page } = s;
  await page.goto("/?sleep=2");
  const next = page.getByRole("button", { name: /^Next/ }).first();
  await next.waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1200);
  const from = s.now();
  await page.waitForTimeout(1200);
  await next.click();
  const tile = page.locator("[data-gate='life'] [role='radio']");
  await tile.first().waitFor({ timeout: 20_000 });
  await page.waitForTimeout(900);
  await tile.nth(1).click();
  await page.waitForTimeout(1100);
  await page.locator("[data-gate='life']").getByRole("button", { name: /^Next/ }).click();
  await page.waitForTimeout(1600);
  marks.door = [from, s.now()];
  await page.getByRole("button", { name: /^Begin/ }).click();
  const go = page.locator("[data-page-handover]").getByRole("button", { name: "Go", exact: true });
  await go.waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1000);
  await go.click();
  await page.locator("[data-band]").waitFor({ timeout: 60_000 });
  await placeReady(page);
  await page.waitForTimeout(2500);
  return page.evaluate(() => localStorage.getItem("japacity.save") ?? "");
}

/** The map from its thumb folding out, a stop tapped on the painted map, the ride sheet's Go and the ride. */
async function mapAndRide(s: Session, marks: Marks): Promise<void> {
  const { page } = s;
  await page.goto("/?clock=morning");
  await placeReady(page);
  await passCards(page);
  await page.waitForTimeout(1500);
  const from = s.now();
  await page.locator('[data-thumb="map"]').click();
  await page.waitForFunction(() => (window as unknown as { __map?: { ready?: boolean } }).__map?.ready === true, null, { timeout: 60_000 });
  await page.waitForTimeout(1800);
  const stop = "place.ojuelegba";
  await page.evaluate((id) => document.querySelector<HTMLButtonElement>(`[data-stop="${id}"]`)?.click(), stop);
  await page.locator(`[data-ride-sheet="${stop}"]`).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(1500);
  marks.map = [from, s.now()];
  await page.locator(`[data-ride-sheet="${stop}"] [data-ride-main]`).click();
  await page.locator("[data-ride]").waitFor({ timeout: 10_000 });
  const rideFrom = s.now();
  await page.waitForTimeout(5000);
  marks.ride = [rideFrom, s.now()];
  await placeReady(page, stop);
}

/** The family house whole by day, turned a quarter by the round button; the sofa's fan and Sit. */
async function house(s: Session, marks: Marks): Promise<void> {
  const { page } = s;
  await page.goto("/?clock=afternoon");
  await placeReady(page, "place.family-house");
  await passCards(page);
  await page.waitForTimeout(2500);
  const from = s.now();
  await page.waitForTimeout(1500);
  await page.locator("[data-turn-house]").click();
  await page.waitForTimeout(2500);
  marks.house = [from, s.now()];
  await page.locator("[data-turn-house]").click();
  await page.waitForTimeout(2000);
  const fanFrom = s.now();
  await page.waitForTimeout(600);
  await fanAct(page, "sofa", "sit");
  await page.waitForTimeout(4000);
  marks.sofa = [fanFrom, s.now()];
}

/** The family house at night, in the night paint, turning. */
async function night(s: Session, marks: Marks): Promise<void> {
  const { page } = s;
  await page.goto("/?clock=night&paint=night");
  await placeReady(page, "place.family-house");
  await passCards(page);
  await page.waitForTimeout(2500);
  const from = s.now();
  await page.waitForTimeout(2000);
  await page.locator("[data-turn-house]").click();
  await page.waitForTimeout(2800);
  marks.night = [from, s.now()];
}

/** The phone from its thumb, the Bank's passbook opened and scrolled. */
async function bank(s: Session, marks: Marks): Promise<void> {
  const { page } = s;
  await page.goto("/?clock=morning");
  await placeReady(page);
  await passCards(page);
  await page.waitForTimeout(1500);
  const from = s.now();
  await page.locator('[data-thumb="phone"]').click();
  await page.waitForTimeout(1300);
  await page.locator('[data-app="bank"]').click();
  const screen = page.locator('[data-app-screen="bank"]');
  await screen.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(1500);
  const box = await screen.boundingBox();
  if (box !== null) {
    for (let step = 0; step < 12; step += 1) {
      await page.mouse.wheel(0, 40);
      await page.waitForTimeout(60);
    }
  }
  await page.waitForTimeout(1200);
  marks.bank = [from, s.now()];
}

/** The bed's Sleep, the night going by and the results morning over the scene. */
async function morning(s: Session, marks: Marks): Promise<void> {
  const { page } = s;
  await page.goto("/?clock=evening&sleep=2&morning=now");
  await placeReady(page, "place.family-house");
  await passCards(page);
  await page.waitForTimeout(1500);
  const from = s.now();
  const bed = (await page.locator('[data-mark="mattress"], [data-mark="bed"], [data-mark="bunk"]').first().getAttribute("data-mark").catch(() => null)) ?? "mattress";
  await fanAct(page, bed, "end-month");
  if (await visible(page, "[data-night-teach-ok]", 1500)) await page.locator("[data-night-teach-ok]").click();
  const results = page.locator("[data-world-sheet='results']");
  for (let wait = 0; wait < 60 && !(await results.isVisible().catch(() => false)); wait += 1) {
    if (await visible(page, "[data-moment-screen]")) await page.locator("[data-moment-screen]").getByRole("button", { name: "Close" }).first().click();
    else if (await visible(page, "[data-brief-close-go], [data-brief-go]")) await page.locator("[data-brief-close-go], [data-brief-go]").first().click();
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(3000);
  marks.morning = [from, s.now()];
}


/** Shows the world alone, or the surfaces over it again. */
async function clean(page: Page, on: boolean): Promise<void> {
  await page.evaluate((value) => {
    if (value) document.documentElement.dataset.teaserClean = "1";
    else delete document.documentElement.dataset.teaserClean;
  }, on);
}

/** The wide family house by day, alone, turning a quarter twice. */
async function wideDay(s: Session, marks: Marks): Promise<void> {
  const { page } = s;
  await page.goto("/?clock=afternoon");
  await placeReady(page, "place.family-house");
  await passCards(page);
  await page.waitForTimeout(2000);
  await clean(page, true);
  await page.waitForTimeout(800);
  const from = s.now();
  await page.waitForTimeout(1600);
  await page.evaluate(() => document.querySelector<HTMLButtonElement>("[data-turn-house]")?.click());
  await page.waitForTimeout(2200);
  await page.evaluate(() => document.querySelector<HTMLButtonElement>("[data-turn-house]")?.click());
  await page.waitForTimeout(2200);
  marks["wide-day"] = [from, s.now()];
}

/** The wide family house at night, alone, its lamps lit, turning a quarter. */
async function wideNight(s: Session, marks: Marks): Promise<void> {
  const { page } = s;
  await page.goto("/?clock=night&paint=night");
  await placeReady(page, "place.family-house");
  await passCards(page);
  await page.waitForTimeout(2000);
  await clean(page, true);
  await page.waitForTimeout(800);
  const from = s.now();
  await page.waitForTimeout(2000);
  await page.evaluate(() => document.querySelector<HTMLButtonElement>("[data-turn-house]")?.click());
  await page.waitForTimeout(2600);
  marks["wide-night"] = [from, s.now()];
}

/** The painted map folding out by day on a wide screen, a stop picked; then the ride and the street it ends on, alone. */
async function wideRide(s: Session, marks: Marks): Promise<void> {
  const { page } = s;
  await page.goto("/?clock=morning&paint=day");
  await placeReady(page, "place.family-house");
  await passCards(page);
  await page.waitForTimeout(1500);
  const from = s.now();
  await page.locator('[data-thumb="map"]').click();
  await page.waitForFunction(() => (window as unknown as { __map?: { ready?: boolean } }).__map?.ready === true, null, { timeout: 60_000 });
  await page.waitForTimeout(2500);
  const stop = "place.ojuelegba";
  await page.evaluate((id) => document.querySelector<HTMLButtonElement>(`[data-stop="${id}"]`)?.click(), stop);
  await page.locator(`[data-ride-sheet="${stop}"]`).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(1500);
  marks["wide-map"] = [from, s.now()];
  await page.locator(`[data-ride-sheet="${stop}"] [data-ride-main]`).click();
  await page.locator("[data-ride]").waitFor({ timeout: 10_000 });
  await clean(page, true);
  const rideFrom = s.now();
  await page.waitForTimeout(5500);
  marks["wide-ride"] = [rideFrom, s.now()];
  await placeReady(page, stop);
  await passCards(page);
  await clean(page, true);
  await page.waitForTimeout(1500);
  const streetFrom = s.now();
  await page.waitForTimeout(5000);
  marks["wide-street"] = [streetFrom, s.now()];
}

/** The painted map as two stills, by day and at night, at twice the teaser's pixels so a slow push stays sharp. */
async function stills(browser: Browser, base: string, save: string): Promise<void> {
  const context = await browser.newContext({ viewport: WIDE.viewport, deviceScaleFactor: 3, baseURL: base });
  await context.addInitScript(() => localStorage.setItem("japacity.walkthrough", "1"));
  await context.addInitScript((stored) => localStorage.setItem("japacity.save", stored), save);
  const page = await context.newPage();
  for (const paint of ["day", "night"] as const) {
    await page.goto(`/?clock=${paint === "day" ? "morning" : "night"}&paint=${paint}`);
    await placeReady(page);
    await passCards(page);
    await page.locator('[data-thumb="map"]').click();
    await page.waitForFunction(() => (window as unknown as { __map?: { ready?: boolean } }).__map?.ready === true, null, { timeout: 60_000 });
    await page.addStyleTag({ content: "[data-map-close], [data-country-menu] { visibility: hidden !important; }" });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(OUT, `map-${paint}.png`) });
    console.log(`teaser:record: map-${paint}.png`);
  }
  await context.close();
}

const SESSIONS = { map: mapAndRide, house, night, bank, morning, "wide-day": wideDay, "wide-night": wideNight, "wide-ride": wideRide } as const;
const WIDE_SESSIONS = new Set(["wide-day", "wide-night", "wide-ride"]);

async function main(): Promise<void> {
  const options = parse(process.argv.slice(2));
  const wanted = (name: string) => options.only.length === 0 || options.only.includes(name);
  const server = await devServer(options.port);
  const base = `http://localhost:${String(options.port)}`;
  // The GPU through Metal where there is one; the scene is drawn at a phone's pace, not the software renderer's.
  const browser = await chromium.launch({ args: ["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
  mkdirSync(OUT, { recursive: true });
  const savePath = join(WORK, "save.json");
  const marks: Marks = {};
  const cut = async (name: string, s: Session) => {
    const frames = await s.stop();
    await s.context.close();
    for (const clip of CLIPS.filter((one) => one.session === name)) {
      const mark = marks[clip.name];
      if (mark === undefined) {
        console.log(`teaser:record: no marks for ${clip.name}`);
        continue;
      }
      const seconds = cutClip(frames, mark[0], mark[1], join(OUT, clip.file), FFMPEG);
      console.log(`teaser:record: ${clip.file} ${seconds.toFixed(1)} s`);
    }
  };
  try {
    let save = existsSync(savePath) ? readFileSync(savePath, "utf8") : null;
    if (wanted("door") || save === null) {
      const s = await session(browser, base, "door", null);
      save = await door(s, marks);
      writeFileSync(savePath, save);
      await cut("door", s);
    }
    if (wanted("stills")) await stills(browser, base, save);
    for (const [name, play] of Object.entries(SESSIONS)) {
      if (!wanted(name)) continue;
      const s = await session(browser, base, name, save, WIDE_SESSIONS.has(name));
      try {
        await play(s, marks);
      } catch (error) {
        console.log(`teaser:record: ${name} stopped: ${String(error).split("\n")[0] ?? ""}`);
        await s.page.screenshot({ path: join(WORK, `${name}-stopped.png`) }).catch(() => undefined);
      }
      await cut(name, s);
    }
  } finally {
    await browser.close();
    server?.kill();
    if (options.only.length === 0) rmSync(WORK, { recursive: true, force: true });
  }
}

await main();
