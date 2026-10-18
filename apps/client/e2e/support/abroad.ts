// A life landed abroad in a real browser (docs/rules/world.md R-WORLD-038, R-WORLD-039): no recorded life flies
// to Dubai or Castel Volturno yet, so the life is played here by the sweep's own simulated player on the real content, to
// the country and a little past it, and kept as the save the browser opens, as the recorded lives are made
// (tools/record-lives.ts). Then the map, the ride sheet and the things are used as a player would.
import type { Currency, FlatSave, Id } from "@japacity/sim";
import { lastSegment, lifeStart, savedCommands } from "@japacity/sim";
import { runLife, type StrategyName } from "@japacity/sim/testing";
import type { Page } from "@playwright/test";

import { content } from "../../../../packages/content/src/index";
import { passCards } from "./live";

/** The city's probe; only its place and readiness are read here. */
type CityProbe = { ready?: boolean; place?: string } | undefined;

export interface AbroadLife {
  strategy: StrategyName;
  life: Id<"scenario">;
  seed: string;
  /** The country the life lands in. */
  country: Id<"country">;
  /** The country's money, and how much of it (in its smallest unit) the life holds before the save is kept. */
  money: Currency;
  holding: number;
}

/**
 * The sweep's player on the real content with the goldens' world, stopped once the life is in the country with the money
 * asked for in hand, kept as the save the browser opens. Throws if the seed does not land there.
 */
export function lifeIn(want: AbroadLife): string {
  const { game } = runLife(want.strategy, want.life, want.seed, content, {
    months: 72,
    worldSeed: "golden-world",
    keepSave: true,
    stopWhen: (played) => {
      const view = played.view();
      const pocket = view.pockets[want.money];
      return view.place.where === "abroad" && pocket.bank + pocket.cash >= want.holding;
    },
  });
  const view = game.view();
  if (view.place.where !== "abroad" || view.place.country !== want.country) throw new Error(`${want.seed} no longer lands in ${want.country}: ${view.place.where} ${String(view.place.country)}.`);
  const begun = lifeStart(game.save);
  if (begun === null) throw new Error("A played life starts from its scenario.");
  const save: FlatSave = { schema: 2, content: lastSegment(game.save).content, ...begun, commands: savedCommands(game.save) };
  return JSON.stringify({ save, clock: { anchor: 0 } });
}

/** The money in the band, as whole units of the country's currency. */
export async function money(page: Page): Promise<number> {
  const said = (await page.locator("[data-band] [data-band-money]").first().textContent()) ?? "";
  return Number(said.replace(/[^\d]/g, ""));
}

/** Every card over the world passed, and an act's own line put away by its Done. */
export async function clear(page: Page): Promise<void> {
  for (let round = 0; round < 3; round += 1) {
    const done = page.getByRole("dialog").getByRole("button", { name: "Done", exact: true });
    if (await done.first().isVisible().catch(() => false)) await done.first().click();
    // A moment's share card over the world (the first pay abroad, R-SHARE-001): closed, or put away by its scrim.
    const share = page.getByRole("dialog").filter({ has: page.locator("[data-share-card]") }).first();
    if (await share.isVisible().catch(() => false)) {
      const close = share.getByRole("button", { name: "Close", exact: true });
      if (await close.isVisible().catch(() => false)) await close.click();
      else await share.locator("[data-card-scrim]").click({ position: { x: 8, y: 8 } });
      await share.waitFor({ state: "detached", timeout: 5000 }).catch(() => undefined);
    }
    await passCards(page);
    const teach = page.locator("[data-home-teach-ok]");
    if (await teach.isVisible().catch(() => false)) await teach.click();
    await page.waitForTimeout(300);
  }
}

/** The map opened on the country's painted paper, a stop picked from the list kept for a screen reader, and its ride sheet. */
export async function pickStop(page: Page, stop: string): Promise<void> {
  await page.locator('[data-thumb="map"]').click();
  await page.waitForFunction(() => (window as unknown as { __map?: { ready?: boolean } }).__map?.ready === true, null, { timeout: 60_000 });
  await page.locator(`[data-stop="${stop}"]`).waitFor({ state: "attached", timeout: 20_000 });
  await page.evaluate((id) => document.querySelector<HTMLButtonElement>(`[data-stop="${id}"]`)?.click(), stop);
  await page.locator(`[data-ride-sheet="${stop}"]`).waitFor({ timeout: 10_000 });
}

/** A way chosen on the ride sheet and taken, the vehicle it plays in read as it plays; the place opens once the ride is over. */
export async function rideBy(page: Page, stop: string, way: string): Promise<string | null> {
  await page.locator(`[data-ride-sheet="${stop}"] [data-way="${way}"]`).click();
  await page.locator(`[data-ride-sheet="${stop}"] [data-ride-main]`).click();
  const vehicle = await page
    .locator("[data-ride]")
    .first()
    .getAttribute("data-ride-vehicle", { timeout: 10_000 })
    .catch(() => null);
  await page.waitForFunction((id) => {
    const city = (window as unknown as { __city?: CityProbe }).__city;
    return city?.place === id && city.ready === true;
  }, stop, { timeout: 120_000 });
  await clear(page);
  return vehicle;
}

/** Where the life stands now, from the city's probe. */
export async function standing(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as { __city?: CityProbe }).__city?.place ?? "");
}
