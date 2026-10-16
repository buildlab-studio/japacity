// The Market on the phone (the after set's phone-market; the new rule R-HOME-013 to come, cited meanwhile
// by the rules it touches), on the real engine: a grid of the things as sticker tiles of their models with the price on
// the yellow pill, what is owned says so, a pick shows the balance before and after and one Buy, the delivery's toast;
// only at home, and abroad a Lagos thing.
import { content } from "@japacity/content";
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { applyEffects } from "../../../../../../packages/sim/src/route/route.journey";
import type { Game } from "../../../../../../packages/sim/src/testing/play";
import { GameProvider } from "../../../authority/GameProvider";
import { createGameStore } from "../../../authority/store";
import { gameAuthority, newGame, setPockets } from "../../../shared/testing/fixtures";
import "../../../shared/testing/render";
import { marketTile } from "../../../shared/tiles/tiles.data";
import { formatMoney } from "../../../shared/words/format";
import { nameOf } from "../../../shared/words/text";
import { PhoneApps } from "../PhoneApps";
import { phoneWords } from "../phone.words";

const FAMILY = "place.family-house";

async function openMarket(game: Game, here: string | null): Promise<{ unmount: () => void }> {
  const store = createGameStore(gameAuthority(game));
  await store.getState().refresh();
  const { unmount } = render(
    <GameProvider store={store}>
      <PhoneApps onClose={() => undefined} area="Home" here={here} now={() => new Date(2026, 9, 13, 12, 5)} talk={null} />
    </GameProvider>,
  );
  fireEvent.click(document.querySelector<HTMLElement>('[data-app="market"]')!);
  return { unmount };
}

const card = (thing: string): HTMLButtonElement | null => document.querySelector<HTMLButtonElement>(`[data-market-thing="${thing}"]`);

describe("the Market", () => {
  test("[R-HOME-013] [R-HOME-006] [R-WORLD-019] given Ada at the family house, when the Market opens, then every thing stands as a sticker of its model, its price on the yellow pill, and what has no place at Mama's says so after the rest", async () => {
    const game = newGame();
    setPockets(game, { NGN: 500_000_00 });
    const { unmount } = await openMarket(game, FAMILY);
    const grid = [...document.querySelectorAll<HTMLElement>("[data-market-thing]")].map((node) => node.dataset.marketThing);
    expect(grid.sort()).toEqual(Object.keys(content.thing).sort());
    expect(card("thing.fan")?.querySelector(`[data-pic="${marketTile("thing.fan")}"]`)).not.toBeNull();
    expect(card("thing.fan")?.querySelector("[data-market-price]")?.textContent).toBe(formatMoney(content.thing["thing.fan"]!.price, "NGN"));
    expect(card("thing.tv")?.textContent).toContain(phoneWords("phone.market.shut.family"));
    expect(card("thing.tv")?.querySelector("[data-market-price]")).toBeNull();
    const order = [...document.querySelectorAll<HTMLElement>("[data-market-thing]")].map((node) => node.dataset.marketThing ?? "");
    expect(order.indexOf("thing.fan")).toBeLessThan(order.indexOf("thing.tv"));
    unmount();
  });

  test("[R-HOME-013] [R-HOME-006] given a thing with a running cost beside things with none, when the Market opens, then every tile ends on its price, the running cost over it, so the prices of a row line up", async () => {
    // The catalog's picture 120 (1b952f4b): the data router's running chip under its price lifted the price off its neighbour's.
    const game = newGame();
    setPockets(game, { NGN: 500_000_00 });
    const { unmount } = await openMarket(game, FAMILY);
    const running = Object.values(content.thing).find((thing) => thing.running > 0 && card(thing.id)?.querySelector("[data-market-price]") !== null);
    expect(running).toBeDefined();
    for (const tile of document.querySelectorAll<HTMLElement>("[data-market-thing]")) {
      const foot = tile.querySelector<HTMLElement>("[data-market-foot-of]")!;
      expect(foot.lastElementChild?.matches("[data-market-price], [data-word-chip]:not([data-market-running])")).toBe(true);
    }
    const foot = card(running!.id)!.querySelector<HTMLElement>("[data-market-foot-of]")!;
    expect(foot.firstElementChild?.hasAttribute("data-market-running")).toBe(true);
    unmount();
  });

  test("[R-HOME-013] [R-HOME-006] [R-WORLD-006] given a fan picked at home, when Buy is pressed, then the balance before and after shows, the fan is bought at its price, the delivery's toast stands and the card says it is yours", async () => {
    const game = newGame();
    setPockets(game, { NGN: 500_000_00 });
    const { unmount } = await openMarket(game, FAMILY);
    fireEvent.click(card("thing.fan")!);
    const price = content.thing["thing.fan"]!.price;
    expect(document.querySelector("[data-balance-before]")?.getAttribute("data-balance-before")).toBe(String(500_000_00));
    expect(document.querySelector("[data-balance-after]")?.getAttribute("data-balance-after")).toBe(String(500_000_00 - price));
    expect(document.querySelector("[data-market-buy]")?.textContent).toContain(nameOf("thing.fan"));
    await act(async () => {
      fireEvent.click(document.querySelector<HTMLElement>("[data-market-buy]")!);
      await Promise.resolve();
    });
    expect(game.state.things.owned.map((one) => one.thing)).toEqual(["thing.fan"]);
    expect(document.querySelector("[data-market-delivered]")?.textContent).toBe(phoneWords("phone.market.delivered"));
    expect(card("thing.fan")?.querySelector("[data-market-owned]")?.textContent).toBe(phoneWords("phone.market.owned"));
    unmount();
  });

  test("[R-HOME-013] [R-HOME-006] given a thing owned, when it is picked, then the foot offers to sell it for its resale figure and the sale brings it in", async () => {
    const game = newGame();
    setPockets(game, { NGN: 500_000_00 });
    game.accept({ type: "thing/buy", thing: "thing.radio" });
    const { unmount } = await openMarket(game, FAMILY);
    fireEvent.click(card("thing.radio")!);
    const resale = game.view().things.owned[0]!.resale;
    expect(document.querySelector("[data-market-sell]")?.textContent).toBe(phoneWords("phone.market.sell", { amount: formatMoney(resale, "NGN") }));
    await act(async () => {
      fireEvent.click(document.querySelector<HTMLElement>("[data-market-sell]")!);
      await Promise.resolve();
    });
    expect(game.state.things.owned).toEqual([]);
    unmount();
  });

  test("[R-HOME-013] [R-HOME-006] given a price not held, when the card is picked, then Buy is shut and says how much short, with no balance after", async () => {
    const game = newGame();
    setPockets(game, { NGN: 10_000_00 });
    const { unmount } = await openMarket(game, FAMILY);
    fireEvent.click(card("thing.fan")!);
    const button = document.querySelector<HTMLButtonElement>("[data-market-buy]");
    expect(button?.disabled).toBe(true);
    expect(button?.textContent).toContain(phoneWords("phone.market.short", { amount: formatMoney(content.thing["thing.fan"]!.price - 10_000_00, "NGN") }));
    expect(document.querySelector("[data-balance-after]")).toBeNull();
    unmount();
  });

  test("[R-HOME-013] [R-HOME-006] given Ada away from home in Lagos, when the Market opens, then it says the rider brings it to the gate, a pick shakes and nothing is offered to buy", async () => {
    const game = newGame();
    setPockets(game, { NGN: 500_000_00 });
    const { unmount } = await openMarket(game, "place.yaba");
    expect(document.querySelector("[data-market-line]")?.textContent).toBe(phoneWords("phone.market.away"));
    fireEvent.click(card("thing.fan")!);
    expect(card("thing.fan")?.className).toContain("shake");
    expect(document.querySelector("[data-market-buy]")).toBeNull();
    unmount();
  });

  test("[R-HOME-013] [R-PLACE-002] given a life abroad, when the Market opens, then it says the market is a Lagos thing and shows no grid", async () => {
    const game = newGame();
    applyEffects(game, [{ type: "place/move", to: "abroad", country: "country.uk" }]);
    const { unmount } = await openMarket(game, null);
    expect(document.querySelector("[data-market-abroad]")?.textContent).toBe(phoneWords("phone.market.abroad"));
    expect(document.querySelector("[data-market-grid]")).toBeNull();
    unmount();
  });
});
