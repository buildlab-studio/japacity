// The japa type read from the view at the send-off (decision 0018; docs/rules/share.md R-SHARE-001,
// R-SHARE-004, R-SHARE-005): one of six labels from the way out, the money kept, the risks taken and
// how home was held. Read from the recorded lives and a trader's tile played into her shop.
import { content, japaTypes, text } from "@japacity/content";
import type { PlayerView, SlotPick } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { topActivities } from "../../../../../packages/sim/src/chapter/chapter.card";
import { newGame, recordedGame } from "../testing/fixtures";
import { japaTypeOf, typeWords } from "./japaType";

type Card = NonNullable<PlayerView["card"]>;

function sendOff(name: string): PlayerView {
  const view = recordedGame(name).view();
  if (view.card?.kind !== "send-off") throw new Error(`${name}'s recorded life does not end at the send-off.`);
  return view;
}

/** Ada at her send-off with her card's things done most swapped, as another life might have done them. */
function adaDoing(topActivities: Card["topActivities"], change: Partial<PlayerView> = {}): PlayerView {
  const view = sendOff("ada-careful");
  return { ...view, ...change, card: { ...view.card!, topActivities } };
}

/**
 * A trader from sixteen (the prologue's tile) who opens her shop with the settlement and runs it a
 * year, with the month's other acts given. The send-off card is the one the engine would make now:
 * a trade's way out takes longer than a test should play.
 */
function trader(others: SlotPick["activity"][]): PlayerView {
  const game = newGame("scenario.prologue", "sixteen-0");
  for (let turn = 0; turn < 40 && game.state.prologue.open; turn += 1) {
    const prologue = game.view().prologue!;
    const allowed = prologue.answers.filter((answer) => answer.allowed).map((answer) => answer.id);
    const answer = ["apprentice", "spare-parts", "stay", "settle", "nowhere", "room"].find((id) => allowed.includes(id)) ?? allowed[0] ?? "";
    game.accept({ type: "prologue/choose", step: prologue.step, answer });
  }
  game.endTurn([{ activity: "activity.open-shop", param: null }]);
  for (let month = 0; month < 12; month += 1) {
    const view = game.view();
    // Each act that is open now, with the first thing it may take where it takes one.
    const picks = others.flatMap((id) => view.activities.filter((option) => option.id === id && option.allowed && option.params?.length !== 0)).slice(0, view.freeSlots);
    game.endTurn(picks.map((option) => ({ activity: option.id, param: option.params?.[0] ?? null })));
  }
  const view = game.view();
  expect(view.job.id).toBe("activity.run-shop");
  const standing = view.qualities.find((quality) => quality.id === "quality.standing")?.value ?? 0;
  const card: Card = { kind: "send-off", chapter: "chapter.send-off", route: view.japacity.route, percent: view.japacity.percent, months: view.month, standing, topActivities: topActivities(game.state, content), name: null };
  return { ...view, card };
}

describe("the japa type, read at the send-off", () => {
  test("[R-SHARE-001] given the recorded lives at their send-off, when the type is read, then Ada is the careful saver, Tunde the family anchor and Zainab the long way round", () => {
    expect(japaTypeOf(sendOff("ada-careful"))).toBe("careful-saver");
    expect(japaTypeOf(sendOff("tunde-borrower"))).toBe("family-anchor");
    expect(japaTypeOf(sendOff("zainab-remote"))).toBe("long-way-round");
  });

  test("[R-SHARE-001] given a trader's tile played into her own shop, when the type is read at a send-off, then she is the hustler, and the kiosk beside the shop, the lotto and the bet slip both, is one risk and not the gambler", () => {
    expect(japaTypeOf(trader(["activity.ask-around", "activity.rest"]))).toBe("hustler");
    const kiosk = trader(["activity.play-lotto", "activity.bet-slip"]);
    expect(kiosk.card?.topActivities).toEqual(expect.arrayContaining(["activity.play-lotto", "activity.bet-slip"]));
    expect(japaTypeOf(kiosk)).toBe("hustler");
  });

  test("[R-SHARE-001] given no send-off due, a chapter card or no card, when the type is read, then there is none yet", () => {
    const ada = sendOff("ada-careful");
    expect(japaTypeOf({ ...ada, card: null })).toBeNull();
    expect(japaTypeOf({ ...ada, card: { ...ada.card!, kind: "chapter" } })).toBeNull();
    const game = recordedGame("ada-careful");
    game.endTurn();
    expect(japaTypeOf(game.view())).toBeNull();
  });

  test("[R-SHARE-004] given Ada's send-off with one thing changed at a time, when the type is read, then each of the six types is reached by its own reason", () => {
    const ada = sendOff("ada-careful");
    // A return in the record and still going: the long way round, before anything else.
    expect(japaTypeOf({ ...ada, place: { ...ada.place, returns: [{ month: 6, shape: "broke", country: "country.uk" }] } })).toBe("long-way-round");
    // The way taken refused once before it was granted.
    expect(japaTypeOf({ ...ada, routes: ada.routes.map((route) => (route.id === ada.card!.route ? { ...route, refusals: 1 } : route)) })).toBe("long-way-round");
    // A refusal on another way is not the way taken.
    expect(ada.routes.find((route) => route.id === "route.uk-talent")?.refusals).toBe(1);
    // Home at its proudest: standing at the top of its range, or the top band with time given to family.
    expect(japaTypeOf({ ...ada, card: { ...ada.card!, standing: content.quality["quality.standing"]!.max } })).toBe("family-anchor");
    expect(japaTypeOf(adaDoing(["activity.family-time", "activity.job-junior-dev"]))).toBe("family-anchor");
    expect(japaTypeOf({ ...adaDoing(["activity.family-time", "activity.job-junior-dev"]), card: { ...ada.card!, topActivities: ["activity.family-time"], standing: 50 } })).not.toBe("family-anchor");
    // Two risks: the kiosk and an agent paid. One alone is not enough.
    expect(japaTypeOf(adaDoing(["activity.play-lotto", "activity.see-agent-office"]))).toBe("gambler");
    expect(japaTypeOf(adaDoing(["activity.play-lotto", "activity.job-junior-dev"]))).not.toBe("gambler");
    // Study first.
    expect(japaTypeOf(adaDoing(["activity.learn-tech", "activity.job-junior-dev"]))).toBe("night-reader");
    expect(japaTypeOf(adaDoing(["activity.job-junior-dev", "activity.study-english"]))).toBe("night-reader");
    // Side work among the things done most, or a side job held.
    expect(japaTypeOf(adaDoing(["activity.job-junior-dev", "activity.side-gig"]))).toBe("hustler");
    expect(japaTypeOf(adaDoing(["activity.job-junior-dev", "activity.weekend-tutoring"]))).toBe("hustler");
    // A debt carried to the send-off: no longer the careful saver.
    const loan = { ...ada.obligations[0]!, id: "loan-1", entry: "obligation.agent-debt" as const };
    expect(japaTypeOf({ ...ada, obligations: [...ada.obligations, loan] })).toBe("hustler");
  });

  test("[R-SHARE-005] given every type, when its words are read, then it is a name and a line, never a figure", () => {
    for (const type of japaTypes) {
      const words = typeWords(type);
      expect(words).toEqual({ name: text[`share.type.${type}.name`], line: text[`share.type.${type}.line`] });
      expect(`${words.name} ${words.line}`).not.toMatch(/\d/);
    }
  });
});
