// The fan in the city (docs/design/13-the-lively-layer.md section 3; docs/rules/world.md R-WORLD-005, R-WORLD-006,
// R-WORLD-010, R-WORLD-034): a tap on any thing fans its acts out of the thing; a button of the simulation's acts done at
// once sends the act the sheet would send, once the walk has reached the thing; a pose, Sleep, a card or a command is
// handed to the walk and done on arrival as its kind does; a thing with no room beside it opens the sheet; the chip is
// gone. The place file is the one the game ships; the scene is a stand-in that hands the city the taps, says where the
// fanned thing stands, and walks at once.
import { act, fireEvent, waitFor } from "@testing-library/react";
import { setPockets } from "@japacity/sim/testing";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { newGame, openOffer } from "../../shared/testing/fixtures";
import { renderWithGame } from "../../shared/testing/person";
import { formatMoney } from "../../shared/words/format";
import { say } from "../../shared/words/text";
import type { Act, Thing } from "../../shared/world/contract";
import { linesNow, murmur, NEAR_SPEAKER, resetLines } from "../../shared/world/Lines";
import { markTaught } from "../../shared/world/taught";
import { City } from "./City";
import { anchorFan } from "./fan/anchor";
import { sceneWords } from "./scene.words";
import { stubWebGL, unstubWebGL } from "../../shared/testing/webgl";
import { found } from "../../shared/testing/render";

type Pick = { kind: "thing"; thing: Thing } | { kind: "act"; thing: Thing; act: Act };

interface StandInProps {
  things?: Thing[];
  actOn?: { thing: Thing; act: Act; at: number } | null;
  onPick: (pick: Pick) => void;
}

/** What the scene was handed to walk for, each with the pose it takes on arrival: `thing:act:pose`. */
const handed: string[] = [];

function StandInScene({ things, actOn = null, onPick }: StandInProps) {
  // The walk is instant here: the act follows the fan's tap at once, as it would on arrival (R-WORLD-010).
  useEffect(() => {
    if (actOn === null) return;
    handed.push(`${actOn.thing.id}:${actOn.act.id}:${actOn.act.pose ?? ""}`);
    onPick({ kind: "act", thing: actOn.thing, act: actOn.act });
  }, [actOn]);
  return (
    <div data-stand-in-scene>
      {(things ?? []).map((thing) => (
        <button key={thing.id} type="button" data-stand-in-thing={thing.id} onClick={() => onPick({ kind: "thing", thing })} />
      ))}
    </div>
  );
}

vi.mock("./scene/CityScene", () => ({ default: StandInScene }));

// The place files the game ships, read from the disk in place of the server.
vi.mock("../../shared/three/manifest", async (original) => (await import("../../shared/testing/manifest")).fromDisk(original));

const SCREEN = { width: window.innerWidth, height: window.innerHeight };

beforeEach(() => {
  handed.length = 0;
  stubWebGL();
  window.localStorage.setItem("japacity.city.last", JSON.stringify(["place.family-house"]));
  // A phone held upright, as the game is built for.
  Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 844, configurable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
  unstubWebGL();
  Object.defineProperty(window, "innerWidth", { value: SCREEN.width, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: SCREEN.height, configurable: true });
});

const COOK = "activity.cook-at-home";
const JOLLOF = "activity.cook-jollof";

/** Ada in the parlour: a new life, its pockets set first when asked. */
async function inTheParlour(before: (game: ReturnType<typeof newGame>) => void = () => undefined) {
  const game = newGame("scenario.ada");
  before(game);
  // The first brief was handed in an earlier visit (design page 13 section 4), so its card does not stand over the room.
  markTaught("title", game.view().scenario);
  const rendered = await renderWithGame(<City world results={(place) => <p data-results-for={place} />} />, game);
  await waitFor(() => found('[data-stand-in-thing="cooking"]'), { timeout: 3000 });
  return { game, ...rendered };
}

/** The price of a meal as the view gives it, in words. */
function priceOf(game: ReturnType<typeof newGame>, activity: string): string {
  const cost = game.view().activities.find((option) => option.id === activity)?.cost[0];
  if (cost === undefined) throw new Error(`${activity} has no price.`);
  return formatMoney(cost.amount, cost.currency);
}

/** The cooking corner tapped, and the scene saying it stands on the left of the room. */
function fanTheCookingCorner(at: { x: number; y: number } | null = { x: 90, y: 560 }): void {
  fireEvent.click(found('[data-stand-in-thing="cooking"]'));
  act(() => anchorFan("cooking", at));
}

describe("the cooking corner's fan", () => {
  test("[R-WORLD-034] [R-WORLD-005] [R-WORLD-006] [R-HOME-012] given Ada at the family house, when the cooking corner is tapped, then its two acts fan out of it, the pot free and the big pot with its price alone, no chip is asked of the scene, the nudge steps back, and while the big pot is pressed the band's counter shows what would be left", async () => {
    const { game } = await inTheParlour();
    fanTheCookingCorner();
    const fan = found('[data-fan="cooking"]');
    expect(fan.dataset.fanSide).toBe("right");
    expect([...fan.querySelectorAll<HTMLElement>("[data-fan-act]")].map((node) => node.dataset.fanAct)).toEqual([COOK, JOLLOF]);
    const cook = found(`[data-fan-act="${COOK}"]`);
    // The family house's pot is the house's: free, no balance to strike.
    expect(cook.querySelector("[data-fan-price]")?.textContent).toBe(say("ui.world.free"));
    expect(cook.querySelector("[data-balance-before]")).toBeNull();
    const pot = found(`[data-fan-act="${JOLLOF}"]`);
    expect(pot.querySelector("[data-fan-price]")?.textContent).toBe(priceOf(game, JOLLOF));
    expect(cook.textContent).toContain("Food from the pot");
    expect(pot.textContent).toContain("A big pot for the house");
    const held = game.view().pockets.NGN.bank + game.view().pockets.NGN.cash;
    // Chips earn their place (design page 13 section 2): the fan carries the price pill alone, the band's counter is the balance.
    expect(pot.querySelector("[data-balance-before], [data-balance]")).toBeNull();
    const price = game.view().activities.find((option) => option.id === JOLLOF)?.cost[0]?.amount ?? 0;
    expect(price).toBeGreaterThan(0);
    fireEvent.pointerDown(found(`[data-fan-act="${JOLLOF}"] button`));
    expect(found("[data-band-money]").dataset.bandPreview).toBe(String(held - price));
    fireEvent.pointerUp(found(`[data-fan-act="${JOLLOF}"] button`));
    expect(found("[data-band-money]").dataset.bandPreview).toBeUndefined();
    // The chip is gone (R-WORLD-034): nothing but the fan stands over the corner.
    expect(document.querySelector("[data-thing-chip]")).toBeNull();
    expect(document.querySelector("[data-nudge]")).toBeNull();
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });

  test("[R-WORLD-026] [R-WORLD-034] given someone overheard over the room, when the cooking corner's fan opens, then their words are hushed at once and do not come back when the fan closes, since the fan's title and buttons would stand on them", async () => {
    resetLines();
    await inTheParlour();
    act(() => {
      murmur("Somebody should fix that gate.", Date.now() + 60_000, "Someone in the house", NEAR_SPEAKER);
    });
    expect(linesNow().speech).not.toBeNull();
    fanTheCookingCorner();
    expect(found('[data-fan="cooking"]')).toBeTruthy();
    expect(linesNow().speech).toBeNull();
    expect(document.querySelector("[data-speech]")).toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(document.querySelector('[data-fan="cooking"]')).toBeNull());
    expect(document.querySelector("[data-speech]")).toBeNull();
    resetLines();
  });

  test("[R-WORLD-034] [R-WORLD-005] [R-WORLD-010] given the cooking corner's fan, when food from the pot is tapped, then once the walk reaches the corner the act is sent at once as its sheet would send it, and the fan closes", async () => {
    const { authority } = await inTheParlour();
    fanTheCookingCorner();
    const before = authority.sent.length;
    fireEvent.click(found(`[data-fan-act="${COOK}"] button`));
    await waitFor(() => expect(authority.sent.slice(before)).toContainEqual(expect.objectContaining({ type: "activity/now", activity: COOK, param: null })));
    await waitFor(() => expect(document.querySelector("[data-fan]")).toBeNull());
  });

  test("[R-WORLD-006] given too little naira for the big pot, when its button is tapped, then it says how much is short, shakes, and sends nothing", async () => {
    const { authority } = await inTheParlour((game) => setPockets(game, { NGN: 50_000 }));
    fanTheCookingCorner();
    const before = authority.sent.length;
    const pot = found(`[data-fan-act="${JOLLOF}"]`);
    expect(pot.dataset.fanRefused).toBe("short");
    fireEvent.click(found(`[data-fan-act="${JOLLOF}"] button`));
    expect(found(`[data-fan-act="${JOLLOF}"] button`).className).toContain("fan-shake");
    expect(authority.sent.slice(before)).toEqual([]);
  });

  test("[R-WORLD-034] [R-WORLD-005] given the cooking corner off the screen as it is tapped, when its acts would fan, then the existing sheet of its two meals opens instead", async () => {
    await inTheParlour();
    fanTheCookingCorner(null);
    await waitFor(() => expect(document.querySelector("[role=dialog]")).not.toBeNull());
    expect(document.querySelector("[data-fan]")).toBeNull();
  });

  test("[R-WORLD-034] [R-WORLD-005] given a thing in the middle of the phone with no room either side, when its acts would fan, then the sheet opens instead", async () => {
    await inTheParlour();
    fanTheCookingCorner({ x: 195, y: 420 });
    await waitFor(() => expect(document.querySelector("[role=dialog]")).not.toBeNull());
    expect(document.querySelector("[data-fan]")).toBeNull();
  });

  test("[R-WORLD-034] [R-WORLD-005] given a development build asked for ?fan=off, when the cooking corner is tapped, then the address asks for nothing: the corner fans as in every build and no chip is drawn", async () => {
    window.history.replaceState(null, "", "/?fan=off");
    await inTheParlour();
    fanTheCookingCorner();
    expect([...found('[data-fan="cooking"]').querySelectorAll<HTMLElement>("[data-fan-act]")].map((node) => node.dataset.fanAct)).toEqual([COOK, JOLLOF]);
    expect(document.querySelector("[data-thing-chip]")).toBeNull();
  });

  test("[R-WORLD-034] [R-WORLD-005] [R-WORLD-025] given a thing whose acts are not done at once (the bed's Sleep), when it is tapped, then it fans too: its nap with the bed's picture and Sleep with the sleep glyph, the act's own label, no price pill and no Free, and no chip", async () => {
    await inTheParlour();
    fireEvent.click(found('[data-stand-in-thing="mattress"]'));
    act(() => anchorFan("mattress", { x: 90, y: 560 }));
    const fan = found('[data-fan="mattress"]');
    expect(fan.querySelector("[data-fan-title]")?.textContent).toBe(sceneWords("city.thing.mattress"));
    const sleep = found('[data-fan="mattress"] [data-fan-act="end-month"]');
    expect(sleep.dataset.fanKind).toBe("act");
    expect(sleep.textContent).toContain(say("ui.world.end-month"));
    expect(sleep.querySelector("[data-fan-picture] [data-tile]")?.getAttribute("data-tile")).toBe("act.sleep");
    expect(sleep.querySelector("[data-fan-price]")).toBeNull();
    const rest = [...fan.querySelectorAll<HTMLElement>("[data-fan-act]")].filter((node) => node !== sleep);
    expect(rest).toHaveLength(1);
    // The nap where one can be had, else Lie down in its place (R-WORLD-025, the contract's `otherwise`).
    expect(["activity.nap", "lie"]).toContain(rest[0]?.dataset.fanAct);
    expect(fan.textContent).not.toContain(say("ui.world.free"));
    expect(document.querySelector("[data-thing-chip]")).toBeNull();
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });

  test("[R-WORLD-034] [R-WORLD-005] [R-WORLD-010] given the sofa, when it is tapped, then Sit and Lie down fan out with their glyphs and no price; Sit is handed to the walk with its pose and lands as the sofa's act, sending nothing, and the fan closes", async () => {
    const { authority } = await inTheParlour();
    fireEvent.click(found('[data-stand-in-thing="sofa"]'));
    act(() => anchorFan("sofa", { x: 90, y: 560 }));
    const fan = found('[data-fan="sofa"]');
    expect([...fan.querySelectorAll<HTMLElement>("[data-fan-act]")].map((node) => node.dataset.fanAct)).toEqual(["sit", "lie"]);
    expect(found('[data-fan-act="sit"]').textContent).toContain("Sit");
    expect(found('[data-fan-act="lie"]').textContent).toContain("Lie down");
    expect(found('[data-fan-act="sit"] [data-tile]').getAttribute("data-tile")).toBe("act.sit");
    expect(found('[data-fan-act="lie"] [data-tile]').getAttribute("data-tile")).toBe("act.lie");
    expect(fan.querySelector("[data-fan-price]")).toBeNull();
    const before = authority.sent.length;
    fireEvent.click(found('[data-fan-act="sit"] button'));
    expect(handed).toEqual(["sofa:sit:sit"]);
    await waitFor(() => expect(document.querySelector("[data-fan]")).toBeNull());
    expect(authority.sent.slice(before)).toEqual([]);
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });

  test("[R-WORLD-034] [R-WORLD-005] given the light bill open at Mama, when she is tapped, then her fan holds Pay with the pay glyph and no price pill beside her time; Pay opens the bill's card once the walk has reached her", async () => {
    await inTheParlour((one) => {
      openOffer(one, "offer.nepa-bill");
    });
    await waitFor(() => found('[data-stand-in-thing="mama"]'));
    fireEvent.click(found('[data-stand-in-thing="mama"]'));
    act(() => anchorFan("mama", { x: 90, y: 560 }));
    const bills = found('[data-fan="mama"] [data-fan-act="offer.nepa-bill"]');
    expect(bills.dataset.fanFrom).toBe("bills");
    expect(bills.textContent).toContain(sceneWords("city.act.bills"));
    expect(bills.querySelector("[data-tile]")?.getAttribute("data-tile")).toBe("act.pay");
    expect(bills.querySelector("[data-fan-price]")).toBeNull();
    fireEvent.click(found('[data-fan="mama"] [data-fan-act="offer.nepa-bill"] button'));
    await waitFor(() => expect(document.querySelector("[role=dialog]")).not.toBeNull());
    expect(document.querySelector("[data-fan]")).toBeNull();
  });

  test("[R-WORLD-034] [R-WORLD-005] given a thing with a pose act and no room beside it, when its acts would fan, then the same buttons open as a small sheet, and a card there does as the fan's button does", async () => {
    await inTheParlour();
    fireEvent.click(found('[data-stand-in-thing="sofa"]'));
    act(() => anchorFan("sofa", null));
    const sheet = await waitFor(() => found('[role=dialog] [data-fan-sheet="sofa"]'));
    expect([...sheet.querySelectorAll<HTMLElement>("[data-fan-act]")].map((node) => node.dataset.fanAct)).toEqual(["sit", "lie"]);
    expect(document.querySelector("[data-fan]")).toBeNull();
    fireEvent.click(found('[data-fan-sheet="sofa"] [data-fan-act="lie"] button'));
    expect(handed).toEqual(["sofa:lie:lie"]);
    await waitFor(() => expect(document.querySelector("[data-fan-sheet]")).toBeNull());
  });

  test("[R-WORLD-034] [R-WORLD-003] [R-WORLD-005] given the fan open, when a tap lands outside it or Escape is pressed, then the fan goes and the band's row comes back as it stood; a tap on the fan keeps it", async () => {
    await inTheParlour();
    const row = (): string | null => document.querySelector("[data-band] [data-nudge]")?.textContent ?? null;
    const before = row();
    fanTheCookingCorner();
    fireEvent.pointerDown(found(`[data-fan-act="${JOLLOF}"] button`));
    expect(document.querySelector("[data-fan]")).not.toBeNull();
    fireEvent.pointerDown(found("[data-band]"));
    await waitFor(() => expect(document.querySelector("[data-fan]")).toBeNull());
    expect(row()).toBe(before);
    fanTheCookingCorner();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(document.querySelector("[data-fan]")).toBeNull());
  });
});
