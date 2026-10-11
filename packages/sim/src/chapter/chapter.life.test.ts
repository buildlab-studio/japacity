// Chapters 4 to 6 on a played life: the send-off, landing and secure, and the
// send-off card. docs/rules/chapter.md R-CHAPTER-002, 006 and 007.
import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { check } from "../engine/check";
import type { Id, PlayerView, ReadCtx, StepResult } from "../engine/types";
import { viewFor } from "../engine/view";
import { flownAda, LANDING, monthAbroad, playUntil, SECURE, SEND_OFF } from "../goal/goal.journey";
import { lifeSaves } from "../goldens/lives.data";
import { roadCard } from "../route/gates/road";
import { applyEffects } from "../route/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { sendOffCard, topActivities } from "./chapter.logic";

const UK: Id<"route"> = "route.uk-masters";
const STANDING: Id<"quality"> = "quality.standing";
const cap = content.tuning.turn.cap;

function readOf(game: Game): ReadCtx {
  return { state: game.state, world: game.world(), content: game.content };
}

function closed(result: { events: { type: string }[] }): unknown[] {
  return result.events.filter((event) => event.type === "chapter/closed");
}

type Accepted = Extract<StepResult, { ok: true }>;

/** A recorded life replayed command by command through the real content; `to` plays on until a command leaves `until` true. */
function replay(name: string): { game: Game; to: (until: (game: Game) => boolean) => Accepted } {
  const save = lifeSaves[name];
  if (save === undefined) throw new Error(`The ${name} life is not recorded.`);
  const game = start({ scenario: save.scenario, seed: save.seed, worldSeed: save.worldSeed, content });
  let index = 0;
  const to = (until: (game: Game) => boolean): Accepted => {
    while (index < save.commands.length) {
      const { command, sender } = save.commands[index]!;
      index += 1;
      const result = game.accept(command, sender);
      if (until(game)) return result;
    }
    throw new Error(`The ${name} life never got there.`);
  };
  return { game, to };
}

/** Ada flown and on through Landing, so Secure is the chapter in hand. */
function atSecure(): Game {
  const game = flownAda(content);
  playUntil(game, SECURE);
  return game;
}

describe("the send-off closes on the first month abroad", () => {
  test("[R-CHAPTER-002] given Ada's recorded life up to the flight, when the first month abroad ends, then the send-off closes, Landing opens and the bank is refilled", () => {
    const game = flownAda(content);
    expect(game.state.route[UK]?.state).toBe("departed");
    // The flight is a command between turns: nothing closes until a month is played.
    expect(game.state.chapter.current).toBe(SEND_OFF);
    const result = game.endTurn();
    expect(closed(result)).toEqual([{ type: "chapter/closed", chapter: SEND_OFF, next: LANDING }]);
    expect(game.state.chapter.current).toBe(LANDING);
    expect(game.state.turn.banked).toBe(cap);
  });
});

describe("the send-off card", () => {
  test("[R-CHAPTER-006] given Ada's recorded life just flown, when the view is read before any month abroad, then the card carries the route flown, its figure, the flight month, that month's standing and the three activities played most up to it", () => {
    const game = flownAda(content);
    const card = game.view().card;
    expect(card).toEqual({
      kind: "send-off",
      route: UK,
      percent: 100,
      months: game.state.turn.month,
      standing: game.state.quality[STANDING],
      topActivities: topActivities(game.state, game.content),
      chapter: SEND_OFF,
      name: null,
    });
    expect(card?.topActivities.length).toBe(3);
    // The card is data in the view, never in the state.
    expect(Object.keys(game.state)).not.toContain("card");
  });

  test("[R-CHAPTER-006] [R-ACTIVITY-012] given the months each activity was played, when the most played are counted, then the most come first, ties by id, three at most, and nothing played abroad is among them", () => {
    const game = flownAda(content);
    const expected = (Object.entries(game.state.activity.played) as [Id<"activity">, number][])
      .sort(([a, x], [b, y]) => y - x || (a < b ? -1 : 1))
      .slice(0, 3)
      .map(([id]) => id);
    expect(topActivities(game.state, game.content)).toEqual(expected);
    const shown = game.view().card?.topActivities ?? [];
    expect(shown).toEqual(expected);
    for (const id of shown) expect(content.activity[id]?.where).not.toBe("abroad");
  });

  test("[R-CHAPTER-006] [R-ENGINE-017] given the card's lines set to 2 in the tuning, when the card is read at the flight, then it names the two played most", () => {
    const moved = { ...content, tuning: { ...content.tuning, chapter: { ...content.tuning.chapter, cardLines: 2 } } };
    const game = flownAda(moved);
    const shown = game.view().card?.topActivities ?? [];
    expect(shown).toEqual(topActivities(flownAda(content).state, content).slice(0, 2));
  });

  test("[R-CHAPTER-006] given the card shown at the flight, when the first month abroad ends and the send-off closes, then the card is gone and the view's card is the road's, which is none", () => {
    const game = flownAda(content);
    expect(game.view().card?.kind).toBe("send-off");
    const result = game.endTurn();
    expect(closed(result)).toEqual([{ type: "chapter/closed", chapter: SEND_OFF, next: LANDING }]);
    expect(sendOffCard(readOf(game))).toBeNull();
    expect(game.view().card).toEqual(roadCard(readOf(game)));
    expect(game.view().card).toBeNull();
  });

  test("[R-CHAPTER-006] [R-SHARE-001] given a chapter other than the send-off closing, when the view is read, then there is no send-off card but the chapter card for it, gone once the next month ends", () => {
    // Since the lives were re-recorded for decision 0035, Ada's careful life meets Landing's last item on her first pay
    // abroad, whose own card stands before a chapter's; Tunde's recorded life abroad closes Landing in a month of its own.
    const { game, to } = replay("tunde-abroad");
    to((now) => now.state.place.where === "abroad");
    const flight = game.state.turn.month;
    const after = to((now) => now.state.turn.month > flight);
    expect(closed(after)).toEqual([{ type: "chapter/closed", chapter: SEND_OFF, next: LANDING }]);
    // The send-off's close has its own card, shown in the flight month.
    expect(game.view().card?.kind).not.toBe("chapter");
    const result = to((now) => now.state.chapter.current === SECURE);
    expect(closed(result)).toEqual([{ type: "chapter/closed", chapter: LANDING, next: SECURE }]);
    expect(game.view().card).toMatchObject({ kind: "chapter", chapter: LANDING, months: game.state.turn.month, name: null });
    const landed = game.state.turn.month;
    to((now) => now.state.turn.month > landed);
    expect(game.view().card?.kind).not.toBe("chapter");
  });
});

describe("landing", () => {
  test("[R-CHAPTER-002] given Ada landed with a room, a status and naira at home, when she finds work and pays her first rent, then Landing closes on the month every item is met", () => {
    const game = flownAda(content);
    game.endTurn();
    const met = (id: string) => game.view().chapter.items.find((item) => item.id === id)?.met;
    expect(game.state.chapter.current).toBe(LANDING);
    expect([met("room"), met("status"), met("job")]).toEqual([true, true, false]);
    const result = playUntil(game, SECURE);
    expect(closed(result)).toEqual([{ type: "chapter/closed", chapter: LANDING, next: SECURE }]);
    // The month before it closed, an item was still unmet: it closes on the month the last one is met.
    const entry = content.chapter[LANDING]!;
    expect(entry.items.every((item) => check(readOf(game), item.requirement).met)).toBe(true);
    expect(game.state.activity.job).not.toBeNull();
  });

  test("[R-CHAPTER-007] given Landing closing, when the month ends, then the bank is refilled as every chapter's close refills it", () => {
    const game = atSecure();
    expect(game.state.turn.banked).toBe(cap);
    // the last chapter is followed by none.
    expect(game.view().chapter).toEqual({ current: SECURE, items: [{ id: "secure", met: false }], done: expect.arrayContaining([SEND_OFF, LANDING]) as unknown, closes: false, next: null });
  });
});

describe("secure, by each of its paths", () => {
  test("[R-CHAPTER-002] [R-CHAPTER-007] given Secure in hand, when a settled status is granted, then Secure closes, the bank is refilled and no chapter follows", () => {
    const game = atSecure();
    game.endTurn();
    expect(game.state.turn.banked).toBe(cap - 1);
    applyEffects(game, [{ type: "status/grant", status: "status.uk-settled" }]);
    const result = game.endTurn();
    expect(closed(result)).toEqual([{ type: "chapter/closed", chapter: SECURE, next: null }]);
    expect(game.state.turn.banked).toBe(cap);
    expect(game.view().chapter).toMatchObject({ current: null, items: [] });
  });

  test("[R-CHAPTER-002] [R-CHAPTER-007] given Secure in hand, when Ada comes home by choice with the fare paid, then Secure closes", () => {
    const game = atSecure();
    applyEffects(game, [{ type: "money/add", currency: "GBP", pocket: "bank", amount: 500000, reason: "gift" }]);
    game.accept({ type: "return/home" });
    expect(game.state.place.returns.map((back) => back.shape)).toEqual(["by-choice"]);
    const result = game.endTurn();
    expect(closed(result)).toEqual([{ type: "chapter/closed", chapter: SECURE, next: null }]);
  });

  test("[R-CHAPTER-002] given Secure in hand, when Ada comes home broke, then Secure stays open: the home path needs papers or a choice", () => {
    const game = atSecure();
    // The fare is paid and leaves nothing: broke (R-PLACE-005).
    const pockets = game.state.wallet.pockets;
    applyEffects(game, [
      { type: "money/take", currency: "NGN", pocket: "any", amount: pockets.NGN.bank + pockets.NGN.cash, reason: "mishap" },
      { type: "money/take", currency: "USD", pocket: "any", amount: pockets.USD.bank + pockets.USD.cash, reason: "mishap" },
      { type: "money/take", currency: "GBP", pocket: "any", amount: pockets.GBP.bank + pockets.GBP.cash, reason: "mishap" },
      { type: "money/add", currency: "GBP", pocket: "bank", amount: content.country["country.uk"]!.fare, reason: "gift" },
    ]);
    game.accept({ type: "return/home" });
    expect(game.state.place.returns.map((back) => back.shape)).toEqual(["broke"]);
    const result = game.endTurn();
    expect(closed(result)).toEqual([]);
    expect(game.state.chapter.current).toBe(SECURE);
  });

  test("[R-CHAPTER-002] given Secure in hand and a broke return, when a second route is granted at home, then Secure closes", () => {
    const game = atSecure();
    const pockets = game.state.wallet.pockets;
    applyEffects(game, [
      { type: "money/take", currency: "NGN", pocket: "any", amount: pockets.NGN.bank + pockets.NGN.cash, reason: "mishap" },
      { type: "money/take", currency: "USD", pocket: "any", amount: pockets.USD.bank + pockets.USD.cash, reason: "mishap" },
      { type: "money/take", currency: "GBP", pocket: "any", amount: pockets.GBP.bank + pockets.GBP.cash, reason: "mishap" },
      { type: "money/add", currency: "GBP", pocket: "bank", amount: content.country["country.uk"]!.fare, reason: "gift" },
    ]);
    game.accept({ type: "return/home" });
    game.endTurn();
    expect(game.state.chapter.current).toBe(SECURE);
    // A grant takes years of play; the route's state is written as the decision would leave it.
    game.state = { ...game.state, route: { ...game.state.route, "route.uk-care": { ...game.state.route["route.uk-care"]!, state: "granted" } } };
    const result = game.endTurn();
    expect(closed(result)).toEqual([{ type: "chapter/closed", chapter: SECURE, next: null }]);
  });
});

describe("after the last chapter", () => {
  test("[R-CHAPTER-007] given Secure closed, when the view is read, then there is no current chapter and the goals are what it shows", () => {
    const game = atSecure();
    applyEffects(game, [{ type: "status/grant", status: "status.uk-settled" }]);
    game.endTurn();
    expect(game.state.chapter.current).toBeNull();
    // Since decision 0035's re-recording, Ada reaches Secure four months after the flight, so the months abroad are played on to six.
    while (game.state.turn.month - game.state.place.movedMonth < 6) monthAbroad(game);
    const view: PlayerView = viewFor(readOf(game));
    expect(view.chapter.current).toBeNull();
    // Six months abroad: the first goal of the long game is open.
    expect(view.goals.open.map((goal) => goal.id)).toContain("goal.own-door");
    for (const key of [`${SECURE}.close`, "line.goal.done", "line.goal.opened"]) expect(text[key]).toBeTruthy();
  });

  test("[R-CHAPTER-007] given the real chapters, when chapters 5 and 6 are read, then Secure is one item whose `any` holds the three paths of the page", () => {
    const secure = content.chapter[SECURE]!;
    expect(secure.items.map((item) => item.id)).toEqual(["secure"]);
    const requirement = secure.items[0]!.requirement;
    expect(requirement.type).toBe("any");
    const paths = requirement.type === "any" ? requirement.of : [];
    expect(paths[0]).toEqual({ type: "status/is", statuses: ["status.uk-settled", "status.uk-citizen", "status.ca-resident", "status.ca-citizen"] });
    expect(paths[1]).toEqual({ type: "place/returned", shapes: ["with-papers", "by-choice"] });
    expect(paths.slice(2).every((path) => path.type === "route/state" && path.in.length === 1 && path.in[0] === "granted")).toBe(true);
  });
});

describe("months abroad", () => {
  test("[R-CHAPTER-005] given Landing in hand, when the view is read each month, then each item shows met or not as the state is", () => {
    const game = flownAda(content);
    game.endTurn();
    for (let month = 0; month < 3; month += 1) {
      const items = game.view().chapter.items;
      const entry = content.chapter[LANDING]!;
      expect(items).toEqual(entry.items.map((item) => ({ id: item.id, met: check(readOf(game), item.requirement).met })));
      monthAbroad(game);
    }
  });
});
