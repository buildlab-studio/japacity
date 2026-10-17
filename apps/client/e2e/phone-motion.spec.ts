// The phone's grow, shrink and putting away in a real browser at phone size (docs/rules/world.md R-WORLD-018, R-WORLD-023),
// so each reads as one smooth expand. Each is one move of transform and opacity: the handset is laid out once at its new size and never again in flight, the band and the scene under it
// never move, and the frame's middle and size go one way only from start to end, so nothing zig-zags. With PREVIEW_DIR
// set, each motion is also saved as frames every 40 ms, held still on the motion's own clock, and as one strip of them.
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { startReadyLife } from "./door";
import { passCards } from "./live";

const PREVIEW = process.env.PREVIEW_DIR;
/** Every 40 ms over the grow and the screen's fade after it, the longest of the three (Phone.tsx GROW_MS + SCREEN_FADE_MS). */
const FRAMES_MS = [0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400];
const AWAY_FRAMES_MS = [0, 40, 80, 120, 160, 200];
/** The frame's flight on the real clock (Phone.tsx GROW_MS). */
const GROW_MS = 250;
/** What a motion may change (R-WORLD-023). */
const COMPOSITOR = ["opacity", "transform"];

test.use({ launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Sample {
  /** The handset's layout box: offsets, which no transform changes. */
  laid: Box;
  /** Where the handset is drawn, transform and all. */
  drawn: Box;
  band: Box;
  scene: Box;
  screenOpacity: number;
}

declare global {
  interface Window {
    __motion?: Animation[];
  }
}

/** Taps a control inside the page and holds every motion that starts on its first frame, so it can be stepped through. */
async function startHeld(page: Page, selector: string): Promise<string[]> {
  return page.evaluate(async (target) => {
    const control = document.querySelector<HTMLElement>(target);
    const phone = document.querySelector("[data-phone]");
    if (control === null || phone === null) throw new Error(`No ${target}`);
    const was = `${String(phone.getAttribute("data-grown"))} ${String(phone.getAttribute("data-away"))}`;
    control.click();
    // React applies the tap within a task or two; then read a box so every transition it set off exists.
    for (let wait = 0; wait < 20 && `${String(phone.getAttribute("data-grown"))} ${String(phone.getAttribute("data-away"))}` === was; wait += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    document.querySelector<HTMLElement>("[data-handset]")?.getBoundingClientRect();
    // Hold every motion running inside the phone; one that finished before the tap (the rise, the icons' pop) is left be.
    const held = document.getAnimations().filter((animation) => {
      const target = (animation.effect as KeyframeEffect | null)?.target;
      return animation.playState === "running" && target instanceof Element && phone.contains(target);
    });
    for (const animation of held) animation.pause();
    window.__motion = held;
    // What each held motion changes: a transition names its property; an animation, its keyframes' properties.
    return held.flatMap((animation) =>
      animation instanceof CSSTransition
        ? [animation.transitionProperty]
        : ((animation.effect as KeyframeEffect).getKeyframes().flatMap((frame) => Object.keys(frame).filter((key) => !["offset", "computedOffset", "easing", "composite"].includes(key)))),
    );
  }, selector);
}

/** Steps every held motion to `ms` after it began and reads the boxes. */
async function sampleAt(page: Page, ms: number): Promise<Sample> {
  return page.evaluate((at) => {
    for (const animation of window.__motion ?? []) animation.currentTime = at;
    const box = (element: Element | null): Box => {
      const rect = element?.getBoundingClientRect();
      return { x: rect?.x ?? 0, y: rect?.y ?? 0, width: rect?.width ?? 0, height: rect?.height ?? 0 };
    };
    const handset = document.querySelector<HTMLElement>("[data-handset]");
    const screen = document.querySelector("[data-phone-screen]");
    return {
      laid: { x: handset?.offsetLeft ?? 0, y: handset?.offsetTop ?? 0, width: handset?.offsetWidth ?? 0, height: handset?.offsetHeight ?? 0 },
      drawn: box(handset),
      band: box(document.querySelector("[data-band]")),
      scene: box(document.querySelector("[data-scene]")),
      screenOpacity: screen === null ? 1 : Number(getComputedStyle(screen).opacity),
    };
  }, ms);
}

/** Lets the held motions run out. */
async function release(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const animation of window.__motion ?? []) animation.finish();
    window.__motion = [];
  });
}

/** True when the values only rise or only fall from first to last, give or take a pixel. */
function oneWay(values: readonly number[]): boolean {
  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  const sign = Math.sign(last - first);
  return values.every((value, index) => index === 0 || sign * (value - (values[index - 1] ?? value)) >= -1);
}

const middleX = (box: Box) => box.x + box.width / 2;
const middleY = (box: Box) => box.y + box.height / 2;

/** Saves the frames under PREVIEW_DIR, one picture each and one strip of them all with the time under each. */
async function frames(page: Page, name: string, times: readonly number[]): Promise<void> {
  if (PREVIEW === undefined || PREVIEW === "") return;
  const shots: string[] = [];
  for (const ms of times) {
    await sampleAt(page, ms);
    const shot = await page.screenshot({ path: join(PREVIEW, `${name}-${String(ms).padStart(3, "0")}ms.png`) });
    shots.push(shot.toString("base64"));
  }
  const strip = await page.context().newPage();
  await strip.setViewportSize({ width: 200 * Math.min(times.length, 6), height: 460 * Math.ceil(times.length / 6) });
  await strip.setContent(
    `<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(6,200px);font:600 13px system-ui;color:#eee">${shots
      .map((shot, index) => `<figure style="margin:0;padding:4px;text-align:center"><img style="width:192px;display:block" src="data:image/png;base64,${shot}"><figcaption>${String(times[index])} ms</figcaption></figure>`)
      .join("")}</body>`,
  );
  await strip.screenshot({ path: join(PREVIEW, `${name}-strip.png`), fullPage: true });
  await strip.close();
}

/** Every motion has finished. */
async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== "running"), null, { timeout: 5_000 });
}

/** Opens the phone over a ready life; gives the world's boxes as they stood before it opened. */
async function openPhone(page: Page): Promise<Sample> {
  await page.setViewportSize({ width: 412, height: 839 });
  await page.goto("/?world");
  await startReadyLife(page);
  await expect(page.locator("[data-band]")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => window.__city?.ready === true, null, { timeout: 60_000 }).catch(() => undefined);
  await passCards(page);
  await settled(page);
  const world = await sampleAt(page, 0);
  await page.locator('[data-thumb="phone"]').click();
  await expect(page.locator("[data-phone]")).toBeVisible();
  await settled(page);
  return world;
}

test("[R-WORLD-018] [R-WORLD-023] the phone grows and shrinks as one transform: only transform and opacity move, it is laid out once, the band and the scene stay put, and its middle and size go one way", async ({ page }, info) => {
  test.skip(!info.project.name.startsWith("Pixel"), "phone size only");
  test.setTimeout(150_000);
  await openPhone(page);
  const handset = page.locator("[data-handset]");
  const transitions = await handset.evaluate((element) => getComputedStyle(element).transitionProperty);
  expect(transitions.split(",").map((each) => each.trim())).toEqual(["transform"]);
  const before = await sampleAt(page, 0);

  for (const [name, control, grown] of [
    ["phone-grow", "[data-grow]", "true"],
    ["phone-shrink", "[data-grow]", "false"],
  ] as const) {
    const moved = await startHeld(page, control);
    expect(moved.length).toBeGreaterThan(0);
    expect([...new Set(moved)].filter((property) => !COMPOSITOR.includes(property))).toEqual([]);
    const samples: Sample[] = [];
    for (const ms of FRAMES_MS) samples.push(await sampleAt(page, ms));
    // Laid out once at its new size: no frame in flight lays the handset out again.
    expect(new Set(samples.map((sample) => JSON.stringify(sample.laid))).size).toBe(1);
    // The layout under it never moves.
    for (const sample of samples) {
      expect(sample.band).toEqual(before.band);
      expect(sample.scene).toEqual(before.scene);
    }
    // One expand, no zig-zag: the drawn frame's middle and size each go one way only.
    const drawn = samples.map((sample) => sample.drawn);
    expect(oneWay(drawn.map(middleX))).toBe(true);
    expect(oneWay(drawn.map(middleY))).toBe(true);
    expect(oneWay(drawn.map((box) => box.width))).toBe(true);
    expect(oneWay(drawn.map((box) => box.height))).toBe(true);
    // It starts where it stood and the content waits for the frame to land, then fades in.
    expect(samples[0]?.screenOpacity).toBe(0);
    expect(samples.find((_, index) => FRAMES_MS[index] === 240)?.screenOpacity).toBe(0);
    expect(samples[samples.length - 1]?.screenOpacity).toBe(1);
    await frames(page, name, FRAMES_MS);
    await release(page);
    await expect(page.locator("[data-phone]")).toHaveAttribute("data-grown", grown);
    await settled(page);
    // A tap while the frame flies waits for its landing (Phone.tsx useGrow), and the held frames above may take less real time than the flight.
    await page.waitForTimeout(GROW_MS + 50);
    const after = await sampleAt(page, 0);
    expect(after.band).toEqual(before.band);
    expect(after.scene).toEqual(before.scene);
  }
  // Back at rest it stands where it stood before the grow.
  const rest = await sampleAt(page, 0);
  expect(rest.laid).toEqual(before.laid);
});

test("[R-WORLD-023] the phone is put away by transform and opacity only, and the band and the scene stay put", async ({ page }, info) => {
  test.skip(!info.project.name.startsWith("Pixel"), "phone size only");
  test.setTimeout(150_000);
  const world = await openPhone(page);
  const before = await sampleAt(page, 0);
  const moved = await startHeld(page, "[data-home-bar]");
  expect(moved.length).toBeGreaterThan(0);
  expect([...new Set(moved)].filter((property) => !COMPOSITOR.includes(property))).toEqual([]);
  const samples: Sample[] = [];
  for (const ms of AWAY_FRAMES_MS) samples.push(await sampleAt(page, ms));
  expect(new Set(samples.map((sample) => JSON.stringify(sample.laid))).size).toBe(1);
  for (const sample of samples) {
    expect(sample.band).toEqual(before.band);
    expect(sample.scene).toEqual(before.scene);
  }
  expect(oneWay(samples.map((sample) => middleY(sample.drawn)))).toBe(true);
  await frames(page, "phone-away", AWAY_FRAMES_MS);
  await release(page);
  await expect(page.locator("[data-phone]")).toHaveCount(0);
  // Gone, the world stands as it stood before the phone opened (the nudge line under the band is back with it).
  await settled(page);
  const after = await sampleAt(page, 0);
  expect(after.band).toEqual(world.band);
  expect(after.scene).toEqual(world.scene);
});
