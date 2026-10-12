// The fan in the city (docs/design/13-the-lively-layer.md section 3; docs/rules/world.md R-WORLD-005, R-WORLD-006,
// R-WORLD-010): a tap on a thing whose acts are the room's or the street's acts done at once fans them out of the thing in
// place of the chip and its sheet; a button sends the act the sheet would send, once the walk has reached the thing; a
// thing with no room beside it opens the sheet; `?fan=off` brings the chip back. The place file is the one the game ships;
// the scene is a stand-in that hands the city the taps, says where the fanned thing stands, and walks at once.
import { act, fireEvent, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { newGame, setPockets } from "../../shared/testing/fixtures";
import { renderWithGame } from "../../shared/testing/people";
import { formatMoney } from "../../shared/words/format";
import type { Act, Thing } from "../../shared/world/contract";
import { City } from "./City";
import { anchorFan } from "./fan/anchor";

type Pick = { kind: "thing"; thing: Thing } | { kind: "act"; thing: Thing; act: Act };

interface StandInProps {
  things?: Thing[];
  chosen?: Thing | null;
  actOn?: { thing: Thing; act: Act; at: number } | null;
  onPick: (pick: Pick) => void;
}

function StandInScene({ things, chosen = null, actOn = null, onPick }: StandInProps) {
  // The walk is instant here: the act follows the fan's tap at once, as it would on arrival (R-WORLD-010).
  useEffect(() => {
    if (actOn !== null) onPick({ kind: "act", thing: actOn.thing, act: actOn.act });
  }, [actOn]);
  return (
    <div data-stand-in-scene data-stand-in-chosen={chosen?.id ?? ""}>
      {(things ?? []).map((thing) => (
        <span key={thing.id}>
          <button type="button" data-stand-in-thing={thing.id} onClick={() => onPick({ kind: "thing", thing })} />
          {thing.acts.map((one) => (
            <button key={one.id} type="button" data-stand-in-act={`${thing.id}:${one.id}`} onClick={() => onPick({ kind: "act", thing, act: one })} />
          ))}
        </span>
      ))}
    </div>
  );
}

vi.mock("./CityScene", () => ({ default: StandInScene }));

// The place files the game ships, read from the disk in place of the server.
vi.mock("../../shared/three/manifest", async (original) => {
  const real = await original<typeof import("../../shared/three/manifest")>();
  const fs = await import("node:fs");
  const path = await import("node:path");
  const assets = path.join(import.meta.dirname, "..", "..", "..", "public", "assets");
  return {
    ...real,
    loadManifest: () => Promise.resolve({ files: {} }),
    loadJson: (_manifest: unknown, under: string) => {
      const file = path.join(assets, under);
      return Promise.resolve(fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as unknown) : null);
    },
  };
});

const SCREEN = { width: window.innerWidth, height: window.innerHeight };

beforeEach(() => {
  Object.defineProperty(window, "WebGL2RenderingContext", { value: class {}, configurable: true });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({}) as never);
  window.localStorage.setItem("japacity.city.last", JSON.stringify(["place.family-house"]));
  // A phone held upright, as the game is built for.
  Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 844, configurable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
  Reflect.deleteProperty(window, "WebGL2RenderingContext");
  Object.defineProperty(window, "innerWidth", { value: SCREEN.width, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: SCREEN.height, configurable: true });
});

function found(selector: string): HTMLElement {
  const one = document.querySelector<HTMLElement>(selector);
  if (one === null) throw new Error(`Nothing at ${selector}.`);
  return one;
}

const COOK = "activity.cook-at-home";
const JOLLOF = "activity.cook-jollof";

/** Ada in the parlour: a new life, its pockets set first when asked. */
async function inTheParlour(before: (game: ReturnType<typeof newGame>) => void = () => undefined) {
  const game = newGame("scenario.ada");
  before(game);
  const rendered = await renderWithGame(<City world results={(place) => <p data-results-for={place} />} />, game);
  fireEvent.click(await waitFor(() => found('[data-stand-in-act="house:enter"]')));
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
  test("[R-WORLD-005] [R-WORLD-006] given Ada in the parlour, when the cooking corner is tapped, then its two meals fan out of it with their prices and the balance before and after, no chip is asked of the scene, and the nudge steps back", async () => {
    const { game } = await inTheParlour();
    fanTheCookingCorner();
    const fan = found('[data-fan="cooking"]');
    expect(fan.dataset.fanSide).toBe("right");
    expect([...fan.querySelectorAll<HTMLElement>("[data-fan-act]")].map((node) => node.dataset.fanAct)).toEqual([COOK, JOLLOF]);
    const cook = found(`[data-fan-act="${COOK}"]`);
    expect(cook.querySelector("[data-fan-price]")?.textContent).toBe(priceOf(game, COOK));
    expect(found(`[data-fan-act="${JOLLOF}"] [data-fan-price]`).textContent).toBe(priceOf(game, JOLLOF));
    expect(cook.textContent).toContain("Indomie and egg");
    expect(found(`[data-fan-act="${JOLLOF}"]`).textContent).toContain("Jollof for the house");
    const held = game.view().pockets.NGN.bank + game.view().pockets.NGN.cash;
    expect(cook.querySelector("[data-balance-before]")?.textContent).toBe(formatMoney(held, "NGN"));
    expect(found("[data-stand-in-scene]").dataset.standInChosen).toBe("");
    expect(document.querySelector("[data-nudge]")).toBeNull();
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });

  test("[R-WORLD-005] [R-WORLD-010] given the cooking corner's fan, when Indomie and egg is tapped, then once the walk reaches the corner the act is sent at once as its sheet would send it, and the fan closes", async () => {
    const { authority } = await inTheParlour();
    fanTheCookingCorner();
    const before = authority.sent.length;
    fireEvent.click(found(`[data-fan-act="${COOK}"] button`));
    await waitFor(() => expect(authority.sent.slice(before)).toContainEqual(expect.objectContaining({ type: "activity/now", activity: COOK, param: null })));
    await waitFor(() => expect(document.querySelector("[data-fan]")).toBeNull());
  });

  test("[R-WORLD-006] given too little naira for a meal, when its button is tapped, then it says how much is short, shakes, and sends nothing", async () => {
    const { authority } = await inTheParlour((game) => setPockets(game, { NGN: 50_000 }));
    fanTheCookingCorner();
    const before = authority.sent.length;
    const cook = found(`[data-fan-act="${COOK}"]`);
    expect(cook.dataset.fanRefused).toBe("short");
    fireEvent.click(found(`[data-fan-act="${COOK}"] button`));
    expect(found(`[data-fan-act="${COOK}"] button`).className).toContain("fan-shake");
    expect(authority.sent.slice(before)).toEqual([]);
  });

  test("[R-WORLD-005] given the cooking corner off the screen as it is tapped, when its acts would fan, then the existing sheet of its two meals opens instead", async () => {
    await inTheParlour();
    fanTheCookingCorner(null);
    await waitFor(() => expect(document.querySelector("[role=dialog]")).not.toBeNull());
    expect(document.querySelector("[data-fan]")).toBeNull();
  });

  test("[R-WORLD-005] given a thing in the middle of the phone with no room either side, when its acts would fan, then the sheet opens instead", async () => {
    await inTheParlour();
    fanTheCookingCorner({ x: 195, y: 420 });
    await waitFor(() => expect(document.querySelector("[role=dialog]")).not.toBeNull());
    expect(document.querySelector("[data-fan]")).toBeNull();
  });

  test("[R-WORLD-005] given a development build asked for ?fan=off, when the cooking corner is tapped, then its chip is asked of the scene as before and no fan opens", async () => {
    window.history.replaceState(null, "", "/?fan=off");
    await inTheParlour();
    fireEvent.click(found('[data-stand-in-thing="cooking"]'));
    expect(found("[data-stand-in-scene]").dataset.standInChosen).toBe("cooking");
    expect(document.querySelector("[data-fan]")).toBeNull();
  });

  test("[R-WORLD-005] given a thing whose acts are not done at once (the bed's sleep, Mama's bill), when it is tapped, then its chip is asked of the scene and no fan opens", async () => {
    await inTheParlour();
    fireEvent.click(found('[data-stand-in-thing="bed"]'));
    expect(found("[data-stand-in-scene]").dataset.standInChosen).toBe("bed");
    expect(document.querySelector("[data-fan]")).toBeNull();
  });

  test("[R-WORLD-003] [R-WORLD-005] given the fan open, when a tap lands outside it or Escape is pressed, then the fan goes and the nudge comes back; a tap on the fan keeps it", async () => {
    await inTheParlour();
    fanTheCookingCorner();
    fireEvent.pointerDown(found(`[data-fan-act="${JOLLOF}"] button`));
    expect(document.querySelector("[data-fan]")).not.toBeNull();
    fireEvent.pointerDown(found("[data-band]"));
    await waitFor(() => expect(document.querySelector("[data-fan]")).toBeNull());
    expect(document.querySelector("[data-nudge]")).not.toBeNull();
    fanTheCookingCorner();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(document.querySelector("[data-fan]")).toBeNull());
  });
});
