import { fc, test } from "@fast-check/vitest";
import { content, text } from "@japacity/content";
import { describe, expect } from "vitest";

import { check } from "../engine/check";
import { checkInvariants } from "../engine/invariants";
import type { Content, Effect, Id, PersonFacts, SlotPick, State } from "../engine/types";
import { registry } from "../kinds";
import { hiddenPaths } from "../engine/view";
import { applyEffects } from "../testing/route.journey";
import { legalCommands } from "../testing/legal";
import type { Game, Loose, StartOptions } from "../testing/play";
import { finishPrologue, start } from "../testing/play";
import { bondWith } from "../testing/read";
import { standInWorld } from "../world/standIn";
import { computerFacts } from "./person.facts";
import { factsOf, WEDDING_SPOTS } from "./person.logic";
import { PROLOGUE, BANKER, UK_DEPENDANT } from "../testing/ids";

const TOBI: Id<"person"> = "person.tobi-bank";
const AMAKA: Id<"person"> = "person.amaka-nurse";
const KELECHI: Id<"person"> = "person.kelechi-dev";
const PAPERS: Id<"person"> = "person.papers-uk";
const SEE: SlotPick = { activity: "activity.see-someone", param: null };
const CALL: SlotPick = { activity: "activity.call-someone", param: null };
const RECOVERY: Id<"offer"> = "offer.people-recovery";
const PAPERS_OFFER: Id<"offer"> = "offer.papers-marriage";
const numbers = content.tuning.people;

/** A deep copy of plain data: content and states are plain JSON (engine:state-is-plain-data). */
function copyOf<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** A copy of the real content with some numbers changed for the test. */
function tuned(change: (copy: Content) => void): Content {
  const copy = copyOf(content);
  change(copy);
  return copy;
}

/** Every computer partner agrees at once and waits on nothing of its own. */
function eager(copy: Content): void {
  for (const entry of Object.values(copy.person)) {
    entry.behaviour.agreeBp = 10000;
    entry.behaviour.courtMonths = 0;
    entry.behaviour.marryAfterMonths = 0;
  }
}

function life(options: StartOptions = {}): Game {
  return start({ scenario: BANKER, content, ...options });
}

function turn(game: Game, slots: SlotPick[] = []) {
  if (game.state.turn.banked === 0) game.grant(1);
  return game.endTurn(slots);
}

function court(game: Game, person: Id<"person">): string {
  game.accept({ type: "people/court", with: person });
  return bondWith(game, person);
}

/** Courts a computer at home and meets them until the bond holds the moments to become partners. */
function toCourted(game: Game, person: Id<"person"> = TOBI): string {
  const bond = court(game, person);
  for (let index = 0; index < numbers.partnerMoments; index += 1) turn(game, [SEE]);
  return bond;
}

function toPartner(game: Game, person: Id<"person"> = TOBI): string {
  const bond = toCourted(game, person);
  game.accept({ type: "people/propose", bond, step: "partner" });
  expect(game.state.people.bonds[bond]?.stage).toBe("partner");
  return bond;
}

function qualityChange(events: readonly { type: string }[], quality: Id<"quality">, source: string): number {
  return events
    .filter((event): event is { type: "quality/changed"; quality: Id<"quality">; amount: number; source: string } => event.type === "quality/changed")
    .filter((event) => event.quality === quality && event.source === source)
    .reduce((sum, event) => sum + event.amount, 0);
}

const FACTS: PersonFacts = {
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

/** A life with a friend linked in the partner slot as `pair-1`, returning the bond. */
function linked(game: Game, facts: PersonFacts = FACTS): string {
  game.accept({ type: "people/invite", slot: "partner", looking: "partner", fill: "to-start-out-with-me" });
  game.accept({ type: "people/link", slot: "partner", pair: "pair-1", facts }, "authority");
  const found = Object.entries(game.state.people.bonds).find(([, bond]) => bond.with.kind === "player");
  if (found === undefined) throw new Error("The link made no bond.");
  return found[0];
}

describe("slots", () => {
  test("[person:family-and-partner-slots] given a fixed life with two siblings, when it starts and plays its first turn, then the partner slot is empty, the parents are computer-run, and each sibling slot holds a drawn computer life", () => {
    const game = life();
    const slots = game.state.people.slots;
    expect(slots.partner).toEqual({ state: "empty", bond: null, person: null, invite: null });
    expect(slots.mother?.state).toBe("computer");
    expect(slots.father?.state).toBe("computer");
    expect(Object.keys(slots).filter((key) => key.startsWith("sibling-"))).toEqual(["sibling-1", "sibling-2"]);
    turn(game);
    for (const key of ["sibling-1", "sibling-2"]) {
      const slot = game.state.people.slots[key]!;
      expect(slot.state).toBe("computer");
      expect(content.person[slot.person!]?.role).toBe("sibling");
      expect(game.state.people.bonds[slot.bond!]).toMatchObject({ role: "sibling", stage: "connected", with: { kind: "computer", entry: slot.person } });
    }
    const view = game.view().people;
    expect(view.slots["sibling-1"]?.label).toBe("computer");
    expect(view.slots.mother?.label).toBe("computer");
    expect(view.slots.partner?.label).toBeNull();
  });

  test("[person:family-and-partner-slots] [person:computer-siblings-drawn-with-family] given a prologue life, when the prologue closes and a turn is played, then it has as many sibling slots as the family draw gave", () => {
    const game = start({ scenario: PROLOGUE, content, seed: "siblings" });
    expect(Object.keys(game.state.people.slots).filter((key) => key.startsWith("sibling-"))).toEqual([]);
    finishPrologue(game);
    turn(game);
    const count = game.state.prologue.draw?.siblings ?? 0;
    expect(count).toBeGreaterThan(0);
    expect(Object.keys(game.state.people.slots).filter((key) => key.startsWith("sibling-"))).toHaveLength(count);
  });

  test.prop([fc.string({ minLength: 1, maxLength: 8 })], { numRuns: 20 })(
    "[person:computer-siblings-drawn-with-family] given any seed, when the siblings are drawn, then each is a sibling entry aged within its entry's gap from the character",
    (seed) => {
      const game = life({ seed });
      const age = game.state.quality["quality.age-months"] ?? 0;
      turn(game);
      for (const bond of Object.values(game.state.people.bonds)) {
        const entry = bond.with.kind === "computer" ? content.person[bond.with.entry] : undefined;
        expect(entry?.role).toBe("sibling");
        const [low, high] = entry!.profile.ageGapMonths;
        // One month passes after the draw.
        const gap = (bond.facts?.ageMonths ?? 0) - 1 - age;
        expect(gap).toBeGreaterThanOrEqual(low);
        expect(gap).toBeLessThanOrEqual(high);
      }
      expect(checkInvariants(game.state, content)).toEqual([]);
    },
  );

  test("[person:computer-siblings-drawn-with-family] given one sibling entry holding all the weight and another none, when the siblings are drawn, then only the weighted one is drawn", () => {
    const only = tuned((copy) => {
      for (const entry of Object.values(copy.person)) if (entry.role === "sibling") entry.weight = entry.id === "person.sib-gulf" ? 1 : 0;
    });
    const game = life({ content: only });
    turn(game);
    const people = Object.values(game.state.people.slots).map((slot) => slot.person).filter((person) => person !== null);
    expect(people).toEqual(["person.sib-gulf", "person.sib-gulf"]);
  });

  test("[person:computer-siblings-drawn-with-family] [person:computer-partner-facts] given the sibling who leaves for the Gulf at month 12, when the months pass, then the facts show home at month 11 and the Gulf with its status from month 12", () => {
    const only = tuned((copy) => {
      for (const entry of Object.values(copy.person)) if (entry.role === "sibling") entry.weight = entry.id === "person.sib-gulf" ? 1 : 0;
    });
    const game = life({ content: only });
    for (let month = 1; month <= 11; month += 1) turn(game);
    const facts = () => game.state.people.bonds["sibling-1"]?.facts;
    expect(facts()).toMatchObject({ where: "home", country: null, status: null });
    turn(game);
    expect(facts()).toMatchObject({ where: "abroad", country: "country.uae", status: "status.gulf-worker" });
  });

  test("[person:computer-siblings-drawn-with-family] given the sibling in Canada, when its facts are built either side of its settling month, then the status changes at that month", () => {
    const entry = content.person["person.sib-ca"]!;
    const read = { state: life().state, world: standInWorld("world-1", 0, content), content };
    const settles = entry.profile.settledFromMonth!;
    expect(computerFacts(read, entry, 400, settles - 1).status).toBe(entry.profile.status);
    expect(computerFacts(read, entry, 400, settles).status).toBe(entry.profile.settledStatus);
  });
});

describe("filling a slot", () => {
  test("[person:three-ways-to-fill-slots] [person:computer-candidates-labelled] given the matchmaker off, when the candidates are read, then every one is a computer partner whose conditions hold, never the papers partner, each labelled computer", () => {
    expect(numbers.matchmaker).toBe(false);
    const game = life();
    const view = game.view().people;
    expect(view.candidates.length).toBeGreaterThan(0);
    for (const candidate of view.candidates) {
      expect(content.person[candidate.person]?.role).toBe("partner");
      expect(candidate.role).toBe("partner");
    }
    expect(view.candidates.map((candidate) => candidate.person)).not.toContain(PAPERS);
    expect(view.candidates.map((candidate) => candidate.person)).toContain(TOBI);
  });

  test.each([
    [251, false],
    [252, true],
  ])("[person:computer-candidates-labelled] given a character aged %i months, when the candidates are read, then Tobi (21 or more) is listed: %s", (age, listed) => {
    const young = tuned((copy) => {
      copy.scenario[BANKER]!.qualities["quality.age-months"] = age;
    });
    const game = life({ content: young });
    expect(game.view().people.candidates.some((candidate) => candidate.person === TOBI)).toBe(listed);
  });

  test("[person:computer-candidates-labelled] given a bond with Tobi, when the candidates are read, then Tobi is no longer listed", () => {
    const game = life();
    court(game, TOBI);
    expect(game.view().people.candidates.map((candidate) => candidate.person)).not.toContain(TOBI);
  });

  test("[person:invite-fills-a-slot] given an empty partner slot, when a card is put out and taken back, then the slot is invited with its terms and then empty again", () => {
    const game = life();
    game.accept({ type: "people/invite", slot: "partner", looking: "partner", fill: "who-codes" });
    expect(game.state.people.slots.partner).toMatchObject({ state: "invited", invite: { looking: "partner", fill: "who-codes" } });
    game.expectRejected({ type: "people/invite", slot: "partner", looking: "partner" }, "not-legal");
    game.accept({ type: "people/invite", slot: "partner" });
    expect(game.state.people.slots.partner).toMatchObject({ state: "empty", invite: null });
  });

  test("[person:invite-fills-a-slot] given the slots, when a card is asked for a parent, for the wrong role, with a fill not on the list, or for no slot, then each is rejected", () => {
    const game = life();
    game.expectRejected({ type: "people/invite", slot: "mother", looking: "sibling" }, "not-legal");
    game.expectRejected({ type: "people/invite", slot: "partner", looking: "sibling" }, "not-legal");
    game.expectRejected({ type: "people/invite", slot: "partner", looking: "partner", fill: "rich" }, "not-legal");
    game.expectRejected({ type: "people/invite", slot: "cousin", looking: "partner" }, "unknown-id");
    game.expectRejected({ type: "people/invite", slot: "partner" }, "not-legal");
    expect(game.state.people.slots.partner?.state).toBe("empty");
  });

  test("[person:invite-fills-a-slot] given a partner card out, when the authority links a friend, then a bond opens at connected and the slot waits for partners", () => {
    const game = life();
    game.accept({ type: "people/invite", slot: "partner", looking: "partner" });
    game.expectRejected({ type: "people/link", slot: "partner", pair: "pair-1", facts: FACTS }, "not-yours");
    game.accept({ type: "people/link", slot: "partner", pair: "pair-1", facts: FACTS }, "authority");
    const bonds = Object.values(game.state.people.bonds);
    expect(bonds).toEqual([expect.objectContaining({ with: { kind: "player", pair: "pair-1" }, role: "partner", stage: "connected", facts: FACTS })]);
    expect(game.state.people.slots.partner?.state).toBe("empty");
  });

  test("[person:invite-fills-a-slot] given a sibling card out on a computer sibling, when the authority links a friend, then the slot is a player and the computer's life is gone", () => {
    const game = life();
    turn(game);
    const computer = game.state.people.slots["sibling-1"]?.bond;
    game.accept({ type: "people/invite", slot: "sibling-1", looking: "sibling", fill: "to-go-first" });
    expect(game.state.people.slots["sibling-1"]?.person).not.toBeNull();
    game.accept({ type: "people/link", slot: "sibling-1", pair: "pair-2", facts: FACTS }, "authority");
    const slot = game.state.people.slots["sibling-1"]!;
    expect(slot.state).toBe("player");
    expect(game.state.people.bonds[slot.bond!]).toMatchObject({ role: "sibling", with: { kind: "player", pair: "pair-2" } });
    expect(game.state.people.bonds[computer!]).toBeUndefined();
    expect(game.view().people.slots["sibling-1"]?.label).toBe("player");
  });

  test("[person:nobody-real-is-needed] given no friend at all, when a life courts, partners, marries and agrees a joint with computers alone, then every step works offline", () => {
    const easy = tuned((copy) => {
      eager(copy);
      copy.route["route.uk-skilled"]!.dependants = "route.uk-care";
      copy.status["status.uk-sponsored"]!.dependants = ["activity.job-uk-skilled"];
    });
    const game = life({ content: easy });
    const bond = toCourted(game, TOBI);
    game.accept({ type: "people/propose", bond, step: "partner" });
    for (let month = 0; month < numbers.marryAfterMonths; month += 1) turn(game, [SEE]);
    game.accept({ type: "people/propose", bond, step: "marry" });
    expect(game.state.people.bonds[bond]?.stage).toBe("married");
    expect(game.state.people.slots.partner).toMatchObject({ state: "computer", bond, person: TOBI });
  });
});

describe("courting", () => {
  test("[person:courting-opens-a-bond] given the courting limit, when one more is courted than it allows, then the last is rejected", () => {
    const game = life();
    const candidates = game.view().people.candidates.map((candidate) => candidate.person);
    for (const person of candidates.slice(0, numbers.maxCourting)) game.accept({ type: "people/court", with: person });
    expect(Object.values(game.state.people.bonds).filter((bond) => bond.stage === "courting")).toHaveLength(numbers.maxCourting);
    game.expectRejected({ type: "people/court", with: candidates[numbers.maxCourting]! }, "not-legal");
  });

  test("[person:courting-opens-a-bond] given the people table, when an unknown person or the papers partner is courted, then the first is unknown and the second not legal", () => {
    const game = life();
    game.expectRejected({ type: "people/court", with: "person.nobody" }, "unknown-id");
    game.expectRejected({ type: "people/court", with: PAPERS }, "not-legal");
    game.expectRejected({ type: "people/court", with: "pair-9" }, "unknown-id");
    expect(game.state.people.bonds).toEqual({});
  });

  test("[person:courting-opens-a-bond] given a name a player sent that is a number or a built-in object key, when it is courted, then it is rejected with unknown-id and nothing throws", () => {
    const game = life();
    // As the server reads it: JSON from the player, so the name need not be a string.
    game.expectRejected(JSON.parse('{ "type": "people/court", "with": 7 }') as Loose, "unknown-id");
    for (const name of ["constructor", "__proto__", "toString", "hasOwnProperty"]) game.expectRejected({ type: "people/court", with: name }, "unknown-id");
    expect(game.state.people.bonds).toEqual({});
  });

  test("[person:courting-opens-a-bond] given a friend linked at connected, when the pair is courted, then the same bond moves to courting", () => {
    const game = life();
    const bond = linked(game);
    game.accept({ type: "people/court", with: "pair-1" });
    expect(game.state.people.bonds[bond]?.stage).toBe("courting");
    game.expectRejected({ type: "people/court", with: "pair-1" }, "not-legal");
  });

  test("[person:time-together-is-an-act] given Tobi at home, when a slot sees someone, then one met moment is added from Tobi's lists, it costs the naira price under social and wellbeing rises by 3", () => {
    const game = life();
    const bond = court(game, TOBI);
    const entry = content.person[TOBI]!;
    const spentBefore = game.state.wallet.totals.out.social?.NGN ?? 0;
    const result = turn(game, [SEE]);
    const [moment] = game.state.people.bonds[bond]!.moments;
    expect(moment).toMatchObject({ n: 1, by: "me", kind: "met" });
    expect(entry.spots).toContain(moment!.spot);
    expect(entry.whats).toContain(moment!.what);
    expect((game.state.wallet.totals.out.social?.NGN ?? 0) - spentBefore).toBe(content.activity["activity.see-someone"]!.cost[0]!.amount);
    expect(qualityChange(result.events, "quality.wellbeing", "activity.see-someone")).toBe(3);
    expect(result.lines.map((line) => line.key)).toContain("line.people.met");
  });

  test("[person:time-together-is-an-act] given only a partner abroad, when the slots are offered, then calling is allowed and seeing is not, and a call adds a call moment from the calls list", () => {
    const game = life();
    const bond = court(game, KELECHI);
    const options = game.view().activities;
    expect(options.find((option) => option.id === CALL.activity)?.allowed).toBe(true);
    expect(options.find((option) => option.id === SEE.activity)?.allowed).toBe(false);
    game.expectRejected({ type: "turn/end", slots: [SEE] }, "not-legal");
    turn(game, [CALL]);
    const [moment] = game.state.people.bonds[bond]!.moments;
    expect(moment).toMatchObject({ kind: "call", spot: null });
    expect(content.person[KELECHI]!.calls).toContain(moment!.what);
  });

  test("[person:time-together-is-an-act] given no bond, when the slots are offered, then neither seeing nor calling someone is allowed", () => {
    const options = life().view().activities;
    expect(options.find((option) => option.id === SEE.activity)?.allowed).toBe(false);
    expect(options.find((option) => option.id === CALL.activity)?.allowed).toBe(false);
  });

  test("[person:time-together-is-an-act] given a friend courted, when the authority sends their moments, then they join the bond's record once each, in order", () => {
    const game = life();
    const bond = linked(game);
    game.accept({ type: "people/court", with: "pair-1" });
    const moments = [{ n: 1, by: "them" as const, kind: "met" as const, spot: "beach", what: "talked", tick: 0 }];
    game.accept({ type: "people/moments", pair: "pair-1", moments }, "authority");
    game.accept({ type: "people/moments", pair: "pair-1", moments }, "authority");
    expect(game.state.people.bonds[bond]?.moments).toEqual(moments);
  });
});

describe("proposals", () => {
  test("[person:proposing-a-step] given a courting bond, when partners is proposed one moment short and then with enough, then the first is rejected and the second goes to the computer", () => {
    const easy = tuned(eager);
    const game = life({ content: easy });
    const bond = court(game, TOBI);
    for (let index = 0; index < numbers.partnerMoments - 1; index += 1) turn(game, [SEE]);
    game.expectRejected({ type: "people/propose", bond, step: "partner" }, "not-legal");
    turn(game, [SEE]);
    const result = game.accept({ type: "people/propose", bond, step: "partner" });
    expect(result.events.map((event) => event.type)).toEqual(expect.arrayContaining(["people/proposed", "people/agreed"]));
  });

  test("[person:proposing-a-step] [person:behaviour-block-fields] given a computer whose agreement draw always fails, when it is asked, then it says no and the same proposal waits the cooldown, legal again at its last month", () => {
    const cold = tuned((copy) => {
      copy.person[TOBI]!.behaviour.agreeBp = 0;
    });
    const game = life({ content: cold });
    const bond = toCourted(game);
    const asked = game.state.turn.month;
    const result = game.accept({ type: "people/propose", bond, step: "partner" });
    expect(result.lines.map((line) => line.key)).toContain("line.people.declined");
    expect(game.state.people.bonds[bond]).toMatchObject({ stage: "courting", cooldownUntil: asked + numbers.proposeCooldown, pending: { mine: null } });
    for (let month = 1; month < numbers.proposeCooldown; month += 1) turn(game, [SEE]);
    game.expectRejected({ type: "people/propose", bond, step: "partner" }, "not-legal");
    turn(game, [SEE]);
    game.accept({ type: "people/propose", bond, step: "partner" });
  });

  test.each([
    [0, "agreed"],
    [1, "declined"],
  ])("[person:behaviour-block-fields] given a computer that wants court months over the months since the first moment plus %i, when asked to be partners, then it is %s", (extra, outcome) => {
    // activity:now-acts-and-month-acts: seeing someone is an act done at once, so the first moment falls in the month it is
    // sent and the proposal comes partnerMoments months after it.
    const months = numbers.partnerMoments + extra;
    const game = life({
      content: tuned((copy) => {
        copy.person[TOBI]!.behaviour.agreeBp = 10000;
        copy.person[TOBI]!.behaviour.courtMonths = months;
      }),
    });
    const bond = toCourted(game);
    const result = game.accept({ type: "people/propose", bond, step: "partner" });
    expect(result.events.map((event) => event.type)).toContain(`people/${outcome}`);
  });

  test("[person:proposing-a-step] given a computer that draws at its agreeBp, when partners is asked, then it answers on the people stream at once and never leaves the proposal pending", () => {
    const outcomes = new Set<string>();
    for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const game = life({ seed, content: tuned((copy) => (copy.person[TOBI]!.behaviour.courtMonths = 0)) });
      const bond = toCourted(game);
      const draws = game.state.draws.people ?? 0;
      game.accept({ type: "people/propose", bond, step: "partner" });
      expect(game.state.draws.people).toBe(draws + 1);
      expect(game.state.people.bonds[bond]?.pending.mine).toBeNull();
      outcomes.add(game.state.people.bonds[bond]!.stage);
    }
    expect([...outcomes].sort()).toEqual(["courting", "partner"]);
  });

  test("[person:proposing-a-step] given a friend, when partners is proposed, then it waits as pending until the authority agrees, and can be withdrawn", () => {
    const game = life();
    const bond = linked(game);
    game.accept({ type: "people/court", with: "pair-1" });
    const moments = Array.from({ length: numbers.partnerMoments }, (_unused, index) => ({ n: index + 1, by: "them" as const, kind: "said" as const, spot: null, what: "phrase.hello", tick: 0 }));
    game.accept({ type: "people/moments", pair: "pair-1", moments }, "authority");
    game.accept({ type: "people/propose", bond, step: "partner" });
    expect(game.state.people.bonds[bond]?.pending.mine).toEqual({ step: "partner", route: null, lead: null });
    game.accept({ type: "people/withdraw", bond });
    expect(game.state.people.bonds[bond]?.pending.mine).toBeNull();
    game.expectRejected({ type: "people/withdraw", bond }, "not-legal");
    game.accept({ type: "people/propose", bond, step: "partner" });
    game.accept({ type: "people/agreed", pair: "pair-1", step: "partner" }, "authority");
    expect(game.state.people.bonds[bond]).toMatchObject({ stage: "partner", partnerMonth: game.state.turn.month, pending: { mine: null, theirs: null } });
    expect(game.state.people.slots.partner).toMatchObject({ state: "player", bond });
  });

  test("[person:proposing-a-step] given a friend's proposal, when it is answered, then only the step it names may be answered and the answer clears it", () => {
    const game = life();
    const bond = linked(game);
    game.expectRejected({ type: "people/answer", bond, step: "partner", yes: true }, "not-legal");
    game.accept({ type: "people/proposal", pair: "pair-1", proposal: { step: "partner", route: null, lead: null } }, "authority");
    expect(game.state.people.bonds[bond]?.pending.theirs).toEqual({ step: "partner", route: null, lead: null });
    game.expectRejected({ type: "people/answer", bond, step: "marry", yes: true }, "not-legal");
    game.accept({ type: "people/answer", bond, step: "partner", yes: true });
    expect(game.state.people.bonds[bond]?.pending.theirs).toBeNull();
  });

  test.each([
    [-1, "rejected"],
    [0, "accepted"],
  ])("[person:proposing-a-step] given partners for marryAfterMonths %i, when marriage is proposed, then it is %s", (offset, outcome) => {
    const game = life({ content: tuned(eager) });
    const bond = toPartner(game);
    for (let month = 0; month < numbers.marryAfterMonths + offset; month += 1) turn(game, [SEE]);
    const result = game.send({ type: "people/propose", bond, step: "marry" });
    expect(result.ok ? "accepted" : "rejected").toBe(outcome);
  });

  test("[person:proposing-a-step] given a wedding share above what is held, when marriage is proposed, then it is rejected", () => {
    const dear = tuned((copy) => {
      eager(copy);
      copy.tuning.people.weddingShare = 100000000000;
    });
    const game = life({ content: dear });
    const bond = toPartner(game);
    for (let month = 0; month < numbers.marryAfterMonths; month += 1) turn(game, [SEE]);
    game.expectRejected({ type: "people/propose", bond, step: "marry" }, "not-legal");
    expect(game.state.people.bonds[bond]?.stage).toBe("partner");
  });

  test("[person:agreed-partner-and-marriage] given partners long enough, when a computer agrees to marry, then the bond is married, the naira share goes under wedding, standing rises by 8 and a wedding moment is staged", () => {
    const game = life({ content: tuned(eager) });
    const bond = toPartner(game);
    for (let month = 0; month < numbers.marryAfterMonths; month += 1) turn(game, [SEE]);
    const naira = () => game.state.wallet.pockets.NGN.bank + game.state.wallet.pockets.NGN.cash;
    const before = naira();
    const result = game.accept({ type: "people/propose", bond, step: "marry" });
    expect(game.state.people.bonds[bond]).toMatchObject({ stage: "married", marriedMonth: game.state.turn.month });
    expect(before - naira()).toBe(numbers.weddingShare);
    expect(game.state.wallet.totals.out.wedding?.NGN).toBe(numbers.weddingShare);
    expect(qualityChange(result.events, "quality.standing", bond)).toBe(8);
    const wedding = game.state.people.bonds[bond]!.moments.at(-1)!;
    expect(wedding.kind).toBe("wedding");
    expect(WEDDING_SPOTS).toContain(wedding.spot);
    expect(result.lines.filter((line) => line.big === true).map((line) => line.key)).toEqual(["line.people.wedding"]);
  });

  test("[person:one-partner-at-a-time] given a partner, when another is courted and asked to be partners, then courting is allowed and the proposal is not", () => {
    const game = life({ content: tuned(eager) });
    toPartner(game, TOBI);
    const other = toCourted(game, AMAKA);
    expect(game.state.people.bonds[other]?.stage).toBe("courting");
    game.expectRejected({ type: "people/propose", bond: other, step: "partner" }, "not-legal");
  });

  test("[person:behaviour-block-fields] given a partner abroad who marries in December, when they agree outside December, then the wedding waits and is held in the month December comes", () => {
    const live = { december: 0 };
    const easy = tuned(eager);
    const game = life({
      content: easy,
      worldAt: (tick) => {
        const world = standInWorld("world-1", tick, easy);
        return { ...world, vars: { ...world.vars, "var.season-december": live.december } };
      },
    });
    const bond = court(game, KELECHI);
    for (let index = 0; index < numbers.partnerMoments; index += 1) turn(game, [CALL]);
    game.accept({ type: "people/propose", bond, step: "partner" });
    for (let month = 0; month < numbers.marryAfterMonths; month += 1) turn(game, [CALL]);
    const result = game.accept({ type: "people/propose", bond, step: "marry" });
    expect(result.lines.map((line) => line.key)).toContain("line.people.wedding-december");
    expect(game.state.people.bonds[bond]).toMatchObject({ stage: "partner", pending: { mine: { step: "marry" } } });
    turn(game, [CALL]);
    expect(game.state.people.bonds[bond]?.stage).toBe("partner");
    live.december = 1;
    const december = turn(game, [CALL]);
    expect(game.state.people.bonds[bond]?.stage).toBe("married");
    expect(december.lines.some((line) => line.key === "line.people.wedding" && line.big === true)).toBe(true);
  });
});

describe("the joint", () => {
  /** Content where the skilled route brings a partner and Kelechi's status allows one. */
  const JOINT = tuned((copy) => {
    eager(copy);
    copy.route["route.uk-skilled"]!.dependants = "route.uk-care";
    copy.status["status.uk-sponsored"]!.dependants = ["activity.job-uk-skilled"];
  });
  const SKILLED: Id<"route"> = "route.uk-skilled";

  function jointWithKelechi(game: Game): string {
    const bond = court(game, KELECHI);
    for (let index = 0; index < numbers.partnerMoments; index += 1) turn(game, [CALL]);
    game.accept({ type: "people/propose", bond, step: "partner" });
    game.accept({ type: "people/propose", bond, step: "joint", route: SKILLED, lead: "them" });
    return bond;
  }

  test("[person:joint-application-proposed] given a computer partner on a status that brings a partner, when a joint is proposed with them leading, then it is agreed and recorded with consent off", () => {
    const game = life({ content: JOINT });
    const bond = jointWithKelechi(game);
    expect(game.state.people.joint).toEqual({ bond, route: SKILLED, lead: "them", countFunds: false, standInMay: false });
    expect(game.view().people.joint).toEqual({ bond, route: SKILLED, lead: "them", myScore: null, theirScore: null });
  });

  test("[person:joint-application-proposed] given a route that brings no partner, a bond not yet partners, or a computer asked to lead a route it would apply for, when a joint is proposed, then each is rejected", () => {
    const game = life({ content: JOINT });
    const bond = court(game, KELECHI);
    game.expectRejected({ type: "people/propose", bond, step: "joint", route: SKILLED, lead: "them" }, "not-legal");
    for (let index = 0; index < numbers.partnerMoments; index += 1) turn(game, [CALL]);
    game.accept({ type: "people/propose", bond, step: "partner" });
    game.expectRejected({ type: "people/propose", bond, step: "joint", route: "route.uk-masters", lead: "them" }, "not-legal");
    game.expectRejected({ type: "people/propose", bond, step: "joint", route: "route.uk-care", lead: "them" }, "not-legal");
    game.expectRejected({ type: "people/propose", bond, step: "joint", route: SKILLED, lead: "me" }, "not-legal");
    game.expectRejected({ type: "people/propose", bond, step: "landed" }, "not-legal");
    expect(game.state.people.joint).toBeNull();
  });

  test("[person:money-counted-never-moved] [person:stand-in-acts-narrowly] given a joint, when consent is given, then the joint records it, and consent without a joint is rejected", () => {
    const game = life({ content: JOINT });
    const lone = court(game, TOBI);
    game.expectRejected({ type: "people/consent", bond: lone, countFunds: true }, "not-legal");
    const bond = jointWithKelechi(game);
    game.accept({ type: "people/consent", bond, countFunds: true });
    expect(game.state.people.joint).toMatchObject({ countFunds: true, standInMay: false });
    game.accept({ type: "people/consent", bond, standInMay: true });
    expect(game.state.people.joint).toMatchObject({ countFunds: true, standInMay: true });
  });

  test("[person:money-counted-never-moved] [person:facts-function-is-pure] given a joint, when this life's facts are built, then funds appear only once consent counts them, and no other wallet or pay figure is there", () => {
    const game = life({ content: JOINT });
    const bond = jointWithKelechi(game);
    const facts = () => factsOf(game.state, JOINT, game.world());
    expect(facts().funds).toBeNull();
    expect(facts().joint).toEqual({ route: "route.uk-care", state: game.state.route["route.uk-care"]?.state });
    game.accept({ type: "people/consent", bond, countFunds: true });
    expect(facts().funds).toMatchObject({ currency: "GBP" });
    expect(facts().funds!.amount).toBeGreaterThan(0);
    expect(Object.keys(facts()).sort()).toEqual(Object.keys(FACTS).sort());
  });

  test("[person:joint-collapses-with-bond] given a joint, when its bond ends, then the joint is gone", () => {
    const game = life({ content: JOINT });
    const bond = jointWithKelechi(game);
    game.accept({ type: "people/end", bond });
    expect(game.state.people.joint).toBeNull();
    expect(checkInvariants(game.state, JOINT)).toEqual([]);
  });

  test("[person:computer-is-a-person-entry] given a joint with this life as dependant, when the joint requirement is read, then it holds as dependant on the route and its partner route and not as lead", () => {
    const game = life({ content: JOINT });
    jointWithKelechi(game);
    const read = { state: game.state, world: game.world(), content: JOINT };
    const met = (as: "lead" | "dependant", route: Id<"route">) => check(read, { type: "people/joint", route, as }).met;
    expect(met("dependant", SKILLED)).toBe(true);
    expect(met("dependant", "route.uk-care")).toBe(true);
    expect(met("lead", SKILLED)).toBe(false);
  });
});

describe("letting people down", () => {
  test.each([
    ["courting", numbers.endStanding.courting],
    ["partner", numbers.endStanding.partner],
    ["married", numbers.endStanding.married],
  ] as const)("[person:either-side-ends-a-bond] [person:ender-pays-in-standing] given a bond at %s, when the character ends it, then standing falls by %i and wellbeing by the end's figure, and a second end is rejected", (stage, standing) => {
    const game = life({ content: tuned(eager) });
    let bond: string;
    if (stage === "courting") bond = court(game, TOBI);
    else {
      bond = toPartner(game);
      if (stage === "married") {
        for (let month = 0; month < numbers.marryAfterMonths; month += 1) turn(game, [SEE]);
        game.accept({ type: "people/propose", bond, step: "marry" });
      }
    }
    expect(game.state.people.bonds[bond]?.stage).toBe(stage);
    const result = game.accept({ type: "people/end", bond });
    expect(qualityChange(result.events, "quality.standing", bond)).toBe(standing);
    expect(qualityChange(result.events, "quality.wellbeing", bond)).toBe(numbers.endWellbeing);
    expect(game.state.people.bonds[bond]?.ended).toEqual({ month: game.state.turn.month, by: "me" });
    expect(game.state.people.slots.partner?.state).toBe("empty");
    game.expectRejected({ type: "people/end", bond }, "not-legal");
    game.expectRejected({ type: "people/end", bond: "bond-404" }, "unknown-id");
  });

  test("[person:one-left-keeps-own-gains] given a friend who ends it, when the authority says so, then this life loses wellbeing, no standing, keeps its money, and the recovery offer opens", () => {
    const game = life();
    const bond = linked(game);
    game.accept({ type: "people/court", with: "pair-1" });
    const wallet = game.state.wallet.pockets;
    const result = game.accept({ type: "people/ended", pair: "pair-1", why: "them" }, "authority");
    expect(qualityChange(result.events, "quality.wellbeing", bond)).toBe(numbers.leftWellbeing);
    expect(qualityChange(result.events, "quality.standing", bond)).toBe(0);
    expect(game.state.wallet.pockets).toEqual(wallet);
    expect(Object.values(game.state.offer.items).map((item) => item.entry)).toContain(RECOVERY);
    expect(game.state.people.bonds[bond]?.ended?.by).toBe("them");
    expect(result.lines.map((line) => line.key)).toContain("line.people.left");
  });

  test.each(["block", "absence"] as const)("[person:ender-pays-in-standing] given a %s end from the authority, when it arrives, then nobody pays standing or wellbeing", (why) => {
    const game = life();
    const bond = linked(game);
    game.accept({ type: "people/court", with: "pair-1" });
    const result = game.accept({ type: "people/ended", pair: "pair-1", why }, "authority");
    expect(qualityChange(result.events, "quality.standing", bond)).toBe(0);
    expect(qualityChange(result.events, "quality.wellbeing", bond)).toBe(0);
    expect(game.state.people.bonds[bond]?.ended?.by).toBe(why);
  });

  test("[person:leaving-player-ends-bonds] [person:computer-siblings-drawn-with-family] given a real sibling joined to this life, when their player starts a new life, then the bond ends as a restart at no cost, its line is told, and the slot is drawn again as a computer sibling at the next month's start", () => {
    const game = life();
    game.accept({ type: "people/invite", slot: "sibling-1", looking: "sibling", fill: "to-start-out-with-me" });
    game.accept({ type: "people/link", slot: "sibling-1", pair: "pair-1", facts: FACTS }, "authority");
    const bond = game.state.people.slots["sibling-1"]?.bond;
    if (bond === undefined || bond === null) throw new Error("The link made no sibling bond.");
    const result = game.accept({ type: "people/ended", pair: "pair-1", why: "restart" }, "authority");
    expect(qualityChange(result.events, "quality.standing", bond)).toBe(0);
    expect(qualityChange(result.events, "quality.wellbeing", bond)).toBe(0);
    expect(game.state.people.bonds[bond]?.ended?.by).toBe("restart");
    expect(result.lines.map((line) => line.key)).toContain("line.people.ended-restart");
    expect(game.state.people.slots["sibling-1"]).toMatchObject({ state: "computer", bond: null, person: null });
    turn(game);
    expect(game.state.people.slots["sibling-1"]?.state).toBe("computer");
    expect(game.state.people.slots["sibling-1"]?.person).not.toBeNull();
  });

  test("[person:ended-bond-record-kept] given an ended bond with Tobi, when the months pass, then the record stays, and Tobi is a candidate again only from the recourt month", () => {
    const game = life();
    const bond = court(game, TOBI);
    turn(game, [SEE]);
    game.accept({ type: "people/end", bond });
    const ended = game.state.turn.month;
    for (let month = 1; month < numbers.recourtMonths; month += 1) turn(game);
    expect(game.view().people.candidates.map((candidate) => candidate.person)).not.toContain(TOBI);
    game.expectRejected({ type: "people/court", with: TOBI }, "not-legal");
    turn(game);
    expect(game.state.turn.month).toBe(ended + numbers.recourtMonths);
    expect(game.view().people.candidates.map((candidate) => candidate.person)).toContain(TOBI);
    expect(game.state.people.bonds[bond]?.moments).toHaveLength(1);
    game.accept({ type: "people/court", with: TOBI });
  });

  test("[person:gossip-when-two-timing] given a computer partner and a bond courting beside it, when gossip and jealousy always hit, then standing falls by 3 for the gossip, the partner ends it, and the courter pays as if they had ended it", () => {
    const loud = tuned((copy) => {
      eager(copy);
      copy.tuning.people.gossipBp = 10000;
      copy.person[TOBI]!.behaviour.jealousBp = 10000;
    });
    const game = life({ content: loud });
    const partner = toPartner(game, TOBI);
    const courting = court(game, AMAKA);
    const result = turn(game, [SEE]);
    expect(qualityChange(result.events, "quality.standing", courting)).toBe(-3);
    expect(game.state.people.bonds[partner]?.ended?.by).toBe("them");
    expect(qualityChange(result.events, "quality.standing", partner)).toBe(numbers.endStanding.partner);
    expect(qualityChange(result.events, "quality.wellbeing", partner)).toBe(numbers.endWellbeing);
  });

  test("[person:gossip-when-two-timing] given gossip at 0, when a month passes beside a partner, then nothing is heard and no draw is lost to it", () => {
    const quiet = tuned((copy) => {
      eager(copy);
      copy.tuning.people.gossipBp = 0;
    });
    const game = life({ content: quiet });
    const partner = toPartner(game, TOBI);
    const courting = court(game, AMAKA);
    const result = turn(game, [SEE]);
    expect(qualityChange(result.events, "quality.standing", courting)).toBe(0);
    expect(game.state.people.bonds[partner]?.stage).toBe("partner");
  });

  test("[person:gossip-when-two-timing] given a friend as partner and gossip that always hits, when a month passes with a computer courted, then the gossip is spread for the authority to carry, and a friend's gossip arriving is heard without a name", () => {
    const loud = tuned((copy) => {
      copy.tuning.people.gossipBp = 10000;
    });
    const game = life({ content: loud });
    const bond = linked(game);
    game.accept({ type: "people/court", with: "pair-1" });
    const moments = Array.from({ length: numbers.partnerMoments }, (_unused, index) => ({ n: index + 1, by: "them" as const, kind: "said" as const, spot: null, what: "phrase.hello", tick: 0 }));
    game.accept({ type: "people/moments", pair: "pair-1", moments }, "authority");
    game.accept({ type: "people/agreed", pair: "pair-1", step: "partner" }, "authority");
    court(game, TOBI);
    const result = turn(game, [SEE]);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "people/gossip-spread", bond }));
    const heard = game.accept({ type: "people/gossip", pair: "pair-1" }, "authority");
    expect(heard.lines.map((line) => line.key)).toEqual(["line.people.gossip"]);
    expect(Object.keys(heard.lines[0]!.params)).toEqual([]);
  });

  /** Courts Tobi and lets `months` pass with no moment, returning the last turn. */
  function waited(months: number) {
    const game = life();
    const bond = court(game, TOBI);
    let last = turn(game);
    for (let month = 1; month < months; month += 1) last = turn(game);
    return { game, bond, last };
  }

  test("[person:computer-partner-drifts] given Tobi's patience, when one month fewer passes with no moment, then the bond is still courting", () => {
    const { game, bond } = waited(content.person[TOBI]!.behaviour.patienceMonths! - 1);
    expect(game.state.people.bonds[bond]?.stage).toBe("courting");
  });

  test("[person:computer-partner-drifts] given Tobi's patience, when that many months pass with no moment, then Tobi drifts away and the character is the one left", () => {
    const { game, bond, last } = waited(content.person[TOBI]!.behaviour.patienceMonths!);
    expect(game.state.people.bonds[bond]?.ended?.by).toBe("drift");
    expect(qualityChange(last.events, "quality.wellbeing", bond)).toBe(numbers.leftWellbeing);
    expect(qualityChange(last.events, "quality.standing", bond)).toBe(0);
    expect(Object.values(game.state.offer.items).map((item) => item.entry)).toContain(RECOVERY);
  });
});

describe("what an end undoes", () => {
  test("[person:tied-status-clock-on-breakup] given a status tied to a partner held abroad, when the partner bond ends, then the status's clock starts at its clock months", () => {
    const tied = tuned((copy) => {
      eager(copy);
      copy.tuning.people.partnerMoments = 1;
      copy.status["status.uk-talent"]!.tiedTo = "partner";
      copy.status["status.uk-talent"]!.clockMonths = 2;
    });
    const game = life({ content: tied });
    applyEffects(game, [
      { type: "place/move", to: "abroad", country: "country.uk" },
      { type: "status/grant", status: "status.uk-talent" },
    ]);
    const bond = court(game, KELECHI);
    turn(game, [SEE]);
    game.accept({ type: "people/propose", bond, step: "partner" });
    expect(game.state.status.current).toMatchObject({ entry: "status.uk-talent", clock: null });
    game.accept({ type: "people/end", bond });
    expect(game.state.status.current?.clock).toBe(2);
  });

  /** Tunde with Kelechi, who leads a joint on the skilled route from her sponsored job in the UK, and his dependant application in. */
  function dependantApplying(kinds?: StartOptions["kinds"]): { game: Game; bond: string } {
    const game = life({ content: tuned(eager), ...(kinds === undefined ? {} : { kinds }) });
    const bond = court(game, KELECHI);
    for (let index = 0; index < numbers.partnerMoments; index += 1) turn(game, [CALL]);
    game.accept({ type: "people/propose", bond, step: "partner" });
    game.accept({ type: "people/propose", bond, step: "joint", route: "route.uk-skilled", lead: "them" });
    // Tunde holds none of the papers the dependant route asks for, so the test puts his application in place.
    const held = game.state.route[UK_DEPENDANT]!;
    const month = game.state.turn.month;
    const visa = { submittedMonth: month, decisionMonth: month + 1, rules: { livingLine: 0, livingMonths: 0, strictness: 0 }, unexplainedBp: 0, interviewScore: null, surchargePaid: 0 };
    game.state = { ...game.state, route: { ...game.state.route, [UK_DEPENDANT]: { ...held, state: "applying", visa } } };
    return { game, bond };
  }

  test("[person:joint-collapses-with-bond] given an application on the dependant gate resting on the joint, when the bond ends, then the route kind is told to withdraw it", () => {
    const withdrawn: string[] = [];
    const kinds = registry().map((kind) =>
      kind.kind !== "route" ? kind : { ...kind, effects: { ...kind.effects, "route/withdraw": (_ctx: unknown, effect: Effect) => (withdrawn.push(effect.type === "route/withdraw" ? effect.route : ""), []) } },
    );
    const { game, bond } = dependantApplying(kinds);
    game.accept({ type: "people/end", bond });
    expect(withdrawn).toEqual([UK_DEPENDANT]);
  });

  test("[person:joint-collapses-with-bond] [person:ender-pays-in-standing] given a dependant application in, when the character ends the bond, then they pay the stage's standing and the applying figure more, and the application is withdrawn to known", () => {
    const { game, bond } = dependantApplying();
    const result = game.accept({ type: "people/end", bond });
    expect(qualityChange(result.events, "quality.standing", bond)).toBe(numbers.endStanding.partner + numbers.endStanding.applying);
    expect(game.state.route[UK_DEPENDANT]).toMatchObject({ state: "known", visa: null });
    expect(game.state.people.joint).toBeNull();
  });
});

describe("the stand-in", () => {
  test("[person:stand-in-after-absence] given a friend as partner, when the authority warns, turns the stand-in on and clears it, then the bond and the slot show each stage", () => {
    const game = life();
    const bond = linked(game);
    game.accept({ type: "people/court", with: "pair-1" });
    const moments = Array.from({ length: numbers.partnerMoments }, (_unused, index) => ({ n: index + 1, by: "them" as const, kind: "said" as const, spot: null, what: "phrase.hello", tick: 0 }));
    game.accept({ type: "people/moments", pair: "pair-1", moments }, "authority");
    game.accept({ type: "people/agreed", pair: "pair-1", step: "partner" }, "authority");
    game.accept({ type: "people/stand-in", pair: "pair-1", stage: "warned" }, "authority");
    expect(game.view().people.bonds.find((view) => view.id === bond)).toMatchObject({ standIn: "warned", label: "player" });
    game.accept({ type: "people/stand-in", pair: "pair-1", stage: "on" }, "authority");
    expect(game.view().people.slots.partner).toMatchObject({ state: "stand-in", label: "stand-in" });
    expect(game.view().people.bonds.find((view) => view.id === bond)?.label).toBe("stand-in");
    game.accept({ type: "people/stand-in", pair: "pair-1", stage: null }, "authority");
    expect(game.view().people.slots.partner).toMatchObject({ state: "player", label: "player" });
  });

  test("[person:stand-in-acts-narrowly] given the stand-in on, when the waiting player ends the bond, then it is an absence end that costs nobody", () => {
    const game = life();
    const bond = linked(game);
    game.accept({ type: "people/court", with: "pair-1" });
    game.accept({ type: "people/stand-in", pair: "pair-1", stage: "on" }, "authority");
    const result = game.accept({ type: "people/end", bond });
    expect(game.state.people.bonds[bond]?.ended?.by).toBe("absence");
    expect(qualityChange(result.events, "quality.standing", bond)).toBe(0);
    expect(qualityChange(result.events, "quality.wellbeing", bond)).toBe(0);
  });

  test("[person:stand-in-acts-narrowly] given commands sent as the stand-in, when it proposes, consents, sends a card, ends the bond, ends a turn or spends, then each is refused by the engine as not the stand-in's and the player's own end goes through", () => {
    const game = life();
    const bond = linked(game);
    game.accept({ type: "people/court", with: "pair-1" });
    game.accept({ type: "people/stand-in", pair: "pair-1", stage: "on" }, "authority");
    const refused: Loose[] = [
      { type: "people/propose", bond, step: "partner" },
      { type: "people/consent", bond, countFunds: true },
      { type: "people/invite", slot: "sibling-1", looking: "sibling" },
      { type: "people/end", bond },
      { type: "turn/end", slots: [] },
      // Each would be unknown-id from a player: the stand-in is refused before anything is looked up.
      { type: "offer/choose", offer: "none", choice: "none" },
      { type: "obligation/pay", obligation: "none", amount: 1 },
      { type: "route/depart", route: "route.none" },
    ];
    // The engine refuses them before any kind looks (the stand-in allow-list in step, person:stand-in-acts-narrowly), as not the stand-in's to send.
    for (const command of refused) game.expectRejected(command, "not-yours", "stand-in");
    game.accept({ type: "people/end", bond });
    expect(game.state.people.bonds[bond]?.ended?.by).toBe("absence");
  });

  test("[person:stand-in-acts-narrowly] given a partner proposal waiting, when the stand-in answers it, then it is rejected, and the player may answer it", () => {
    const game = life();
    linked(game);
    game.accept({ type: "people/court", with: "pair-1" });
    const bond = Object.keys(game.state.people.bonds).find((id) => game.state.people.bonds[id]?.with.kind === "player")!;
    game.accept({ type: "people/proposal", pair: "pair-1", proposal: { step: "partner", route: null, lead: null } }, "authority");
    game.expectRejected({ type: "people/answer", bond, step: "partner", yes: true }, "not-legal", "stand-in");
    game.accept({ type: "people/answer", bond, step: "partner", yes: true });
    expect(game.state.people.bonds[bond]?.pending.theirs).toBeNull();
  });

  test("[person:computers-need-no-stand-in] given computer bonds, when the months pass, then none ever has a stand-in, and the stand-in names only a pair", () => {
    const game = life();
    court(game, TOBI);
    for (let month = 0; month < 3; month += 1) turn(game, [SEE]);
    expect(Object.values(game.state.people.bonds).every((bond) => bond.standIn === null)).toBe(true);
    game.expectRejected({ type: "people/stand-in", pair: TOBI, stage: "on" }, "unknown-id", "authority");
  });
});

describe("facts", () => {
  test("[person:others-known-by-facts] given a friend's bond, when the authority sends fresh facts, then they are kept on the bond and a player cannot send them", () => {
    const game = life();
    const bond = linked(game);
    const fresh: PersonFacts = { ...FACTS, where: "abroad", country: "country.uk", status: "status.uk-sponsored" };
    game.expectRejected({ type: "people/facts", pair: "pair-1", facts: fresh }, "not-yours");
    game.accept({ type: "people/facts", pair: "pair-1", facts: fresh }, "authority");
    expect(game.state.people.bonds[bond]?.facts).toEqual(fresh);
  });

  test("[person:lives-meet-by-authority-command] given a life with a bond, when the authority's people commands arrive, then none spends a turn", () => {
    const game = life();
    linked(game);
    const banked = game.state.turn.banked;
    game.accept({ type: "people/facts", pair: "pair-1", facts: FACTS }, "authority");
    game.accept({ type: "people/stand-in", pair: "pair-1", stage: "warned" }, "authority");
    game.accept({ type: "people/gossip", pair: "pair-1" }, "authority");
    expect(game.state.turn.banked).toBe(banked);
  });

  test.prop([fc.string({ minLength: 1, maxLength: 8 }), fc.integer({ min: 0, max: 6 })], { numRuns: 10 })(
    "[person:facts-function-is-pure] given a life some months in, when every secret in the state is cleared, then its facts are unchanged",
    (seed, months) => {
      const game = life({ seed });
      court(game, TOBI);
      for (let month = 0; month < months; month += 1) turn(game, [SEE]);
      const world = game.world();
      const cleared: State = copyOf(game.state);
      cleared.seed = "";
      cleared.draws = {};
      cleared.people.secret = { computerAnswers: null };
      cleared.interview.secret = { truths: null };
      for (const route of Object.values(cleared.route)) route.secret = { sponsorFraud: null };
      for (const item of Object.values(cleared.offer.items)) item.secret = { fraud: false };
      expect(factsOf(cleared, content, world)).toEqual(factsOf(game.state, content, world));
      expect(factsOf(game.state, content, world).funds).toBeNull();
    },
  );

  test("[person:computer-is-a-person-entry] [person:computer-partner-facts] given Tobi courted, when the months pass, then the facts come from the entry, age moves a month a turn, and no wallet or pay figure appears", () => {
    const game = life();
    const bond = court(game, TOBI);
    const start = game.state.people.bonds[bond]!.facts!;
    const entry = content.person[TOBI]!;
    expect(start).toMatchObject({ label: "computer", where: "home", country: null, job: entry.profile.job, eduLevel: entry.profile.eduLevel, home: entry.profile.home, funds: null, assistanceTaken: 0 });
    turn(game, [SEE]);
    turn(game, [SEE]);
    expect(game.state.people.bonds[bond]!.facts!.ageMonths).toBe(start.ageMonths + 2);
    expect(game.state.people.bonds[bond]!.facts!.meetsFloor).toEqual(start.meetsFloor);
  });
});

describe("requirements", () => {
  test("[person:computer-is-a-person-entry] given a bond with a partner abroad, when people/bond is read by stage and country, then it holds only for what the facts show", () => {
    const game = life();
    court(game, KELECHI);
    const read = { state: game.state, world: game.world(), content };
    expect(check(read, { type: "people/bond", role: "partner", stages: ["courting"], country: "country.uk" }).met).toBe(true);
    expect(check(read, { type: "people/bond", role: "partner", stages: ["courting"], where: "home" }).met).toBe(false);
    expect(check(read, { type: "people/bond", role: "partner", stages: ["partner"] }).met).toBe(false);
    expect(check(read, { type: "people/bond", role: "partner", stages: ["courting"], statuses: ["status.uk-sponsored"] }).met).toBe(true);
  });

  test.each([
    [0, true],
    [1, false],
  ])("[person:computer-is-a-person-entry] given a sibling resident in Canada, when the sibling requirement asks for an age %i month over theirs, then it holds: %s", (over, met) => {
    const only = tuned((copy) => {
      for (const entry of Object.values(copy.person)) if (entry.role === "sibling") entry.weight = entry.id === "person.sib-ca" ? 1 : 0;
    });
    const game = life({ content: only });
    turn(game);
    const age = Math.max(...Object.values(game.state.people.bonds).map((bond) => bond.facts?.ageMonths ?? 0));
    const read = { state: game.state, world: game.world(), content: only };
    expect(check(read, { type: "people/sibling-abroad", country: "country.canada", statuses: ["status.ca-resident", "status.ca-citizen"], minAgeMonths: age + over }).met).toBe(met);
    expect(check(read, { type: "people/sibling-abroad", country: "country.uk", statuses: ["status.ca-resident"], minAgeMonths: 0 }).met).toBe(false);
  });
});

describe("computer characters from offers", () => {
  function papersGame(fraudBp: number): Game {
    const offered = tuned((copy) => {
      copy.offer[PAPERS_OFFER]!.fraudBp = fraudBp;
      // Enough cash for the largest fee the offer can ask.
      copy.scenario[BANKER]!.pockets.NGN = { bank: 0, cash: 1500000000 };
    });
    const game = life({ content: offered });
    applyEffects(game, [{ type: "offer/open", offer: PAPERS_OFFER }]);
    return game;
  }

  test("[person:papers-marriage-offer] given the papers offer honest, when it is taken, then the fee leaves cash and a bond opens at married with no moments, the papers partner, and the partner slot filled", () => {
    const game = papersGame(0);
    const item = Object.values(game.state.offer.items).find((offer) => offer.entry === PAPERS_OFFER)!;
    const fee = Number(item.terms.fee);
    const cash = game.state.wallet.pockets.NGN.cash;
    game.accept({ type: "offer/choose", offer: item.id, choice: "take" });
    expect(cash - game.state.wallet.pockets.NGN.cash).toBe(fee);
    const bond = bondWith(game, PAPERS);
    expect(game.state.people.bonds[bond]).toMatchObject({ stage: "married", moments: [] });
    expect(game.state.people.slots.partner).toMatchObject({ state: "computer", person: PAPERS });
    const route = Object.values(content.route).find((entry) => entry.gate === "partner" && entry.country === "country.uk");
    expect(game.state.people.joint).toEqual(route === undefined ? null : { bond, route: route.id, lead: "them", countFunds: false, standInMay: false });
  });

  test("[person:papers-marriage-offer] given the papers offer a fraud, when it is taken, then the fee is gone and nothing else happens", () => {
    const game = papersGame(10000);
    const item = Object.values(game.state.offer.items).find((offer) => offer.entry === PAPERS_OFFER)!;
    const fee = Number(item.terms.fee);
    const before = game.state.people;
    game.accept({ type: "offer/choose", offer: item.id, choice: "take" });
    expect(game.state.people).toEqual(before);
    expect(game.state.wallet.totals.out["fee-agent"]?.NGN).toBe(fee);
  });

  test("[person:family-requests-shared] given a family request from a sibling's life, when the authority shares it, then the same offer opens here with the same terms, and only family requests may be shared", () => {
    const game = life();
    const result = game.accept({ type: "people/family-request", offer: "offer.nepa-bill", terms: { amount: 1234500 } }, "authority");
    const item = Object.values(game.state.offer.items).find((offer) => offer.entry === "offer.nepa-bill");
    expect(item?.terms.amount).toBe(1234500);
    expect(result.lines.map((line) => line.key)).toContain("line.people.request-shared");
    expect(game.state.offer.lastOpened["offer.nepa-bill"]).toBe(game.state.turn.month);
    game.expectRejected({ type: "people/family-request", offer: PAPERS_OFFER, terms: {} }, "not-legal", "authority");
    game.expectRejected({ type: "people/family-request", offer: "offer.nothing", terms: {} }, "unknown-id", "authority");
  });
});

describe("the view", () => {
  test("[person:view-shows-people] given bonds of every kind, when the view is read, then it has no hidden key, facts carry no funds off the joint, and moments are hidden while an interview is open", () => {
    const game = life();
    const friend = linked(game, { ...FACTS, funds: { currency: "GBP", amount: 500000 } });
    court(game, TOBI);
    turn(game, [SEE]);
    const view = game.view().people;
    expect(hiddenPaths(view)).toEqual([]);
    expect(view.bonds.find((bond) => bond.id === friend)?.facts?.funds).toBeNull();
    expect(view.bonds.every((bond) => bond.moments !== null)).toBe(true);
    game.state = { ...game.state, interview: { ...game.state.interview, open: { pair: "pair-1", route: "route.uk-skilled", questions: [], answers: [], standIn: false, thin: false } } };
    expect(game.view().people.bonds.every((bond) => bond.moments === null)).toBe(true);
  });

  test("[person:view-shows-people] given every word the people kind uses, when looked up, then each person has a name and blurb and each spot, what and call has words", () => {
    const keys = Object.values(content.person).flatMap((entry) => [
      `${entry.id}.name`,
      `${entry.id}.blurb`,
      ...entry.spots.map((spot) => `people.spot.${spot}`),
      ...entry.whats.map((what) => `people.what.${what}`),
      ...entry.calls.map((call) => `people.call.${call}`),
      `people.plan.${entry.behaviour.plan}`,
    ]);
    keys.push(...WEDDING_SPOTS.map((spot) => `people.wedding-spot.${spot}`), ...content.people.spots.map((spot) => `people.spot.${spot}`));
    expect(keys.filter((key) => (text[key] ?? "").trim() === "")).toEqual([]);
  });
});

describe("answers across lives", () => {
  /** A friend courted in the partner slot with the moments to be asked, returning the bond. */
  function courtedFriend(game: Game): string {
    const bond = linked(game);
    game.accept({ type: "people/court", with: "pair-1" });
    const moments = Array.from({ length: numbers.partnerMoments }, (_unused, index) => ({ n: index + 1, by: "them" as const, kind: "said" as const, spot: null, what: "phrase.hello", tick: 0 }));
    game.accept({ type: "people/moments", pair: "pair-1", moments }, "authority");
    return bond;
  }

  test("[person:proposing-a-step] given partners asked of a friend, when the authority says they declined, then the proposal clears with a line and the same step waits the cooldown, legal again at its last month", () => {
    const game = life();
    const bond = courtedFriend(game);
    game.accept({ type: "people/propose", bond, step: "partner" });
    const asked = game.state.turn.month;
    game.expectRejected({ type: "people/declined", pair: "pair-1", step: "partner" }, "not-yours");
    game.expectRejected({ type: "people/declined", pair: "pair-1", step: "marry" }, "not-legal", "authority");
    const result = game.accept({ type: "people/declined", pair: "pair-1", step: "partner" }, "authority");
    expect(result.lines.map((line) => line.key)).toContain("line.people.declined");
    expect(game.state.people.bonds[bond]).toMatchObject({ stage: "courting", pending: { mine: null }, cooldownUntil: asked + numbers.proposeCooldown });
    expect(game.view().people.bonds.find((view) => view.id === bond)?.cooldownUntil).toBe(asked + numbers.proposeCooldown);
    game.expectRejected({ type: "people/declined", pair: "pair-1", step: "partner" }, "not-legal", "authority");
    for (let month = 1; month < numbers.proposeCooldown; month += 1) turn(game);
    game.expectRejected({ type: "people/propose", bond, step: "partner" }, "not-legal");
    turn(game);
    game.accept({ type: "people/propose", bond, step: "partner" });
  });

  test("[person:proposing-a-step] given a friend's proposal waiting, when the authority says they took it back, then it clears here with a line, and only the step that waits can be taken back", () => {
    const game = life();
    const bond = courtedFriend(game);
    game.accept({ type: "people/proposal", pair: "pair-1", proposal: { step: "partner", route: null, lead: null } }, "authority");
    game.expectRejected({ type: "people/withdrawn", pair: "pair-1", step: "partner" }, "not-yours");
    game.expectRejected({ type: "people/withdrawn", pair: "pair-1", step: "joint" }, "not-legal", "authority");
    const result = game.accept({ type: "people/withdrawn", pair: "pair-1", step: "partner" }, "authority");
    expect(result.lines.map((line) => line.key)).toContain("line.people.proposal-withdrawn");
    expect(game.state.people.bonds[bond]?.pending).toEqual({ mine: null, theirs: null });
    expect(game.state.people.bonds[bond]?.cooldownUntil).toBeNull();
    game.expectRejected({ type: "people/answer", bond, step: "partner", yes: true }, "not-legal");
    game.expectRejected({ type: "people/withdrawn", pair: "pair-2", step: "partner" }, "unknown-id", "authority");
  });

  test("[person:proposing-a-step] given a courting bond with the moments for it, when the legal commands are read, then partners is offered and accepted, and it is not offered again until the cooldown after a no has passed", () => {
    const cold = tuned((copy) => {
      copy.person[TOBI]!.behaviour.agreeBp = 0;
    });
    const game = life({ content: cold });
    const bond = court(game, TOBI);
    const asks = () => legalCommands(game.view()).filter((command) => command.type === "people/propose");
    for (let index = 0; index < numbers.partnerMoments - 1; index += 1) turn(game, [SEE]);
    expect(asks()).toEqual([]);
    turn(game, [SEE]);
    expect(asks()).toEqual([{ type: "people/propose", bond, step: "partner" }]);
    game.accept(asks()[0]!);
    expect(asks()).toEqual([]);
    for (let month = 0; month < numbers.proposeCooldown; month += 1) turn(game, [SEE]);
    expect(asks()).toEqual([{ type: "people/propose", bond, step: "partner" }]);
  });
});

describe("consent before the joint", () => {
  /** A friend at partner in the partner slot, returning the bond. */
  function friendPartner(game: Game): string {
    const bond = linked(game);
    game.accept({ type: "people/court", with: "pair-1" });
    game.accept({ type: "people/agreed", pair: "pair-1", step: "partner" }, "authority");
    return bond;
  }
  const JOINT_ASKED = { step: "joint" as const, route: "route.uk-skilled" as Id<"route">, lead: "them" as const };

  test("[person:stand-in-acts-narrowly] [person:money-counted-never-moved] given a joint the friend asked for and not yet agreed, when consent is given, then it is kept on the bond, the stand-in may say yes, and the joint takes it once agreed", () => {
    const game = life();
    const bond = friendPartner(game);
    game.expectRejected({ type: "people/consent", bond, standInMay: true }, "not-legal");
    game.accept({ type: "people/proposal", pair: "pair-1", proposal: JOINT_ASKED }, "authority");
    game.accept({ type: "people/consent", bond, standInMay: true });
    expect(game.state.people.bonds[bond]?.consent).toEqual({ countFunds: false, standInMay: true });
    expect(game.view().people.bonds.find((view) => view.id === bond)?.consent).toEqual({ countFunds: false, standInMay: true });
    expect(game.state.people.joint).toBeNull();
    game.accept({ type: "people/answer", bond, step: "joint", yes: true }, "stand-in");
    game.accept({ type: "people/agreed", pair: "pair-1", step: "joint", route: JOINT_ASKED.route, lead: "them" }, "authority");
    expect(game.state.people.joint).toMatchObject({ bond, countFunds: false, standInMay: true });
    game.accept({ type: "people/consent", bond, countFunds: true });
    expect(game.state.people.joint).toMatchObject({ countFunds: true, standInMay: true });
    expect(game.state.people.bonds[bond]?.consent).toEqual({ countFunds: true, standInMay: true });
  });

  test("[person:stand-in-acts-narrowly] given a joint asked for without standInMay, when the stand-in answers yes, then it is rejected, and a joint asked by this life also takes consent", () => {
    const game = life();
    const bond = friendPartner(game);
    game.accept({ type: "people/proposal", pair: "pair-1", proposal: JOINT_ASKED }, "authority");
    game.accept({ type: "people/consent", bond, countFunds: true });
    game.expectRejected({ type: "people/answer", bond, step: "joint", yes: true }, "not-legal", "stand-in");
    expect(game.state.people.bonds[bond]?.consent).toEqual({ countFunds: true, standInMay: false });
    game.accept({ type: "people/answer", bond, step: "joint", yes: false });
    game.expectRejected({ type: "people/consent", bond, standInMay: true }, "not-legal");
    expect(game.state.people.joint).toBeNull();
  });
});

describe("shared requests handled elsewhere", () => {
  test("[person:family-requests-shared] given a shared family request open here, when the authority says a sibling paid it, then this life gets standing +1 and the handled line, and nothing is paid from here", () => {
    const game = life();
    game.accept({ type: "people/family-request", offer: "offer.nepa-bill", terms: { amount: 1234500 } }, "authority");
    const wallet = game.state.wallet;
    const handled = { type: "people/family-request", offer: "offer.nepa-bill", terms: { amount: 1234500 }, handled: true } as Loose;
    const result = game.accept(handled, "authority");
    expect(result.lines.map((line) => line.key)).toContain("line.people.handled");
    expect(qualityChange(result.events, "quality.standing", "offer.nepa-bill")).toBe(1);
    expect(game.state.wallet).toEqual(wallet);
    game.expectRejected(handled, "not-yours");
  });

  test("[person:family-requests-shared] given no copy of the request open here, when the authority says a sibling paid it, then it is rejected", () => {
    const game = life();
    const standing = game.state.quality["quality.standing"];
    game.expectRejected({ type: "people/family-request", offer: "offer.nepa-bill", terms: {}, handled: true }, "not-legal", "authority");
    expect(game.state.quality["quality.standing"]).toBe(standing);
  });
});

describe("the view's bond fields", () => {
  test("[person:view-shows-people] given a computer bond and a friend's bond, when the view is read, then each names who it is with, the month of its last moment kept at every moment, its cooldown and its consent", () => {
    const game = life();
    const friend = linked(game);
    const tobi = court(game, TOBI);
    const viewOf = (id: string) => game.view().people.bonds.find((view) => view.id === id)!;
    expect(viewOf(tobi)).toMatchObject({ person: TOBI, pair: null, cooldownUntil: null, consent: null, lastMomentMonth: game.state.turn.month });
    expect(viewOf(friend)).toMatchObject({ person: null, pair: "pair-1", lastMomentMonth: null, consent: null });
    // activity:now-acts-and-month-acts: seeing someone is an act done at once, so the moment is kept at the month it is sent in.
    const seen = game.state.turn.month;
    turn(game, [SEE]);
    expect(viewOf(tobi).lastMomentMonth).toBe(seen);
    const again = game.state.turn.month;
    turn(game, [SEE]);
    expect(viewOf(tobi).lastMomentMonth).toBe(again);
    game.accept({ type: "people/moments", pair: "pair-1", moments: [{ n: 1, by: "them", kind: "said", spot: null, what: "phrase.hello", tick: 0 }] }, "authority");
    expect(viewOf(friend).lastMomentMonth).toBe(game.state.turn.month);
    game.accept({ type: "people/end", bond: tobi });
    expect(viewOf(tobi).cooldownUntil).toBe(game.state.turn.month + numbers.recourtMonths);
  });
});

describe("names a player sent", () => {
  test("[person:invite-fills-a-slot] [person:proposing-a-step] [person:money-counted-never-moved] [person:either-side-ends-a-bond] given a slot or bond name that is a built-in object key, when a card, a proposal, an answer, a withdrawal, a consent or an end names it, then each is rejected with unknown-id and nothing throws", () => {
    const game = life();
    for (const name of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      game.expectRejected({ type: "people/invite", slot: name, looking: "partner" }, "unknown-id");
      game.expectRejected({ type: "people/propose", bond: name, step: "partner" }, "unknown-id");
      game.expectRejected({ type: "people/answer", bond: name, step: "partner", yes: true }, "unknown-id");
      game.expectRejected({ type: "people/withdraw", bond: name }, "unknown-id");
      game.expectRejected({ type: "people/consent", bond: name, countFunds: true }, "unknown-id");
      game.expectRejected({ type: "people/end", bond: name }, "unknown-id");
    }
    expect(game.state.people.bonds).toEqual({});
  });
});
