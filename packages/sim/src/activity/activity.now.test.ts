// Acts that answer in the place: docs/rules/activity.md R-ACTIVITY-015. A now-act runs at once by
// `activity/now`, with a slot's checks, cost, effects and lines, and fills no slot; a month-act stays
// a slot pick. Played on the real content.
import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Accepted, ActivityEntry, BaseEvent, Id, ReportLine } from "../engine/types";
import { applyEffects, slot } from "../testing/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import type { ActivityEvent } from "./activity.events";

const LOTTO: Id<"activity"> = "activity.play-lotto";
const BET: Id<"activity"> = "activity.bet-slip";
const PHONE: Id<"activity"> = "activity.buy-phone";
const ASK_AROUND: Id<"activity"> = "activity.ask-around";
const PASSPORT: Id<"activity"> = "activity.get-passport";
const HUNT: Id<"activity"> = "activity.job-hunt";
const MEETUP: Id<"activity"> = "activity.meetup";
const LEARN: Id<"activity"> = "activity.learn-tech";
const GULF: Id<"route"> = "route.gulf-contract";
const PITCH: Id<"offer"> = "offer.road-park";

/** The rule's two lists. Every entry not named a now-act is a month-act. */
const NOW_ACTS: readonly string[] = [
  // the room and the family, the study that answers at once (R-ACTIVITY-019)
  "activity.family-time",
  "activity.study-english",
  LEARN,
  "activity.build-portfolio",
  "activity.cook-jollof",
  "activity.nap",
  "activity.bucket-bath",
  "activity.watch-tv",
  "activity.help-shop",
  // the kiosk and the bet slip
  LOTTO,
  BET,
  // asking around, the official page, the adviser, the meetup, seeing or calling someone, the family meeting
  ASK_AROUND,
  "activity.look-into-route",
  "activity.see-adviser",
  MEETUP,
  "activity.see-someone",
  "activity.call-someone",
  "activity.family-meeting",
  // buying a phone and the shopping abroad, the cash gig, posting from the phone, the safe ride
  PHONE,
  "activity.street-shopping-uk",
  "activity.street-shopping-uae",
  "activity.side-gig",
  "activity.tech-posts",
  "activity.safe-ride",
  // every paper's request
  PASSPORT,
  "activity.get-transcript",
  "activity.sit-english-test",
  "activity.tb-test",
  "activity.get-police-certificate",
  "activity.gulf-medical",
  "activity.get-eca",
  "activity.request-verification",
  "activity.apply-endorsement",
  "activity.renew-licence",
  "activity.nmc-tests",
  // every application, and the job hunt
  "activity.apply-to-school",
  "activity.apply-for-visa",
  "activity.apply-uk-care",
  "activity.apply-uk-talent",
  "activity.apply-uk-skilled",
  "activity.apply-gulf-contract",
  "activity.enter-pool",
  "activity.find-sponsor",
  HUNT,
  // Cooking and the water answer now (R-OBLIGATION-014).
  "activity.cook-at-home",
  "activity.fetch-water",
  "activity.fill-drum",
  // The street's enjoyment and spending (streets.md R-STREET-011, decision 0012).
  "activity.buy-suya",
  "activity.mallam-tea",
  "activity.pure-water",
  "activity.barber",
  "activity.viewing-centre",
  "activity.beer-joint",
  "activity.night-out",
  "activity.buy-clothes",
];

const MONTH_ACTS: readonly string[] = [
  "activity.rest",
  "activity.apprentice-repair",
  "activity.open-source",
  "activity.conference-talk",
  "activity.masters-at-home",
  "activity.nurse-certification",
  "activity.interview-prep",
  "activity.be-noticed",
  "activity.morning-run",
  "activity.sleep-at-office",
  "activity.sleep-rough",
];

function ada(): Game {
  return start({ content, scenario: "scenario.ada" });
}

function now(game: Game, activity: Id<"activity">, param: string | null = null): Accepted {
  return game.accept({ type: "activity/now", activity, param });
}

function eventsOf<T extends ActivityEvent["type"]>(result: Accepted, type: T): Extract<ActivityEvent, { type: T }>[] {
  return result.events.filter((event: BaseEvent): event is Extract<ActivityEvent, { type: T }> => event.type === type);
}

function nowLine(result: Accepted, activity: Id<"activity">): ReportLine | undefined {
  return result.lines.find((line) => line.key === `line.activity.${activity.slice("activity.".length)}.now`);
}

function entries(): ActivityEntry[] {
  return Object.values(content.activity);
}

describe("when an act answers", () => {
  test("[R-ACTIVITY-015] given the real content, when every activity entry is walked, then each says when it answers, the sorted lists hold, every job and side job takes the month, and only a now-act is a purchase", () => {
    expect(entries().filter((entry) => entry.when === undefined).map((entry) => entry.id)).toEqual([]);
    for (const id of NOW_ACTS) expect({ id, when: content.activity[id as Id<"activity">]?.when }).toEqual({ id, when: "now" });
    for (const id of MONTH_ACTS) expect({ id, when: content.activity[id as Id<"activity">]?.when }).toEqual({ id, when: "month" });
    for (const entry of entries().filter((candidate) => candidate.slot === "main" || candidate.slot === "side")) expect({ id: entry.id, when: entry.when }).toEqual({ id: entry.id, when: "month" });
    expect(entries().filter((entry) => entry.purchase === true && entry.when !== "now")).toEqual([]);
    for (const id of [LOTTO, BET, PHONE, "activity.street-shopping-uk", "activity.street-shopping-uae", "activity.pure-water"]) expect({ id, purchase: content.activity[id as Id<"activity">]?.purchase }).toEqual({ id, purchase: true });
    for (const id of [ASK_AROUND, PASSPORT, HUNT, MEETUP]) expect(content.activity[id]?.purchase).toBeUndefined();
  });

  test("[R-ACTIVITY-015] given every now-act in content, when its words are read, then the place has its now-line in a person's voice, with no number the line does not carry", () => {
    for (const entry of entries().filter((candidate) => candidate.when === "now")) {
      const key = `line.activity.${entry.id.slice("activity.".length)}.now`;
      const words = text[key];
      expect({ key, has: typeof words === "string" && words.trim().length > 0 }).toEqual({ key, has: true });
      expect(words).not.toMatch(/[–—]/u);
      for (const brace of (words ?? "").match(/\{(\w+)\}/gu) ?? []) expect(["{activity}", "{param}", "{month}"]).toContain(brace);
    }
  });
});

describe("a now-act", () => {
  test("[R-ACTIVITY-018] [R-TURN-010] given the month in hand, when a ticket is bought and the motor park is asked, then the ticket spends no time and asking spends a morning, told in the view", () => {
    const game = ada();
    expect(game.view().halfDays).toEqual({ spent: 0, free: content.tuning.turn.halfDays.noJob });
    now(game, LOTTO, "1");
    expect(game.state.turn.spent).toBe(0);
    const asked = now(game, ASK_AROUND);
    expect(asked.events).toContainEqual({ type: "turn/days-spent", halfDays: content.activity[ASK_AROUND]?.halfDays, spent: 1 });
    expect(game.view().halfDays).toEqual({ spent: 1, free: content.tuning.turn.halfDays.noJob });
    game.endTurn();
    expect(game.state.turn.spent).toBe(0);
  });

  test("[R-ACTIVITY-015] [R-LUCK-005] given the kiosk, when a ticket is bought now, then the slip is paid now from cash and said by the kiosk, no ticket is drawn yet, and the draw lands as the month ends", () => {
    const game = ada();
    const cash = game.state.wallet.pockets.NGN.cash;
    const drawn = game.state.draws.lotto ?? 0;
    const bought = now(game, LOTTO, "1");
    expect(game.state.wallet.pockets.NGN.cash).toBe(cash - content.tuning.luck.ticket);
    expect(eventsOf(bought, "activity/lotto-played")).toEqual([]);
    expect(game.state.draws.lotto ?? 0).toBe(drawn);
    expect(nowLine(bought, LOTTO)).toMatchObject({ params: { activity: LOTTO, param: "1" } });
    expect(game.state.turn.month).toBe(0);
    const month = game.endTurn();
    expect(eventsOf(month, "activity/lotto-played")).toMatchObject([{ tickets: 1, stake: { currency: "NGN", amount: content.tuning.luck.ticket } }]);
    expect(game.state.draws.lotto).toBe(drawn + 1);
    expect(game.state.activity.now).toEqual([]);
  });

  test("[R-ACTIVITY-015] [R-ROAD-002] given the motor park, when asking around now, then the Gulf is heard of now and the pitch opens now, before the month ends", () => {
    const game = ada();
    expect(game.state.route[GULF]?.state ?? "unheard").not.toBe("heard");
    const asked = now(game, ASK_AROUND);
    expect(game.state.route[GULF]?.state).toBe("heard");
    expect(Object.values(game.state.offer.items).map((offer) => offer.entry)).toContain(PITCH);
    expect(nowLine(asked, ASK_AROUND)).toBeDefined();
    expect(game.state.turn.month).toBe(0);
  });

  test("[R-ACTIVITY-015] [R-DOCUMENT-002] given no passport, when it is asked for now, then the fee is paid now, the passport is on its way now, and the place says the month it is due", () => {
    const game = ada();
    const asked = now(game, PASSPORT);
    const passport = game.state.document["document.passport"];
    expect(passport?.state).toBe("pending");
    expect((passport?.readyMonth ?? 0) - game.state.turn.month).toBeGreaterThanOrEqual(1);
    expect(nowLine(asked, PASSPORT)).toMatchObject({ params: { activity: PASSPORT, month: passport?.readyMonth } });
    expect(asked.events.some((event) => event.type === "wallet/debited" && (event as unknown as { reason: string }).reason === "fee-document")).toBe(true);
  });

  test("[R-ACTIVITY-015] [R-ACTIVITY-005] given a job to hunt, when the hunt is applied for now, then nothing is drawn now and the employer answers as the month ends", () => {
    const game = ada();
    const job = game.view().activities.find((option) => option.id === HUNT)?.params?.[0];
    if (job === undefined) throw new Error("Ada has no job to hunt.");
    const drawn = game.state.draws.job ?? 0;
    const applied = now(game, HUNT, job);
    expect(eventsOf(applied, "activity/hunted")).toEqual([]);
    expect(game.state.draws.job ?? 0).toBe(drawn);
    expect(nowLine(applied, HUNT)).toMatchObject({ params: { activity: HUNT, param: job } });
    const month = game.endTurn();
    expect(eventsOf(month, "activity/hunted")).toMatchObject([{ job }]);
  });

  test("[R-ACTIVITY-015] given a now-act done this month, when it is sent again, then it is refused until the next month, and the view says it is done; a purchase is not", () => {
    const game = ada();
    now(game, MEETUP);
    expect(game.view().activities.find((option) => option.id === MEETUP)).toMatchObject({ when: "now", done: true, allowed: false });
    game.expectRejected({ type: "activity/now", activity: MEETUP, param: null }, "not-legal");
    applyEffects(game, [{ type: "money/add", currency: "NGN", pocket: "cash", amount: content.tuning.luck.ticket * 10, reason: "gift" }]);
    now(game, LOTTO, "1");
    now(game, LOTTO, "2");
    expect(game.view().activities.find((option) => option.id === LOTTO)).toMatchObject({ done: false, allowed: true });
    const month = game.endTurn();
    expect(eventsOf(month, "activity/lotto-played").map((played) => played.tickets)).toEqual([1, 2]);
    expect(game.view().activities.find((option) => option.id === MEETUP)).toMatchObject({ done: false, allowed: true });
    now(game, MEETUP);
  });

  test("[R-ACTIVITY-015] given a now-act it cannot pay for, when it is sent, then it is refused with cannot-afford and nothing changes", () => {
    const game = ada();
    const naira = game.state.wallet.pockets.NGN;
    applyEffects(game, [
      { type: "money/take", currency: "NGN", pocket: "cash", amount: naira.cash, reason: "gift" },
      { type: "money/take", currency: "NGN", pocket: "bank", amount: naira.bank, reason: "gift" },
    ]);
    expect(game.expectRejected({ type: "activity/now", activity: PASSPORT, param: null }, "cannot-afford").code).toBe("cannot-afford");
    expect(game.expectRejected({ type: "activity/now", activity: "activity.nobody", param: null }, "unknown-id").code).toBe("unknown-id");
  });

  test("[R-ACTIVITY-015] [R-ACTIVITY-002] given a now-act, when it is put in a slot, then the month is refused with not-legal; it fills no slot", () => {
    const game = ada();
    game.expectRejected({ type: "turn/end", slots: [slot(MEETUP)] }, "not-legal");
    game.expectRejected({ type: "turn/end", slots: [slot(LOTTO, "1")] }, "not-legal");
    now(game, MEETUP);
    const month = game.endTurn([slot(LEARN), slot(LEARN), slot(LEARN)]);
    expect(eventsOf(month, "activity/slot-played").map((played) => played.activity)).toEqual([LEARN, LEARN, LEARN]);
    expect(eventsOf(month, "activity/rested")).toEqual([]);
  });
});

describe("a month-act", () => {
  test("[R-ACTIVITY-015] given a month-act, when it is sent now, then it is refused with not-legal, and in a slot it fills the month", () => {
    const game = ada();
    const PREP: Id<"activity"> = "activity.morning-run";
    game.expectRejected({ type: "activity/now", activity: PREP, param: null }, "not-legal");
    game.expectRejected({ type: "activity/now", activity: "activity.rest", param: null }, "not-legal");
    const month = game.endTurn([slot(PREP)]);
    expect(eventsOf(month, "activity/slot-played")).toMatchObject([{ activity: PREP }]);
    expect(month.lines.some((line) => line.key === "line.activity.played" && line.params.activity === PREP)).toBe(true);
  });
});
