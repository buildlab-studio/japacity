// The share card in a real browser on a phone (docs/rules/share.md): Ada's
// recorded life boards the plane, the send-off card opens, and the player
// saves it as a file where the browser has no share sheet.
import { readFileSync } from "node:fs";

import { devices, expect, test, type Page } from "@playwright/test";

// The recorded lives and the tuning are the simulation's and the content's own data.
import { content, text } from "../../../packages/content/src/index";
import { lifeSaves } from "../../../packages/sim/src/goldens/lives.data";

// A device's browser type can be chosen only by the project; the rest of the profile applies here.
const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["Pixel 7"];
test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

/** Ada's recorded life up to the month before she flies. */
function adaBeforeFlight(): string {
  const save = lifeSaves["ada-careful"];
  if (save === undefined) throw new Error("No recorded life ada-careful.");
  return JSON.stringify({ save: { ...save, commands: save.commands.slice(0, -1) }, clock: { anchor: 0 } });
}

/** The pixel size in a JPEG's frame header. */
function jpegSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let at = 2;
  while (at + 9 < bytes.length) {
    const marker = bytes[at + 1]!;
    const length = bytes.readUInt16BE(at + 2);
    if (marker >= 0xc0 && marker <= 0xc2) return { height: bytes.readUInt16BE(at + 5), width: bytes.readUInt16BE(at + 7) };
    at += 2 + length;
  }
  return null;
}

/**
 * R-SHARE-001: the recorded life loads in the month after its decision day, so
 * the granted card is still due and opens over the page first; it is closed.
 */
async function closeGranted(page: Page): Promise<void> {
  const granted = page.getByRole("dialog", { name: text["share.granted.title"] ?? "share.granted.title" });
  await expect(granted).toBeVisible();
  await expect(granted.locator("[data-share-card='granted']")).toBeVisible();
  await granted.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function flyAda(page: Page, withShareSheet: boolean): Promise<void> {
  await page.addInitScript(
    ({ stored, sheet }) => {
      if (sessionStorage.getItem("seeded") === null) {
        localStorage.setItem("japacity.save", stored);
        sessionStorage.setItem("seeded", "1");
      }
      if (!sheet) {
        Reflect.deleteProperty(Navigator.prototype, "canShare");
        Reflect.deleteProperty(Navigator.prototype, "share");
      }
    },
    { stored: adaBeforeFlight(), sheet: withShareSheet },
  );
  await page.goto("/?classic");
  await closeGranted(page);
  const tabs = page.getByRole("navigation", { name: "Sections" });
  if (await tabs.isVisible()) await tabs.getByRole("button", { name: "Japa" }).click();
  await page.getByRole("button", { name: "Board the plane" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Carry on" }).click();
}

test("[R-SHARE-009] [R-CHAPTER-006] a recorded life's send-off card is saved on a phone as a JPEG at the card's size and under its limit", async ({ page }) => {
  await flyAda(page, false);
  const sheet = page.getByRole("dialog");
  const card = sheet.locator("[data-share-card='send-off']");
  await expect(card).toBeVisible();
  await expect(card.getByText("Japacity is a game.")).toBeVisible();
  await expect(card.getByText("Ada", { exact: true })).toBeVisible();

  const download = page.waitForEvent("download");
  await sheet.getByRole("button", { name: "Save the card" }).click();
  const saved = await download;
  expect(saved.suggestedFilename()).toBe("japacity-send-off.jpg");
  const bytes = readFileSync(await saved.path());
  expect(bytes.length).toBeLessThan(content.tuning.share.maxBytes);
  expect(jpegSize(bytes)).toEqual({ width: content.tuning.share.width, height: content.tuning.share.height });
  await expect(sheet.getByText("Saved to your downloads.")).toBeVisible();

  // R-SHARE-011: closed, the card goes to the gallery on this device, newest first, after the granted card closed on load.
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem("japacity.cards") ?? "[]") as { card: { kind: string } }[]);
  expect(kept.map((entry) => entry.card.kind)).toEqual(["send-off", "granted"]);
});

test("[R-SHARE-003] a phone with a share sheet gets the card only when the player taps", async ({ page }) => {
  await page.addInitScript(() => {
    const shared: unknown[] = [];
    Object.assign(window, { shared });
    Object.defineProperty(Navigator.prototype, "canShare", { configurable: true, value: () => true });
    Object.defineProperty(Navigator.prototype, "share", {
      configurable: true,
      value: (data: ShareData) => {
        shared.push({ url: data.url, files: data.files?.map((file) => ({ name: file.name, type: file.type, size: file.size })) });
        return Promise.resolve();
      },
    });
  });
  await flyAda(page, true);
  const sheet = page.getByRole("dialog");
  await expect(sheet.locator("[data-share-card='send-off']")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { shared: unknown[] }).shared.length)).toBe(0);
  await sheet.getByRole("button", { name: "Share the card" }).click();
  await expect(sheet.getByText("Sent to the app you picked.")).toBeVisible();
  const shared = await page.evaluate(() => (window as unknown as { shared: { url: string; files: { name: string; type: string; size: number }[] }[] }).shared);
  expect(shared).toHaveLength(1);
  expect(shared[0]?.url).toBe("https://japacity.com/?card=send-off");
  expect(shared[0]?.files[0]?.type).toBe("image/jpeg");
});

test("[R-SHARE-012] [R-SHARE-010] the official accounts page and the link previews are served as fixed files", async ({ page, request }) => {
  await page.goto("/official/index.html");
  await expect(page.getByRole("heading", { name: "Official accounts" })).toBeVisible();
  await expect(page.getByRole("link", { name: "japacity.com", exact: true })).toBeVisible();
  await expect(page.getByText("We never ask you for money.")).toBeVisible();
  const preview = await request.get("/share/send-off.jpg");
  expect(preview.ok()).toBe(true);
  expect(jpegSize(await preview.body())).toEqual({ width: content.tuning.share.previewWidth, height: content.tuning.share.previewHeight });
});
