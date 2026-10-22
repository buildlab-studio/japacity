// The waybill at the cargo counter (world:one-action-one-sheet): a paper slip that says who
// shipped the parcel, to whom, what is in it and the handling charge, with the sender's note, and
// one button that collects it. Played on the real engine through a game handle.
import { content } from "@japacity/content";
import type { Currency, PlayerView } from "@japacity/sim";
import { act, fireEvent, render } from "@testing-library/react";
import { setPockets } from "@japacity/sim/testing";
import { afterEach, describe, expect, test, vi } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore } from "../../authority/store";
import { keepPerson } from "../front-door/person";
import { gameAuthority, newGame, openOffer } from "../testing/fixtures";
import "../testing/render";
import { formatMoney } from "../words/format";
import { nameOf, say, words } from "../words/text";
import { AskSheet } from "./AskSheet";
import type { Ask } from "./contract";
import { PARCEL, parcelAsk } from "./parcel.ask";
import { ParcelWaybill } from "./Waybill";
import { WorldSheet } from "./WorldSheet";

const money = (amount: number, currency: string): string => formatMoney(amount, currency as Currency);
const { handling } = content.tuning.parcel;
/** The graduate's draw with an older sibling settled in the UK. */
const SIBLING_ABROAD = "seed-3";

function graduate(): { game: ReturnType<typeof newGame>; view: PlayerView } {
  const game = newGame("scenario.graduate", SIBLING_ABROAD);
  game.endTurn();
  openOffer(game, PARCEL);
  return { game, view: game.view() };
}

function rows(): [string, string][] {
  return [...document.querySelectorAll("[data-slip-row]")].map((row) => [row.querySelector("[data-slip-label]")?.textContent ?? "", row.querySelector("[data-slip-value]")?.textContent ?? ""]);
}

function main(): HTMLButtonElement {
  const found = document.querySelector<HTMLButtonElement>("[data-ask-main]");
  if (found === null) throw new Error("No sheet is open.");
  return found;
}

afterEach(() => {
  localStorage.clear();
});

describe("the slip's rows", () => {
  test("[world:one-action-one-sheet] given a slip with rows, when it opens, then each row shows its label and value on the paper, the strong one bold, in place of the one big figure", () => {
    const ask: Ask = {
      form: "slip",
      icon: "box",
      who: "Waybill",
      title: "A parcel for you",
      line: "A note.",
      cost: { amount: handling, currency: "NGN" },
      rows: [
        { label: "From", value: "Your aunty in Houston" },
        { label: "Handling", value: money(handling, "NGN"), strong: true },
      ],
      button: "Collect it",
      act: () => undefined,
      dismiss: () => undefined,
    };
    render(<AskSheet ask={ask} have={handling * 2} formatMoney={money} />);
    expect(rows()).toEqual([
      ["From", "Your aunty in Houston"],
      ["Handling", money(handling, "NGN")],
    ]);
    expect(document.querySelector("[data-slip-row][data-strong]")?.textContent).toContain("Handling");
    expect(document.querySelector("[data-slip-figure]")).toBeNull();
  });
});

describe("the waybill", () => {
  test("[world:one-action-one-sheet] given a parcel from the graduate's sibling in the UK, when its waybill is built, then it is a slip naming the sender, You (a ready life has no name of its own), the thing and the charge, with the sender's note and one button that collects it", () => {
    const { view } = graduate();
    const offer = view.offers.find((item) => item.entry === PARCEL)!;
    const holds = offer.choices[0]!.id;
    const thing = holds.slice(holds.indexOf("-") + 1);
    const ask = parcelAsk(view, { send: () => undefined, done: () => undefined, formatMoney: money })!;
    expect(ask.form).toBe("slip");
    expect(ask.title).toBe(words(`${PARCEL}.title`));
    expect(ask.rows).toEqual([
      { label: words(`${PARCEL}.waybill.from`), value: nameOf("person.sibling-uk-settled") },
      { label: words(`${PARCEL}.waybill.to`), value: words(`${PARCEL}.waybill.you`) },
      { label: words(`${PARCEL}.waybill.contents`), value: words(`${PARCEL}.contents.${thing}`) },
      { label: words(`${PARCEL}.waybill.handling`), value: money(handling, "NGN"), strong: true },
    ]);
    expect(ask.line).toContain(words(`${PARCEL}.note.${holds}`));
    expect(ask.cost).toEqual({ amount: handling, currency: "NGN" });
    expect(ask.button).toBe(words(`${PARCEL}.choice.${holds}`));
    expect(ask.when).toBe("now");
  });

  test("[account:person-kept-with-character] given the person built at the door kept on this phone, when the parcel's waybill is built, then its To line is that first name", () => {
    keepPerson({ name: "Adaeze", look: "person_ada", archetype: null });
    const { view } = graduate();
    const ask = parcelAsk(view, { send: () => undefined, done: () => undefined, formatMoney: money })!;
    expect(ask.rows).toContainEqual({ label: words(`${PARCEL}.waybill.to`), value: "Adaeze" });
  });

  test("[world:one-action-one-sheet] given no parcel waiting, when the waybill is built, then there is none", () => {
    const game = newGame("scenario.graduate", SIBLING_ABROAD);
    expect(parcelAsk(game.view(), { send: () => undefined, done: () => undefined, formatMoney: money })).toBeNull();
  });

  test("[world:things-are-tappable-models] given the waybill open in a game, when Collect it is tapped, then the parcel's own choice is sent, the charge leaves the naira, and the sheet closes", async () => {
    const { game } = graduate();
    setPockets(game, { NGN: handling * 3 });
    const authority = gameAuthority(game);
    const store = createGameStore(authority);
    await store.getState().refresh();
    const done = vi.fn();
    render(
      <GameProvider store={store}>
        <ParcelWaybill onClose={done} />
      </GameProvider>,
    );
    const before = game.state.wallet.pockets.NGN.cash + game.state.wallet.pockets.NGN.bank;
    await act(async () => {
      fireEvent.click(main());
      await Promise.resolve();
    });
    expect(authority.sent.map((command) => command.type)).toEqual(["offer/choose"]);
    expect(game.state.wallet.pockets.NGN.cash + game.state.wallet.pockets.NGN.bank).toBe(before - handling);
    expect(Object.values(game.state.offer.items).some((item) => item.entry === PARCEL)).toBe(false);
    expect(done).toHaveBeenCalled();
  });

  test("[world:one-action-one-sheet] given less naira than the charge, when the waybill opens, then the button is shut and says how much is short", async () => {
    const { game } = graduate();
    setPockets(game, { NGN: handling - 100 });
    const store = createGameStore(gameAuthority(game));
    await store.getState().refresh();
    render(
      <GameProvider store={store}>
        <ParcelWaybill onClose={() => undefined} />
      </GameProvider>,
    );
    expect(main().disabled).toBe(true);
    expect(document.querySelector("[data-ask-after]")?.textContent).toContain(money(100, "NGN"));
  });

  test("[world:one-action-one-sheet] given the waybill standing in the asks sheet with less naira than the charge, when Not now is tapped, then the sheet it stands in lowers and the parcel waits on", async () => {
    const { game } = graduate();
    setPockets(game, { NGN: handling - 100 });
    const store = createGameStore(gameAuthority(game));
    await store.getState().refresh();
    const lowered = vi.fn();
    render(
      <GameProvider store={store}>
        <WorldSheet open onClose={lowered} label="The hub" title="Answer the person asking" mark="asks">
          <ParcelWaybill onClose={() => undefined} />
        </WorldSheet>
      </GameProvider>,
    );
    expect(main().disabled).toBe(true);
    const notNow = [...document.querySelectorAll("button")].find((button) => button.textContent === say("ui.world.not-now"));
    if (notNow === undefined) throw new Error("No Not now on the slip.");
    await act(async () => {
      fireEvent.click(notNow);
      await Promise.resolve();
    });
    expect(lowered).toHaveBeenCalled();
    expect(Object.values(game.state.offer.items).some((item) => item.entry === PARCEL)).toBe(true);
  });
});
