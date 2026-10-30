// pnpm teaser:record [--port 5183] [--only door,wide-day]
// Plays the game on a development server and records the moments the teaser shows, each as a short WebM under
// apps/teaser/clips/ (the list is src/clips.ts). The front door is played on the phone profile (390 by 844 at scale 2,
// touch) and makes a life named Ada; every other session starts from that life. The world's shots are taken on a wide
// screen (1280 by 720 at scale 1.5, so 1920 by 1080 in true pixels) with every surface over the scene hidden, the world
// alone; the results morning is taken on the phone. The tall shots are the same sessions on the phone (390 by 844 at
// scale 3, so 1170 by 2532, cropped to the portrait teaser's 1080 by 1920), the world alone as the hand holds it. The
// painted map is taken as two stills, by day and at night. A development server already answering on the port is used;
// otherwise one is started and stopped after.
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { type Browser, type BrowserContext, chromium, type Page } from "@playwright/test";

import { ALL_CLIPS, type ClipName, type Session as SessionName } from "../src/clips";
import { cutClip, type Frame, startScreencast } from "./screencast";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const OUT = fileURLToPath(new URL("../clips", import.meta.url));
const WORK = join(OUT, ".frames");
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } as const;
/**
 * A laptop's screen at the teaser's own 1920 by 1080: the world fills it round the centred column (docs/design/09-the-games-look.md). The
 * screencast hands a frame at the device's pixels only when the browser itself is started at that scale
 * (--force-device-scale-factor); otherwise it sends the CSS size, 1280 by 720, so the wide sessions run in a browser of
 * their own started at 1.5, as the tall ones do at 3.
 */
const WIDE = { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 } as const;
/** The phone at scale 3 for the portrait teaser's tall shots, in a browser started at that scale for the same reason. */
const TALL = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } as const;
const PIXELS = { phone: { width: 780, height: 1688 }, wide: { width: 1920, height: 1080 }, tall: { width: 1170, height: 2532 } } as const;
/** The tall frame cut to 9 by 16 round the middle of the screen (2532 less 2080 is 452, half above), then to 1080 by 1920. */
const TALL_CROP = "crop=1170:2080:0:226,scale=1080:1920:flags=lanczos";
/**
 * The world alone: every surface over the scene hidden while a wide shot rolls, so the shot is the city and its people.
 * The fan's mode keeps a thing's fan of acts (world:fan-of-sticker-buttons) over the scene, and nothing else.
 */
const CLEAN = [
  "html[data-teaser-clean] body * { visibility: hidden !important; }",
  "html[data-teaser-clean] canvas { visibility: visible !important; }",
  "html[data-teaser-clean='fan'] [data-fan], html[data-teaser-clean='fan'] [data-fan] * { visibility: visible !important; }",
].join("\n");
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
/**
 * The lives the front door makes, each by its name typed and its tile picked: the nurse every shot of the family house
 * starts from (the plane's flight in the teaser goes to London), and the child of the water, whose life starts in Makoko
 * (prologue:makoko-start-never-a-trap).
 */
const LIVES = {
  nurse: { name: "Ada", tile: "The nurse", kept: "kept.json" },
  water: { name: "Bisi", tile: "The child of the water", kept: "kept-water.json" },
} as const;
type Life = keyof typeof LIVES;

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

/** Waits until no line floats over anybody (world:street-talk-budget), so the shot starts on a quiet house. */
async function quiet(page: Page): Promise<void> {
  await page.locator("[data-speech]").first().waitFor({ state: "detached", timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(500);
}

/** Shows the world alone (or with a thing's fan), or the surfaces over it again. */
async function clean(page: Page, mode: "on" | "fan" | "off"): Promise<void> {
  await page.evaluate((value) => {
    if (value === "off") delete document.documentElement.dataset.teaserClean;
    else document.documentElement.dataset.teaserClean = value === "fan" ? "fan" : "";
  }, mode);
}

/** A button pressed through the page itself, so it answers while the surfaces over the scene are hidden. */
async function press(page: Page, selector: string): Promise<void> {
  await page.evaluate((query) => document.querySelector<HTMLButtonElement>(query)?.click(), selector);
}

interface Session {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly now: () => number;
  readonly stop: () => Promise<readonly Frame[]>;
}

/** Everything the device keeps of a life, as the front door left it: the save, the person, the door's years. */
type Kept = Record<string, string>;

type Shape = "wide" | "phone" | "tall";

async function session(browser: Browser, base: string, name: string, kept: Kept | null, shape: Shape): Promise<Session> {
  const profile = shape === "wide" ? WIDE : shape === "tall" ? TALL : PHONE;
  const context = await browser.newContext({ ...profile, baseURL: base });
  await context.addInitScript((css) => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = css;
      document.head.append(style);
    });
  }, CLEAN);
  // The device marked as played, so the first-use labels at the thumbs stay out of the picture (world:no-walkthrough-before-play).
  await context.addInitScript(() => localStorage.setItem("japacity.walkthrough", "1"));
  if (kept !== null) {
    await context.addInitScript((stored) => {
      if (sessionStorage.getItem("seeded") !== null) return;
      for (const [key, value] of Object.entries(stored)) localStorage.setItem(key, value);
      sessionStorage.setItem("seeded", "1");
    }, kept);
  }
  const page = await context.newPage();
  const recording = await startScreencast(page, join(WORK, name), PIXELS[shape]);
  return { context, page, now: recording.now, stop: recording.stop };
}

type Marks = Partial<Record<ClipName, readonly [number, number]>>;

/** The front door's three sticker screens with the name typed, the page and the world opening. Returns what the device kept. */
async function door(s: Session, life: Life): Promise<Kept> {
  const { page } = s;
  await page.goto("/?sleep=2");
  const next = page.getByRole("button", { name: /^Next/ }).first();
  await next.waitFor({ timeout: 60_000 });
  await page.getByRole("textbox", { name: "Character name" }).fill(LIVES[life].name);
  await next.click();
  const tile = page.locator("[data-gate='life'] [role='radio']");
  await tile.first().waitFor({ timeout: 20_000 });
  await page.getByRole("radio", { name: LIVES[life].tile, exact: true }).click().catch(() => tile.nth(1).click());
  await page.locator("[data-gate='life']").getByRole("button", { name: /^Next/ }).click();
  await page.getByRole("button", { name: /^Begin/ }).click();
  const go = page.locator("[data-page-handover]").getByRole("button", { name: "Go", exact: true });
  await go.waitFor({ timeout: 60_000 });
  await go.click();
  await page.locator("[data-band]").waitFor({ timeout: 60_000 });
  await placeReady(page);
  await page.waitForTimeout(2500);
  return page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((key) => [key, localStorage.getItem(key) ?? ""])));
}

/** The family house alone, wide or tall: by day it turns a quarter twice, at night its lamps are lit as it turns once. */
async function house(s: Session, marks: Marks, part: "day" | "night", frame: "wide" | "tall"): Promise<void> {
  const { page } = s;
  await page.goto(part === "day" ? "/?clock=afternoon" : "/?clock=night&paint=night");
  await placeReady(page, "place.family-house");
  await passCards(page);
  await quiet(page);
  await clean(page, "on");
  await page.waitForTimeout(800);
  const from = s.now();
  await page.waitForTimeout(1800);
  await press(page, "[data-turn-house]");
  await page.waitForTimeout(2400);
  if (part === "day") {
    await press(page, "[data-turn-house]");
    await page.waitForTimeout(2400);
  }
  marks[`${frame}-${part}`] = [from, s.now()];
}

/** The sofa tapped: the view eases into its room, the fan of acts opens out of it, Sit is taken and the character sits. */
async function sofa(s: Session, marks: Marks, frame: "wide" | "tall"): Promise<void> {
  const { page } = s;
  await page.goto("/?clock=afternoon");
  await placeReady(page, "place.family-house");
  await passCards(page);
  await quiet(page);
  await clean(page, "fan");
  await page.waitForTimeout(800);
  const from = s.now();
  await page.waitForTimeout(700);
  const sit = '[data-fan="sofa"] [data-fan-act="sit"] button';
  for (let tries = 0; tries < 4 && !(await page.locator(sit).count()); tries += 1) {
    await press(page, '[data-mark="sofa"]');
    await page.locator(sit).waitFor({ state: "attached", timeout: 3000 }).catch(() => undefined);
  }
  await page.waitForTimeout(1300);
  await press(page, sit);
  await page.waitForTimeout(3600);
  marks[`${frame}-sofa`] = [from, s.now()];
}

/** The ride from the map alone, wide or tall: the danfo from above, then from inside; then the street it stops at. */
async function ride(s: Session, marks: Marks, frame: "wide" | "tall"): Promise<void> {
  const { page } = s;
  await page.goto("/?clock=morning&paint=day");
  await placeReady(page, "place.family-house");
  await passCards(page);
  await page.locator('[data-thumb="map"]').click();
  await page.waitForFunction(() => (window as unknown as { __map?: { ready?: boolean } }).__map?.ready === true, null, { timeout: 60_000 });
  const stop = "place.ojuelegba";
  await press(page, `[data-stop="${stop}"]`);
  await page.locator(`[data-ride-sheet="${stop}"]`).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
  await page.locator(`[data-ride-sheet="${stop}"] [data-ride-main]`).click();
  await page.locator("[data-ride]").waitFor({ timeout: 10_000 });
  await clean(page, "on");
  const rideFrom = s.now();
  await page.waitForTimeout(6000);
  marks[`${frame}-ride`] = [rideFrom, s.now()];
  await placeReady(page, stop);
  await passCards(page);
  await clean(page, "on");
  await page.waitForTimeout(1500);
  const streetFrom = s.now();
  await page.waitForTimeout(5000);
  marks[`${frame}-street`] = [streetFrom, s.now()];
}

/**
 * Makoko alone by morning, wide or tall: the homes on stilts over the lagoon, the plank walk and the canoes going by. By
 * day, where the water, the stilts and the canoes stand apart; the night paint draws them as one dark mass.
 */
async function makoko(s: Session, marks: Marks, frame: "wide" | "tall"): Promise<void> {
  const { page } = s;
  await page.goto("/?clock=morning&paint=day");
  await placeReady(page, "place.makoko");
  await passCards(page);
  await quiet(page);
  await clean(page, "on");
  await page.waitForTimeout(800);
  const from = s.now();
  await page.waitForTimeout(4500);
  marks[`${frame}-makoko`] = [from, s.now()];
}

/** The bed's Sleep on the phone, the night going by and the results morning over the scene. */
async function morning(s: Session, marks: Marks): Promise<void> {
  const { page } = s;
  await page.goto("/?clock=evening&sleep=2&morning=now");
  await placeReady(page, "place.family-house");
  await passCards(page);
  await quiet(page);
  const bed = (await page.locator('[data-mark="mattress"], [data-mark="bed"], [data-mark="bunk"]').first().getAttribute("data-mark").catch(() => null)) ?? "mattress";
  const sleep = `[data-fan="${bed}"] [data-fan-act="end-month"] button`;
  for (let tries = 0; tries < 4 && !(await visible(page, sleep)); tries += 1) {
    await press(page, `[data-mark="${bed}"]`);
    await page.locator(sleep).waitFor({ state: "visible", timeout: 3000 }).catch(() => undefined);
  }
  await page.waitForTimeout(600);
  const from = s.now();
  await page.waitForTimeout(500);
  await page.locator(sleep).click({ timeout: 10_000 });
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

/** The painted map as two stills, by day and at night, at twice the teaser's pixels so a slow push stays sharp. */
async function stills(browser: Browser, base: string, kept: Kept): Promise<void> {
  const context = await browser.newContext({ viewport: WIDE.viewport, deviceScaleFactor: 3, baseURL: base });
  await context.addInitScript((stored) => {
    for (const [key, value] of Object.entries(stored)) localStorage.setItem(key, value);
    localStorage.setItem("japacity.walkthrough", "1");
  }, kept);
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

const SESSIONS: Record<Exclude<SessionName, "door">, { shape: Shape; life?: Life; play: (s: Session, marks: Marks) => Promise<void> }> = {
  "wide-day": { shape: "wide", play: (s, marks) => house(s, marks, "day", "wide") },
  "wide-night": { shape: "wide", play: (s, marks) => house(s, marks, "night", "wide") },
  "wide-sofa": { shape: "wide", play: (s, marks) => sofa(s, marks, "wide") },
  "wide-ride": { shape: "wide", play: (s, marks) => ride(s, marks, "wide") },
  morning: { shape: "phone", play: morning },
  "tall-day": { shape: "tall", play: (s, marks) => house(s, marks, "day", "tall") },
  "tall-night": { shape: "tall", play: (s, marks) => house(s, marks, "night", "tall") },
  "tall-sofa": { shape: "tall", play: (s, marks) => sofa(s, marks, "tall") },
  "tall-ride": { shape: "tall", play: (s, marks) => ride(s, marks, "tall") },
  "wide-makoko": { shape: "wide", life: "water", play: (s, marks) => makoko(s, marks, "wide") },
  "tall-makoko": { shape: "tall", life: "water", play: (s, marks) => makoko(s, marks, "tall") },
};

async function main(): Promise<void> {
  const options = parse(process.argv.slice(2));
  // A session is wanted when it or one of the clips it makes is named (tall-street comes from the tall-ride session).
  const wanted = (name: string) => options.only.length === 0 || options.only.includes(name) || ALL_CLIPS.some((clip) => clip.session === name && options.only.includes(clip.name));
  const server = await devServer(options.port);
  const base = `http://localhost:${String(options.port)}`;
  // The GPU through Metal where there is one; the scene is drawn at a phone's pace, not the software renderer's.
  const gpu = ["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"];
  // One browser open at a time, started at the scale its sessions need (the phone's own browser takes no forced scale); a
  // session of another shape closes it and starts the next, so a small machine never holds two.
  const open: { scale: number | null; browser: Browser | null } = { scale: null, browser: null };
  const browserFor = async (shape: Shape): Promise<Browser> => {
    const scale = shape === "wide" ? WIDE.deviceScaleFactor : shape === "tall" ? TALL.deviceScaleFactor : null;
    if (open.browser !== null && open.scale === scale) return open.browser;
    await open.browser?.close();
    open.browser = await chromium.launch({ args: scale === null ? gpu : [...gpu, `--force-device-scale-factor=${String(scale)}`] });
    open.scale = scale;
    return open.browser;
  };
  mkdirSync(WORK, { recursive: true });
  const marks: Marks = {};
  const cut = async (name: SessionName, s: Session) => {
    const frames = await s.stop();
    await s.context.close();
    for (const clip of ALL_CLIPS.filter((one) => one.session === name)) {
      const mark = marks[clip.name];
      if (mark === undefined) {
        console.log(`teaser:record: no marks for ${clip.name}`);
        continue;
      }
      const seconds = cutClip(frames, mark[0], mark[1], join(OUT, clip.file), FFMPEG, clip.shape === "tall" ? TALL_CROP : undefined);
      console.log(`teaser:record: ${clip.file} ${seconds.toFixed(1)} s`);
    }
  };
  try {
    // Each life's door is played once and kept in the work folder, so a session recorded again starts from the same life.
    const lives: Partial<Record<Life, Kept>> = {};
    const keptOf = async (life: Life): Promise<Kept> => {
      const known = lives[life];
      if (known !== undefined) return known;
      const path = join(WORK, LIVES[life].kept);
      const doorWanted = life === "nurse" && wanted("door");
      let kept = !doorWanted && existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Kept) : null;
      if (kept === null) {
        const s = await session(await browserFor("phone"), base, `door-${life}`, null, "phone");
        kept = await door(s, life);
        writeFileSync(path, JSON.stringify(kept));
        await cut("door", s);
      }
      lives[life] = kept;
      return kept;
    };
    if (wanted("door")) await keptOf("nurse");
    if (wanted("stills")) await stills(await browserFor("phone"), base, await keptOf("nurse"));
    for (const [name, { shape, life, play }] of Object.entries(SESSIONS) as [Exclude<SessionName, "door">, (typeof SESSIONS)[keyof typeof SESSIONS]][]) {
      if (!wanted(name)) continue;
      const kept = await keptOf(life ?? "nurse");
      const s = await session(await browserFor(shape), base, name, kept, shape);
      try {
        await play(s, marks);
      } catch (error) {
        console.log(`teaser:record: ${name} stopped: ${String(error).split("\n")[0] ?? ""}`);
        await s.page.screenshot({ path: join(WORK, `${name}-stopped.png`) }).catch(() => undefined);
      }
      await cut(name, s);
    }
  } finally {
    await open.browser?.close();
    server?.kill();
    if (options.only.length === 0) rmSync(WORK, { recursive: true, force: true });
  }
}

await main();
