// The street kiosk in the world, online and offline (docs/rules/lottery.md R-LOTTERY-001; world.md R-WORLD-005,
// R-WORLD-006), with the city and the kiosk's sheet composed as the shell composes them: on Bode Thomas Street, the
// kiosk's act opens the Friday draw's sheet while the world runs the draw, and the luck kiosk's slip while it does not. The place file is the one the game ships; the scene is a stand-in that
// offers each thing's acts as buttons, as a tap on the thing does once the character has walked to it.
import { readFileSync } from "node:fs";
import { worldClockAt } from "@japacity/sim";
import { join } from "node:path";

import type { World } from "@japacity/sim";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { GameProvider } from "./authority/GameProvider";
import { createGameStore, type GameStore } from "./authority/store";
import "./shared/testing/render";
import { formatMoney } from "./shared/words/format";
import { say } from "./shared/words/text";
import { City } from "./features/city/City";
import { KIOSK, kioskOnline, opensKiosk, withKiosk } from "./features/city/kiosk";
import { stageOf, type PlaceFile } from "./features/city/placeFile";
import { stagedNow, thingsNow, thingsOf } from "./features/city/things";
import { KioskSheet } from "./features/lottery/KioskSheet";
import { drawOf, onlineLife, tuning } from "./features/lottery/lottery.testing";

// The scene is the stand-in that opens a tapped thing's fan beside it and walks at once (R-WORLD-034).
vi.mock("./features/city/CityScene", async () => ({ default: (await import("./features/city/fan/fan.testing")).StandInScene }));

// The place files the game ships, read from the disk in place of the server.
vi.mock("./shared/three/manifest", async (original) => {
  const real = await original<typeof import("./shared/three/manifest")>();
  const fs = await import("node:fs");
  const path = await import("node:path");
  const assets = path.join(import.meta.dirname, "..", "public", "assets");
  return {
    ...real,
    loadManifest: () => Promise.resolve({ files: {} }),
    loadJson: (_manifest: unknown, under: string) => {
      const file = path.join(assets, under);
      return Promise.resolve(fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as unknown) : null);
    },
  };
});

const BODE_THOMAS = "place.bode-thomas";
const STREET = JSON.parse(readFileSync(join(import.meta.dirname, "..", "public", "assets", "places", "bode-thomas-front", "place.json"), "utf8")) as PlaceFile;

beforeEach(() => {
  // The city draws its place only where the device can (City.tsx canDraw); the scene itself is the stand-in above.
  Object.defineProperty(window, "WebGL2RenderingContext", { value: class {}, configurable: true });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({}) as never);
  window.localStorage.setItem("japacity.city.last", JSON.stringify([BODE_THOMAS]));
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "WebGL2RenderingContext");
  window.localStorage.clear();
});

/** Tunde on Bode Thomas Street in the world, with the world running `lottery` (null: no draw, offline play). */
async function onTheStreet(lottery: World["lottery"]): Promise<{ store: GameStore; life: ReturnType<typeof onlineLife> }> {
  const life = onlineLife(lottery);
  const store = createGameStore(life.authority);
  await store.getState().refresh();
  store.getState().heard({ kind: "clock", clock: { tick: 10, nextTickAt: Date.now() + 3_600_000, nextTurnAt: null, morningAt: 0, world: worldClockAt(0) } });
  render(
    <GameProvider store={store}>
      <City world results={() => <p />} kiosk={(close, label) => <KioskSheet open onClose={close} label={label} load={null} />} />
    </GameProvider>,
  );
  return { store, life };
}

/** The kiosk tapped on the street once the place is drawn, and its act on its fan (R-WORLD-034). */
async function tapKiosk(): Promise<void> {
  fireEvent.click(await waitFor(() => {
    const found = document.querySelector<HTMLElement>('[data-stand-in-thing="kiosk"]');
    if (found === null) throw new Error("The kiosk is not on the street.");
    return found;
  }));
  const act = await waitFor(() => {
    const found = document.querySelector<HTMLElement>('[data-fan="kiosk"] [data-fan-act] button');
    if (found === null) throw new Error("The kiosk offers no act.");
    return found;
  });
  fireEvent.click(act);
}

describe("the street kiosk while the world runs the Friday draw", () => {
  test("[R-LOTTERY-001] [R-WORLD-005] given the world online, when the kiosk is tapped, then its sheet sells the Friday draw and its one button sends lottery/buy with the count", async () => {
    const { store, life } = await onTheStreet(drawOf());
    // The offline act is not allowed online, yet the kiosk keeps its act and its name.
    expect(store.getState().view?.activities.find((option) => option.id === KIOSK)?.allowed ?? false).toBe(false);
    await tapKiosk();
    const sheet = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-world-sheet="kiosk"]');
      if (found === null) throw new Error("The kiosk's sheet is not up.");
      return found;
    });
    expect(document.querySelector("[data-ask-form]")).toBeNull();
    const kiosk = within(sheet);
    expect(kiosk.getByText(say("ui.lottery.title"))).toBeDefined();
    expect(sheet.querySelector("[data-lottery-jackpot]")?.textContent).toContain(formatMoney(tuning.odds.jackpotStart, "NGN"));
    expect(kiosk.getByText(say("ui.lottery.price", { price: formatMoney(tuning.ticket, "NGN"), max: tuning.maxTickets }))).toBeDefined();
    expect(sheet.querySelector("[data-lottery-close]")).not.toBeNull();
    // R-WORLD-006: the odds, the seal and the last draw fold behind a tap on a row, not on the sheet's face.
    expect(sheet.querySelector("[data-lottery-odds]")).toBeNull();
    expect(sheet.querySelector("[data-lottery-fingerprint]")).toBeNull();
    fireEvent.click(within(sheet.querySelector<HTMLElement>('[data-kiosk-fold="odds"]')!).getByRole("button"));
    expect(sheet.querySelector("[data-lottery-odds]")).not.toBeNull();

    fireEvent.click(kiosk.getByRole("button", { name: say("ui.lottery.more") }));
    const buy = sheet.ownerDocument.querySelector<HTMLButtonElement>("[data-kiosk-buy]");
    // R-WORLD-006: the button says the act and its price; under it the band's naira before, struck, and after.
    expect(buy?.textContent).toBe(say("ui.act.priced", { act: say("ui.lottery.kiosk.buy", { count: 2 }), price: formatMoney(2 * tuning.ticket, "NGN") }));
    const naira = (store.getState().view?.pockets.NGN.bank ?? 0) + (store.getState().view?.pockets.NGN.cash ?? 0);
    expect(sheet.ownerDocument.querySelector("[data-balance-before]")?.textContent).toBe(formatMoney(naira, "NGN"));
    expect(sheet.ownerDocument.querySelector("[data-balance-after]")?.textContent).toBe(formatMoney(naira - 2 * tuning.ticket, "NGN"));
    await act(async () => {
      buy?.click();
      await Promise.resolve();
    });
    await waitFor(() => expect(store.getState().view?.lottery?.tickets).toBe(2));
    expect(life.authority.sent.at(-1)).toMatchObject({ type: "lottery/buy", tickets: 2 });
    expect(life.authority.sent.some((command) => command.type === "activity/now")).toBe(false);
    expect(sheet.querySelector("[data-lottery-held]")?.getAttribute("data-lottery-held")).toBe("2");
  });

  test("[R-LOTTERY-001] [R-WORLD-005] given the world offline, when the kiosk is tapped, then its slip is the luck kiosk's now-act", async () => {
    const { store, life } = await onTheStreet(null);
    expect(store.getState().view?.activities.find((option) => option.id === KIOSK)?.allowed).toBe(true);
    await tapKiosk();
    const slip = await waitFor(() => {
      const found = document.querySelector<HTMLElement>("[data-ask-form=slip]");
      if (found === null) throw new Error("The kiosk's slip is not up.");
      return found;
    });
    expect(document.querySelector('[data-world-sheet="kiosk"]')).toBeNull();
    await act(async () => {
      within(slip).getByRole("button", { name: /Buy a ticket|Play/ }).click();
      await Promise.resolve();
    });
    await waitFor(() => expect(life.authority.sent.at(-1)).toMatchObject({ type: "activity/now", activity: KIOSK, param: "1" }));
    expect(life.authority.sent.some((command) => command.type === "lottery/buy")).toBe(false);
    expect(screen.queryByText(say("ui.lottery.title"))).toBeNull();
  });

  test("[R-LOTTERY-001] given a view that still lists the offline act as allowed while the world runs the draw, when the kiosk's act is read, then it opens the online sheet only", () => {
    const online = { lottery: onlineLife(drawOf()).game.view().lottery };
    expect(kioskOnline(online)).toBe(true);
    expect(opensKiosk(KIOSK, online)).toBe(true);
    expect(opensKiosk(KIOSK, { lottery: null })).toBe(false);
    expect(opensKiosk("activity.bet-slip", online)).toBe(false);
    // The kiosk keeps its act online however the view lists the offline one, and offline only as the view allows it.
    const street = thingsOf(stageOf(STREET));
    const kioskActs = (offered: string[]) => thingsNow(street, stagedNow(new Set(offered), new Set([KIOSK]), new Set(), null)).find((thing) => thing.id === "kiosk")?.acts.map((one) => one.stages);
    expect(kioskActs(withKiosk([], online))).toEqual([KIOSK]);
    expect(kioskActs(withKiosk([KIOSK], online))).toEqual([KIOSK]);
    expect(withKiosk([KIOSK], online)).toEqual([KIOSK]);
    expect(kioskActs(withKiosk([], { lottery: null }))).toBeUndefined();
    expect(kioskActs(withKiosk([KIOSK], { lottery: null }))).toEqual([KIOSK]);
  });
});
