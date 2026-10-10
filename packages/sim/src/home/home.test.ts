// Where the character lives at home: docs/rules/home.md R-HOME-001 to 005, played through the
// harness on the real content. Makoko is cheaper than the family house, and some months the
// settlement is cleared.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { bp, divFloor } from "../engine/int";
import { checkInvariants } from "../engine/invariants";
import { applyOverlay } from "../engine/overlay";
import type { Accepted, BaseEvent, Content, Effect, Id, PersonFacts, Tuning, World } from "../engine/types";
import { homeCharges } from "./home.logic";
import { applyEffects } from "../route/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { standInWorld } from "../world/standIn";

const MAKOKO = "place.makoko" as const;
const FAMILY = "place.family-house" as const;
const FAMILY_UPKEEP: Id<"obligation"> = "obligation.upkeep";
const MAKOKO_UPKEEP: Id<"obligation"> = "obligation.upkeep-makoko";
const TAKEN_IN: Id<"offer"> = "offer.taken-in";
const WHERE_NEXT: Id<"offer"> = "offer.where-next";
const STANDING: Id<"quality"> = "quality.standing";
const WELLBEING: Id<"quality"> = "quality.wellbeing";
const { home } = content.tuning;
/** Ada's family upkeep, from her starting life (scenario.data.ts). */
const ADA_UPKEEP = content.scenario["scenario.ada"]!.obligations.find((owed) => owed.obligation === FAMILY_UPKEEP)!.amount;

/** The real content with some of the home's numbers changed, as an overlay would. */
function tuned(change: Partial<Tuning["home"]>, more: Record<string, unknown> = {}): Content {
  return applyOverlay(content, { version: `test-home-${JSON.stringify(change)}`, tuning: { home: change }, ...more });
}

const NEVER = tuned({ evictionBp: 0 });
const ALWAYS = tuned({ evictionBp: 10000 });

function ada(base: Content = content, seed = "seed-1"): Game {
  return start({ content: base, scenario: "scenario.ada", seed });
}

/** Leaves exactly this much naira in cash and in the bank. */
function setNaira(game: Game, cash: number, bank: number): void {
  const pocket = game.state.wallet.pockets.NGN;
  const effects: Effect[] = [];
  if (pocket.cash > 0) effects.push({ type: "money/take", currency: "NGN", pocket: "cash", amount: pocket.cash, reason: "mishap" });
  if (pocket.bank > 0) effects.push({ type: "money/take", currency: "NGN", pocket: "bank", amount: pocket.bank, reason: "mishap" });
  if (cash > 0) effects.push({ type: "money/add", currency: "NGN", pocket: "cash", amount: cash, reason: "gift" });
  if (bank > 0) effects.push({ type: "money/add", currency: "NGN", pocket: "bank", amount: bank, reason: "gift" });
  applyEffects(game, effects);
}

/** Ends a month resting, granting turns first when the bank is empty. */
function month(game: Game): Accepted {
  if (game.state.turn.banked < 1) game.grant(game.content.tuning.turn.cap);
  return game.endTurn();
}

function eventsOf(result: { events: BaseEvent[] }, type: string): (BaseEvent & Record<string, unknown>)[] {
  return result.events.filter((event) => event.type === type) as (BaseEvent & Record<string, unknown>)[];
}

/** What went out under the upkeep's reason this step. */
function upkeepPaid(result: { events: BaseEvent[] }): number {
  return eventsOf(result, "wallet/debited")
    .filter((event) => event["reason"] === "upkeep" && event["currency"] === "NGN")
    .reduce((sum, event) => sum + (event["amount"] as number), 0);
}

function openEntries(game: Game): Id<"obligation">[] {
  return Object.values(game.state.obligation.items)
    .map((item) => item.entry)
    .sort();
}

function offerOf(game: Game, entry: Id<"offer">) {
  return game.view().offers.find((offer) => offer.entry === entry);
}

function choose(game: Game, entry: Id<"offer">, choice: string): Accepted {
  const offer = offerOf(game, entry);
  if (offer === undefined) throw new Error(`${entry} is not open.`);
  return game.accept({ type: "offer/choose", offer: offer.id, choice });
}

/** Ada in Makoko with plenty of naira, on content whose eviction chance is `base`'s. */
function inMakoko(base: Content, seed = "seed-1"): Game {
  const game = ada(base, seed);
  setNaira(game, 0, 5_000_000_00);
  game.accept({ type: "home/move", to: MAKOKO });
  return game;
}

/** Ada evicted in her first month in Makoko, holding `cash` in cash and plenty in the bank. */
function evicted(cash = 50_000_00): { game: Game; result: Accepted } {
  const game = inMakoko(ALWAYS);
  setNaira(game, cash, 5_000_000_00);
  return { game, result: month(game) };
}

const FRIEND_FACTS: PersonFacts = {
  label: "player",
  ageMonths: 300,
  where: "home",
  country: null,
  status: null,
  statusMonthsLeft: null,
  monthsInCountry: 0,
  job: null,
  meetsFloor: {},
  eduLevel: 3,
  englishBand: null,
  home: "city",
  joint: null,
  funds: null,
  assistanceTaken: 0,
  sponsorReady: null,
};

/** Joins a real player in the partner slot as `pair-1`, with these facts, and returns the bond. */
function joined(game: Game, facts: PersonFacts = FRIEND_FACTS): string {
  game.accept({ type: "people/invite", slot: "partner", looking: "partner", fill: "to-start-out-with-me" });
  game.accept({ type: "people/link", slot: "partner", pair: "pair-1", facts }, "authority");
  const found = Object.entries(game.state.people.bonds).find(([, bond]) => bond.with.kind === "player");
  if (found === undefined) throw new Error("The link made no bond.");
  return found[0];
}

describe("the numbers", () => {
  test("[R-HOME-002] [R-HOME-003] [R-HOME-004] [R-HOME-005] given the content, when the home's tuning is read, then it holds the page's numbers", () => {
    expect(home).toEqual({ makokoUpkeep: 25_000_00, evictionBp: 500, evictionLossNaira: 20_000_00, guestMonths: 3, hostBp: 2500, returnStanding: -5 });
    expect(content.obligation[MAKOKO_UPKEEP]).toMatchObject({ type: "upkeep", currency: "NGN", amount: home.makokoUpkeep, sink: "upkeep" });
    expect(content.obligation[MAKOKO_UPKEEP]?.onMiss).toEqual(content.obligation[FAMILY_UPKEEP]?.onMiss);
  });
});

describe("the slice", () => {
  test("[R-HOME-001] given a new life, when it starts, then the character lives at the family house with no guest and no move made", () => {
    const game = ada();
    expect(game.state.home).toEqual({ place: FAMILY, since: 0, guest: null, moved: null, evicted: null, hosting: null });
    // the view carries the card's moves too.
    expect(game.view().home).toEqual({
      place: FAMILY,
      since: 0,
      guest: null,
      rent: { currency: "NGN", amount: ADA_UPKEEP },
      evictionBp: home.evictionBp,
      moved: null,
      moves: [{ to: MAKOKO, monthly: { currency: "NGN", amount: home.makokoUpkeep }, now: home.makokoUpkeep, shut: null }],
    });
  });

  test("[R-HOME-001] given a life in Makoko that flies abroad, when months pass there at a sure eviction chance, then the slice is kept as it was and never drawn on", () => {
    const game = inMakoko(ALWAYS);
    const before = game.state.home;
    applyEffects(game, [{ type: "place/move", to: "abroad", country: "country.uk" }]);
    for (let i = 0; i < 3; i += 1) {
      const result = month(game);
      expect(eventsOf(result, "home/evicted")).toEqual([]);
    }
    expect(game.state.home).toEqual(before);
    expect(game.state.draws.home ?? 0).toBe(0);
  });
});

describe("coming back", () => {
  test("[R-HOME-001] [R-HOME-002] given a life that left from Makoko, when it comes home, then the family house takes it back at its own charge, the card says so at once and the slice follows at the next month, with no draw on the water", () => {
    const game = inMakoko(ALWAYS);
    applyEffects(game, [{ type: "place/move", to: "abroad", country: "country.uk" }]);
    month(game);
    applyEffects(game, [{ type: "place/move", to: "home", country: null }]);
    expect(openEntries(game)).toContain(FAMILY_UPKEEP);
    expect(openEntries(game)).not.toContain(MAKOKO_UPKEEP);
    expect(game.view().home.place).toBe(FAMILY);
    const result = month(game);
    expect(eventsOf(result, "home/taken-back")).toHaveLength(1);
    expect(eventsOf(result, "home/evicted")).toEqual([]);
    expect(game.state.home).toMatchObject({ place: FAMILY, guest: null });
    expect(game.state.draws.home ?? 0).toBe(0);
    expect(checkInvariants(game.state, content)).toEqual([]);
  });
});

describe("moving", () => {
  test("[R-HOME-002] [R-WALLET-018] given Ada at the family house with the rent split across bank and cash, when she moves to Makoko, then the first month's rent, over the line for cash, comes out of the bank first then cash, the family's upkeep closes and Makoko's opens at the tuning's charge", () => {
    const game = ada();
    const bank = 10_000_00;
    expect(home.makokoUpkeep).toBeGreaterThan(content.tuning.wallet.cashUpTo);
    setNaira(game, 1_000_000_00, bank);
    const result = game.accept({ type: "home/move", to: MAKOKO });
    const debits = eventsOf(result, "wallet/debited").map((event) => [event["pocket"], event["amount"], event["reason"]]);
    expect(debits).toEqual([
      ["bank", bank, "upkeep"],
      ["cash", home.makokoUpkeep - bank, "upkeep"],
    ]);
    expect(openEntries(game)).toEqual([MAKOKO_UPKEEP]);
    expect(Object.values(game.state.obligation.items)[0]?.amount).toBe(home.makokoUpkeep);
    expect(game.state.home).toMatchObject({ place: MAKOKO, since: 0, moved: 0, guest: null });
    expect(result.lines.map((line) => line.key)).toContain("line.home.moved");
    expect(game.view().home.rent).toEqual({ currency: "NGN", amount: home.makokoUpkeep });
    expect(checkInvariants(game.state, content)).toEqual([]);
  });

  test("[R-HOME-002] given Ada one naira short of the rent, when she moves to Makoko, then it is refused with cannot-afford; with the rent exactly held it is accepted", () => {
    const short = ada();
    setNaira(short, home.makokoUpkeep - 100, 0);
    short.expectRejected({ type: "home/move", to: MAKOKO }, "cannot-afford");
    const exact = ada();
    setNaira(exact, home.makokoUpkeep - 100, 100);
    exact.accept({ type: "home/move", to: MAKOKO });
    expect(exact.state.wallet.pockets.NGN).toMatchObject({ cash: 0, bank: 0 });
  });

  test("[R-HOME-002] given Ada at the family house, when she asks to move to where she lives or to a place that is no home, then each is refused", () => {
    const game = ada();
    expect(game.expectRejected({ type: "home/move", to: FAMILY }, "not-legal").code).toBe("not-legal");
    expect(game.expectRejected({ type: "home/move", to: "place.ojuelegba" as typeof MAKOKO }, "unknown-id").code).toBe("unknown-id");
    expect(game.state.home.place).toBe(FAMILY);
  });

  test("[R-HOME-002] given Ada moved to Makoko this month, when she moves back the same month, then it is refused; the next month it is accepted", () => {
    const game = inMakoko(NEVER);
    game.expectRejected({ type: "home/move", to: FAMILY }, "not-legal");
    month(game);
    game.accept({ type: "home/move", to: FAMILY });
    expect(game.state.home.place).toBe(FAMILY);
  });

  test("[R-HOME-002] given Ada abroad, when she asks to move to Makoko, then it is refused: the home is Lagos", () => {
    const game = ada();
    setNaira(game, 0, 1_000_000_00);
    applyEffects(game, [{ type: "place/move", to: "abroad", country: "country.uk" }]);
    expect(game.expectRejected({ type: "home/move", to: MAKOKO }, "not-legal").code).toBe("not-legal");
  });

  test("[R-HOME-002] given Ada in Makoko, when she moves back to the family house, then Makoko's upkeep closes, the family's reopens at her starting life's charge, and standing falls by the tuning's figure", () => {
    const game = inMakoko(NEVER);
    month(game);
    const standing = game.state.quality[STANDING]!;
    const result = game.accept({ type: "home/move", to: FAMILY });
    expect(openEntries(game)).toEqual([FAMILY_UPKEEP]);
    expect(Object.values(game.state.obligation.items)[0]?.amount).toBe(ADA_UPKEEP);
    expect(game.state.quality[STANDING]).toBe(standing + home.returnStanding);
    expect(upkeepPaid(result)).toBe(0);
    expect(game.state.home).toMatchObject({ place: FAMILY, since: 1, moved: 1 });
  });

  test("[R-HOME-002] given two lives on one seed, one moved to Makoko, when each plays four months, then each month the one in Makoko pays Makoko's charge where the other pays the family's, and keeps the difference", () => {
    const there = inMakoko(NEVER);
    const twin = ada(NEVER);
    setNaira(twin, 0, 5_000_000_00);
    const rent = home.makokoUpkeep;
    let saved = 0;
    for (let i = 0; i < 4; i += 1) {
      const a = month(there);
      const b = month(twin);
      const charged = (result: Accepted, entry: Id<"obligation">) => eventsOf(result, "obligation/charged").filter((event) => event["entry"] === entry).map((event) => event["total"]);
      const makokoCharge = charged(a, MAKOKO_UPKEEP);
      const familyCharge = charged(b, FAMILY_UPKEEP);
      expect(makokoCharge).toHaveLength(1);
      expect(familyCharge).toHaveLength(1);
      expect(upkeepPaid(a)).toBe(makokoCharge[0]);
      expect(upkeepPaid(b)).toBe(familyCharge[0]);
      saved += upkeepPaid(b) - upkeepPaid(a);
      // The same inflation lifts both charges (R-DIRECTOR-006), so the difference is never under the plain one.
      expect(upkeepPaid(b) - upkeepPaid(a)).toBeGreaterThanOrEqual(ADA_UPKEEP - rent);
    }
    const naira = (game: Game) => game.state.wallet.pockets.NGN.cash + game.state.wallet.pockets.NGN.bank;
    // The first month's rent was paid on the move; every month after, the difference stays.
    expect(naira(there) - naira(twin)).toBe(saved - rent);
  });
});

describe("the first month's rent", () => {
  test("[R-HOME-002] given Ada moved to Makoko this month, paying the first month's rent on the move, when the month ends, then the room is not charged again that month; the next month charges Makoko's rent once", () => {
    const game = ada(NEVER);
    setNaira(game, 0, 5_000_000_00);
    const moved = game.accept({ type: "home/move", to: MAKOKO });
    expect(upkeepPaid(moved)).toBe(home.makokoUpkeep);
    const first = month(game);
    expect(upkeepPaid(first)).toBe(0);
    // Nothing at the month's end says the room was charged: the move's own line told it.
    expect(first.lines.filter((line) => line.key.startsWith("line.obligation.") && line.params["obligation"] === MAKOKO_UPKEEP && line.tone !== "good")).toEqual([]);
    const second = month(game);
    const charged = eventsOf(second, "obligation/charged").filter((event) => event["entry"] === MAKOKO_UPKEEP);
    expect(charged).toHaveLength(1);
    expect(upkeepPaid(second)).toBe(charged[0]?.["total"]);
    expect(upkeepPaid(second)).toBeGreaterThanOrEqual(home.makokoUpkeep);
    expect(checkInvariants(game.state, content)).toEqual([]);
  });

  test("[R-HOME-002] [R-HOME-004] given a guest whose stay ends, when where-next is answered makoko and the month ends, then the rent the answer paid is the month's: it is not charged again that month", () => {
    const game = ada(NEVER);
    setNaira(game, 0, 5_000_000_00);
    applyEffects(game, [{ type: "offer/open", offer: WHERE_NEXT }]);
    const answered = choose(game, WHERE_NEXT, "makoko");
    expect(upkeepPaid(answered)).toBe(home.makokoUpkeep);
    expect(game.state.home.place).toBe(MAKOKO);
    expect(upkeepPaid(month(game))).toBe(0);
    expect(upkeepPaid(month(game))).toBeGreaterThanOrEqual(home.makokoUpkeep);
  });
});

describe("the home point", () => {
  test("[R-HOME-006] given Ada in Makoko, when she cooks and fetches water in a month, then the reliefs come off Makoko's upkeep, the one open", () => {
    const there = inMakoko(NEVER);
    const twin = inMakoko(NEVER);
    // the move month's rent was paid on the move, so the reliefs are read in the month after.
    month(there);
    month(twin);
    const played = there.endTurn([
      { activity: "activity.cook-at-home", param: null },
      { activity: "activity.fetch-water", param: null },
    ]);
    const plain = twin.endTurn();
    const full = upkeepPaid(plain);
    const { cookedBp, waterBp } = content.tuning.room;
    expect(upkeepPaid(played)).toBe(full - bp(full, cookedBp) - bp(full, waterBp));
    const relieved = played.lines.filter((line) => line.key.startsWith("line.obligation.relief.")).map((line) => line.params["obligation"]);
    expect(relieved).toEqual([MAKOKO_UPKEEP, MAKOKO_UPKEEP]);
  });
});

describe("eviction", () => {
  test("[R-HOME-003] given Ada in Makoko at a sure eviction chance, when the month ends, then the room is gone, the rent closes with nothing owed, standing does not fall, and the line is told straight", () => {
    const { game, result } = evicted();
    expect(game.state.home).toMatchObject({ place: null, guest: null, evicted: 1, since: 1 });
    expect(openEntries(game)).toEqual([]);
    const line = result.lines.find((candidate) => candidate.key === "line.home.evicted");
    expect(line).toMatchObject({ tone: "bad", attention: true, params: { lost: { currency: "NGN", amount: home.evictionLossNaira } } });
    expect(eventsOf(result, "quality/changed").filter((event) => event["quality"] === STANDING)).toEqual([]);
    expect(offerOf(game, TAKEN_IN)).toBeDefined();
    expect(checkInvariants(game.state, content)).toEqual([]);
  });

  test("[R-HOME-003] given Ada in Makoko at no eviction chance, when a year passes, then she is never evicted", () => {
    const game = inMakoko(NEVER);
    for (let i = 0; i < 12; i += 1) expect(eventsOf(month(game), "home/evicted")).toEqual([]);
    expect(game.state.home.place).toBe(MAKOKO);
  });

  test("[R-HOME-003] given cash under the loss, at it and over it, when the settlement is cleared, then the cash lost is what was held up to the tuning's figure, and the bank is untouched", () => {
    for (const over of [-100, 0, 100]) {
      const game = inMakoko(ALWAYS);
      // The month's rent is taken before the clearing, cash first (R-OBLIGATION-002), so the cash is set above it.
      const charge = bp(home.makokoUpkeep, 20000);
      setNaira(game, charge + home.evictionLossNaira + over, 5_000_000_00);
      const result = month(game);
      const rentFromCash = eventsOf(result, "wallet/debited").filter((event) => event["reason"] === "upkeep" && event["pocket"] === "cash").reduce((sum, event) => sum + (event["amount"] as number), 0);
      const held = charge + home.evictionLossNaira + over - rentFromCash;
      const lost = eventsOf(result, "wallet/debited").filter((event) => event["reason"] === "mishap" && event["pocket"] === "cash").map((event) => event["amount"]);
      expect(lost).toEqual([Math.min(held, home.evictionLossNaira)]);
      expect(game.state.wallet.pockets.NGN.cash).toBe(held - Math.min(held, home.evictionLossNaira));
      expect(eventsOf(result, "wallet/debited").filter((event) => event["reason"] === "mishap" && event["pocket"] === "bank")).toEqual([]);
    }
    const { game, result } = evicted(0);
    expect(game.state.wallet.pockets.NGN.cash).toBe(0);
    // With no cash held, the line names none.
    expect(result.lines.find((line) => line.key.startsWith("line.home.evicted"))?.key).toBe("line.home.evicted-no-cash");
  });

  test("[R-HOME-003] given Ada down (wellbeing under the line), when the view tells the eviction chance, then it is halved as R-LUCK-003 halves a bad offer", () => {
    const game = inMakoko(content);
    expect(game.view().home.evictionBp).toBe(home.evictionBp);
    const wellbeing = game.state.quality[WELLBEING]!;
    applyEffects(game, [{ type: "quality/add", quality: WELLBEING, amount: content.tuning.luck.downUnder - 1 - wellbeing }]);
    expect(game.view().home.evictionBp).toBe(divFloor(home.evictionBp, 2));
  });

  test("[R-HOME-003] given a bad offer sure to come up, when the eviction month ends, then no bad offer opens beside the eviction, while the same month at the family house brings it", () => {
    const overlay = { offer: { "offer.fuel-scarcity": { chanceBp: 10000 } } };
    const base = tuned({ evictionBp: 10000 }, overlay);
    const game = inMakoko(base);
    const result = month(game);
    expect(eventsOf(result, "home/evicted")).toHaveLength(1);
    const opened = eventsOf(result, "offer/opened").map((event) => (event["item"] as { entry: Id<"offer"> }).entry);
    expect(opened).toContain(TAKEN_IN);
    expect(opened.filter((entry) => content.offer[entry]?.bad === true)).toEqual([]);
    const twin = ada(base);
    const plain = eventsOf(month(twin), "offer/opened").map((event) => (event["item"] as { entry: Id<"offer"> }).entry);
    expect(plain).toContain("offer.fuel-scarcity");
  });
});

describe("taken in", () => {
  test("[R-HOME-004] given Ada evicted with no joined player at home, when the taken-in offer is read, then friend is shut and refused, someone and family are open", () => {
    const { game } = evicted();
    const offer = offerOf(game, TAKEN_IN)!;
    expect(offer.choices.map((choice) => [choice.id, choice.allowed])).toEqual([
      ["friend", false],
      ["someone", true],
      ["family", true],
    ]);
    game.expectRejected({ type: "offer/choose", offer: offer.id, choice: "friend" }, "not-legal");
  });

  test("[R-HOME-004] given a joined player abroad, when the offer is read, then friend is still shut; with the player at home it is open and taking it makes Ada their guest for the tuning's months", () => {
    const { game } = evicted();
    joined(game, { ...FRIEND_FACTS, where: "abroad", country: "country.uk" });
    expect(offerOf(game, TAKEN_IN)!.choices.find((choice) => choice.id === "friend")?.allowed).toBe(false);
    const other = evicted().game;
    const bond = joined(other);
    expect(offerOf(other, TAKEN_IN)!.choices.find((choice) => choice.id === "friend")?.allowed).toBe(true);
    const result = choose(other, TAKEN_IN, "friend");
    expect(other.state.home).toMatchObject({ place: null, guest: { host: "friend", by: bond, until: 1 + home.guestMonths } });
    expect(result.lines.find((line) => line.key === "line.home.taken-in")?.params).toEqual({ who: "home.friend", months: home.guestMonths });
  });

  test("[R-HOME-004] given Ada taken in by someone of the story, when the stay runs, then no upkeep is charged and the month it ends the where-next offer opens with makoko and family", () => {
    const { game } = evicted();
    choose(game, TAKEN_IN, "someone");
    expect(game.state.home.guest).toEqual({ host: "someone", by: "person.sib-lagos-hustle", until: 1 + home.guestMonths });
    for (let i = 1; i < home.guestMonths; i += 1) {
      const result = month(game);
      expect(upkeepPaid(result)).toBe(0);
      expect(offerOf(game, WHERE_NEXT)).toBeUndefined();
    }
    const last = month(game);
    expect(upkeepPaid(last)).toBe(0);
    expect(game.state.turn.month).toBe(1 + home.guestMonths);
    expect(offerOf(game, WHERE_NEXT)?.choices.map((choice) => [choice.id, choice.allowed])).toEqual([
      ["makoko", true],
      ["family", true],
    ]);
    choose(game, WHERE_NEXT, "makoko");
    expect(game.state.home).toMatchObject({ place: MAKOKO, guest: null });
    expect(openEntries(game)).toEqual([MAKOKO_UPKEEP]);
  });

  test("[R-HOME-004] given a guest whose stay ends short of the rent, when where-next is read, then makoko is shut and family stays open", () => {
    const { game } = evicted();
    choose(game, TAKEN_IN, "someone");
    for (let i = 0; i < home.guestMonths; i += 1) month(game);
    setNaira(game, home.makokoUpkeep - 100, 0);
    expect(offerOf(game, WHERE_NEXT)?.choices.map((choice) => [choice.id, choice.allowed])).toEqual([
      ["makoko", false],
      ["family", true],
    ]);
  });

  test("[R-HOME-004] given Ada evicted, when she takes family, then she is back at the family house at its full charge with the standing cost", () => {
    const { game } = evicted();
    const standing = game.state.quality[STANDING]!;
    choose(game, TAKEN_IN, "family");
    expect(game.state.home).toMatchObject({ place: FAMILY, guest: null });
    expect(openEntries(game)).toEqual([FAMILY_UPKEEP]);
    expect(Object.values(game.state.obligation.items)[0]?.amount).toBe(ADA_UPKEEP);
    expect(game.state.quality[STANDING]).toBe(standing + home.returnStanding);
  });

  test("[R-HOME-004] given Ada evicted, when the offer is left unanswered to the month's end, then it takes family", () => {
    const { game } = evicted();
    const result = month(game);
    expect(eventsOf(result, "offer/lapsed").find((event) => event["entry"] === TAKEN_IN)?.["choice"]).toBe("family");
    expect(game.state.home.place).toBe(FAMILY);
    expect(openEntries(game)).toEqual([FAMILY_UPKEEP]);
  });
});

describe("hosting", () => {
  test("[R-HOME-005] given a player, when they send home/host, then it is refused as not theirs; from the authority with no such pair it is unknown", () => {
    const game = ada();
    expect(game.expectRejected({ type: "home/host", pair: "pair-1", until: 3 }, "not-yours").code).toBe("not-yours");
    expect(game.expectRejected({ type: "home/host", pair: "pair-9", until: 3 }, "unknown-id", "authority").code).toBe("unknown-id");
    expect(game.state.home.hosting).toBeNull();
  });

  test("[R-HOME-005] given the authority says a joined player stays with Ada until month 2, when the months pass, then her upkeep rises by the tuning's share for those months and falls back after, with no money credited to anyone", () => {
    const game = ada();
    setNaira(game, 0, 5_000_000_00);
    joined(game);
    game.accept({ type: "home/host", pair: "pair-1", until: 2 }, "authority");
    const twin = ada();
    setNaira(twin, 0, 5_000_000_00);
    joined(twin);
    const rise = bp(ADA_UPKEEP, home.hostBp);
    const extras: number[] = [];
    const told: unknown[] = [];
    for (let i = 0; i < 3; i += 1) {
      const result = month(game);
      const plain = month(twin);
      extras.push(upkeepPaid(result) - upkeepPaid(plain));
      told.push(result.lines.find((candidate) => candidate.key === "line.home.hosting")?.params ?? null);
      expect(eventsOf(result, "wallet/credited")).toEqual(eventsOf(plain, "wallet/credited"));
    }
    expect(extras).toEqual([rise, rise, 0]);
    const line = { who: "home.guest", amount: { currency: "NGN", amount: rise } };
    expect(told).toEqual([line, line, null]);
    expect(game.state.home.hosting).toBeNull();
  });
});

/** The family house's charge on the home card of the life from sixteen (prologue.md, step 11), from content. */
function familyCardCharge(): number {
  const opens = content.prologue["home"]?.answers.find((answer) => answer.id === "family-house")?.effects.find((effect) => effect.type === "obligation/open");
  if (opens?.type !== "obligation/open" || typeof opens.amount !== "number") throw new Error("The home card's family house opens no upkeep.");
  return opens.amount;
}

/** A life from sixteen through the shop counter, its home card answered `home`. */
function fromSixteen(home: string, base: Content = content, seed = "seed-1"): Game {
  const game = start({ content: base, scenario: "scenario.prologue", seed });
  // The age step keeps the age the path reached (R-PROLOGUE-004).
  for (const answer of ["begin", "commercial", "work", "save", "nowhere", "as-is", home]) {
    const step = game.state.prologue.step;
    if (step === null) throw new Error(`The prologue closed before ${answer}.`);
    game.accept({ type: "prologue/choose", step, answer });
  }
  return game;
}

describe("a life from sixteen", () => {
  test("[R-HOME-009] given a life from sixteen at the family house, when its home charges abroad are read at the remit share, then the family's support opens at the prologue's figure and the upkeep stays at home", () => {
    const game = fromSixteen("family-house");
    const read = { state: game.state, world: game.world(), content: game.content };
    const share = game.content.tuning.remit.abroadBp;
    const abroad = homeCharges(read, ["support"], share);
    expect(abroad).toEqual([{ type: "obligation/open", obligation: "obligation.home-support", amount: bp(game.content.tuning.prologue.homeSupport, share) }]);
    const home = homeCharges(read, ["upkeep"]);
    expect(home.map((effect) => (effect.type === "obligation/open" ? effect.obligation : effect.type))).toEqual(["obligation.upkeep"]);
  });

  test("[R-HOME-002] [R-PROLOGUE-012] given a life from sixteen that moved to Makoko, when it moves back, then the family house takes it at the home card's charge for the family house, and the family talks", () => {
    const game = fromSixteen("room", NEVER);
    expect(game.state.prologue.open).toBe(false);
    game.accept({ type: "home/move", to: MAKOKO });
    month(game);
    const standing = game.state.quality[STANDING]!;
    game.accept({ type: "home/move", to: FAMILY });
    expect(openEntries(game)).toEqual([FAMILY_UPKEEP]);
    expect(Object.values(game.state.obligation.items)[0]?.amount).toBe(familyCardCharge());
    expect(game.state.quality[STANDING]).toBe(standing + home.returnStanding);
    expect(checkInvariants(game.state, content)).toEqual([]);
  });

  test("[R-HOME-004] [R-PROLOGUE-012] given a life from sixteen evicted from Makoko, when it takes the family, then it is back at the family house at the home card's charge", () => {
    const game = fromSixteen("family-house", ALWAYS);
    game.accept({ type: "home/move", to: MAKOKO });
    month(game);
    expect(offerOf(game, TAKEN_IN)).toBeDefined();
    choose(game, TAKEN_IN, "family");
    expect(game.state.home).toMatchObject({ place: FAMILY, guest: null });
    expect(openEntries(game)).toEqual([FAMILY_UPKEEP]);
    expect(Object.values(game.state.obligation.items)[0]?.amount).toBe(familyCardCharge());
  });
});

describe("the starting life's charges at home", () => {
  test("[R-HOME-009] [R-PLACE-007] given a life from sixteen at the family house, when it flies abroad and comes home, then the family house's upkeep the home card names is open again and the next month charges it", () => {
    const game = fromSixteen("family-house", NEVER);
    setNaira(game, 0, 5_000_000_00);
    expect(openEntries(game)).toEqual([FAMILY_UPKEEP]);
    applyEffects(game, [{ type: "place/move", to: "abroad", country: "country.uk" }]);
    expect(openEntries(game)).not.toContain(FAMILY_UPKEEP);
    month(game);
    applyEffects(game, [{ type: "place/move", to: "home", country: null }]);
    const upkeep = Object.values(game.state.obligation.items).filter((item) => item.entry === FAMILY_UPKEEP);
    expect(upkeep.map((item) => item.amount)).toEqual([familyCardCharge()]);
    const due = game.view().obligations.find((owed) => owed.entry === FAMILY_UPKEEP)?.due;
    expect(due).toBeGreaterThan(0);
    expect(upkeepPaid(month(game))).toBe(due);
    expect(game.view().home).toMatchObject({ place: FAMILY, rent: { currency: "NGN", amount: due } });
  });

  test("[R-HOME-009] given a fixed life abroad, when it lands, then the family's support opens from its starting obligations at the remit share, and a life from sixteen opens the prologue's support at the same share", () => {
    const fixed = start({ content, scenario: "scenario.zainab", seed: "seed-1" });
    const owed = content.scenario["scenario.zainab"]!.obligations.find((each) => content.obligation[each.obligation]?.type === "support");
    if (owed === undefined) throw new Error("Zainab's starting life has no support.");
    applyEffects(fixed, [{ type: "place/move", to: "abroad", country: "country.uk" }]);
    expect(Object.values(fixed.state.obligation.items).filter((item) => item.entry === owed.obligation).map((item) => item.amount)).toEqual([bp(owed.amount, content.tuning.remit.abroadBp)]);
    const sixteen = fromSixteen("family-house", NEVER);
    applyEffects(sixteen, [{ type: "place/move", to: "abroad", country: "country.uk" }]);
    const support = Object.values(sixteen.state.obligation.items).filter((item) => content.obligation[item.entry]?.type === "support");
    expect(support.map((item) => `${item.entry} ${String(item.amount)}`)).toEqual([`obligation.home-support ${String(bp(content.tuning.prologue.homeSupport, content.tuning.remit.abroadBp))}`]);
  });
});

describe("the home card's moves", () => {
  test("[R-HOME-008] given Ada at the family house with the rent held, when the view is read, then the one move is to Makoko, open, with its rent a month and the first month's rent taken on the move", () => {
    const game = ada(NEVER);
    setNaira(game, 0, 5_000_000_00);
    expect(game.view().home.moves).toEqual([{ to: MAKOKO, monthly: { currency: "NGN", amount: home.makokoUpkeep }, now: home.makokoUpkeep, shut: null }]);
  });

  test("[R-HOME-008] given Ada short of the first month's rent, when the view is read, then the move is shut as short and the command refuses it the same way; once moved, the move back is shut as moved and refused", () => {
    const game = ada(NEVER);
    setNaira(game, 0, home.makokoUpkeep - 1);
    expect(game.view().home.moves.map((move) => move.shut)).toEqual(["short"]);
    game.expectRejected({ type: "home/move", to: MAKOKO }, "cannot-afford");
    setNaira(game, 0, 5_000_000_00);
    game.accept({ type: "home/move", to: MAKOKO });
    expect(game.view().home.moves).toEqual([{ to: FAMILY, monthly: { currency: "NGN", amount: ADA_UPKEEP }, now: 0, shut: "moved" }]);
    game.expectRejected({ type: "home/move", to: FAMILY }, "not-legal");
  });

  test("[R-HOME-008] given Ada abroad, when the view is read, then the card offers no move", () => {
    const game = ada(NEVER);
    applyEffects(game, [{ type: "place/move", to: "abroad", country: "country.uk" }]);
    expect(game.view().home.moves).toEqual([]);
  });

  test("[R-HOME-008] given inflation above nothing, when the view is read, then the charge where Ada lives and each move's charge a month are the bill's, inflation included", () => {
    const inflation = 1500;
    const worldAt = (tick: number): World => {
      const world = standInWorld("world-1", tick, NEVER);
      return { ...world, vars: { ...world.vars, "var.inflation": inflation } };
    };
    const game = start({ content: NEVER, scenario: "scenario.ada", seed: "seed-1", worldAt });
    setNaira(game, 0, 5_000_000_00);
    const bill = game.view().obligations.find((owed) => owed.entry === FAMILY_UPKEEP)?.due;
    expect(bill).toBe(ADA_UPKEEP + bp(ADA_UPKEEP, inflation));
    expect(game.view().home.rent).toEqual({ currency: "NGN", amount: bill });
    expect(game.view().home.moves[0]?.monthly).toEqual({ currency: "NGN", amount: home.makokoUpkeep + bp(home.makokoUpkeep, inflation) });
    game.accept({ type: "home/move", to: MAKOKO });
    month(game);
    const rent = game.view().obligations.find((owed) => owed.entry === MAKOKO_UPKEEP)?.due;
    expect(game.view().home.rent).toEqual({ currency: "NGN", amount: rent });
    expect(game.view().home.moves[0]?.monthly).toEqual({ currency: "NGN", amount: bill });
  });
});

describe("a start on the water", () => {
  test("[R-PROLOGUE-012] [R-HOME-001] [R-HOME-002] given a life from sixteen whose home card answers Makoko, when the prologue closes, then it lives in Makoko's room from the start, owes only Makoko's rent at the page's charge, has made no move, and its first month charges that rent", () => {
    const game = fromSixteen("makoko", NEVER);
    expect(game.state.prologue.open).toBe(false);
    expect(game.state.home).toEqual({ place: MAKOKO, since: 0, guest: null, moved: null, evicted: null, hosting: null });
    expect(openEntries(game)).toEqual([MAKOKO_UPKEEP]);
    expect(game.view().home).toMatchObject({ place: MAKOKO, rent: { currency: "NGN", amount: home.makokoUpkeep }, moved: null });
    expect(checkInvariants(game.state, NEVER)).toEqual([]);
    const result = month(game);
    expect(upkeepPaid(result)).toBe(home.makokoUpkeep);
    // The family house is still there to go back to, at its own charge.
    game.accept({ type: "home/move", to: FAMILY });
    expect(openEntries(game)).toEqual([FAMILY_UPKEEP]);
    expect(Object.values(game.state.obligation.items)[0]?.amount).toBe(familyCardCharge());
  });

  test("[R-PROLOGUE-012] given a life from sixteen in Makoko's room from the start, when it asks to move back in its first month, then the move is open: the start was no move", () => {
    const game = fromSixteen("makoko", NEVER);
    game.accept({ type: "home/move", to: FAMILY });
    expect(game.state.home).toMatchObject({ place: FAMILY, moved: 0 });
  });
});
