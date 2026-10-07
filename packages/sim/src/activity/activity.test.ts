import { content } from "@japacity/content";
import { fc, test } from "@fast-check/vitest";
import { describe, expect } from "vitest";

import { check } from "../engine/check";
import type { AnyKind, Registry } from "../engine/kind";
import { characterRandom } from "../engine/random";
import { stepWith } from "../engine/step";
import type {
  Accepted,
  ActivityEntry,
  BaseEvent,
  Cause,
  Command,
  Content,
  Ctx,
  Currency,
  Effect,
  Id,
  Pocket,
  ReadCtx,
  Reason,
  RequirementResult,
  RouteStateName,
  SlotPick,
  State,
  StepResult,
  Terms,
  WalletSlice,
} from "../engine/types";
import { resolveAmount } from "../engine/check";
import { checkInvariants } from "../engine/invariants";
import { registry } from "../kinds";
import { legalCommands } from "../testing/legal";
import { miniContent } from "../testing/miniContent";
import { start } from "../testing/play";
import type { Game, Loose } from "../testing/play";
import type { ActivityEvent } from "./activity.events";
import { activityKind, canPayAll, hireChanceBp, paramsFor } from "./activity.logic";

const UK: Id<"route"> = "route.uk-masters";
const hireTuning = content.tuning.quality;

// ---------------------------------------------------------------------------
// Stand-ins for kinds that are not built yet, so these tests can see the
// effects the activity kind sends. They live here, not in the registry.
// ---------------------------------------------------------------------------

/** What the stand-in wallet records: which effect asked, and what moved. */
interface Ledger extends BaseEvent {
  type: "wallet/credited" | "wallet/debited";
  via: Effect["type"];
  asked: Pocket | "any" | "locked" | "fee";
  currency: Currency;
  pocket: Pocket;
  amount: number;
  reason: Reason;
}

function takeFrom(ctx: Ctx, effect: Effect, currency: Currency, amount: number, reason: Reason, order: Pocket[], asked: Ledger["asked"]): Ledger[] {
  const pockets = ctx.state.wallet.pockets[currency];
  if (order.reduce((sum, pocket) => sum + pockets[pocket], 0) < amount) return [];
  const debits: Ledger[] = [];
  let left = amount;
  for (const pocket of order) {
    const part = Math.min(left, pockets[pocket]);
    if (part > 0) debits.push({ type: "wallet/debited", via: effect.type, asked, currency, pocket, amount: part, reason });
    left -= part;
  }
  return debits;
}

function canPayNow(read: ReadCtx, currency: Currency, amount: number): RequirementResult {
  const pocket = read.state.wallet.pockets[currency];
  return { met: pocket.bank + pocket.cash >= amount, have: pocket.bank + pocket.cash, need: amount };
}

const realWallet = registry().find((kind) => kind.kind === "wallet")!;

const standInWallet: AnyKind = {
  ...realWallet,
  effects: {
    "money/add": (ctx, effect, cause) => {
      if (effect.type !== "money/add") throw new Error(effect.type);
      const amount = ctx.amount(effect.amount, cause.terms);
      const credit: Ledger = { type: "wallet/credited", via: effect.type, asked: effect.pocket, currency: effect.currency, pocket: effect.pocket, amount, reason: effect.reason };
      return [credit];
    },
    "money/take": (ctx, effect, cause) => {
      if (effect.type !== "money/take" || effect.pocket === "locked") throw new Error(effect.type);
      const order: Pocket[] = effect.pocket === "any" ? ["cash", "bank"] : [effect.pocket];
      return takeFrom(ctx, effect, effect.currency, ctx.amount(effect.amount, cause.terms), effect.reason, order, effect.pocket);
    },
    "money/pay-fee": (ctx, effect, cause) => {
      if (effect.type !== "money/pay-fee") throw new Error(effect.type);
      return takeFrom(ctx, effect, effect.currency, ctx.amount(effect.amount, cause.terms), effect.reason, ["bank", "cash"], "fee");
    },
  },
  requirements: {
    "money/can-pay": (read, requirement, terms) => {
      if (requirement.type !== "money/can-pay") throw new Error(requirement.type);
      return canPayNow(read, requirement.currency, resolveAmount(read, requirement.amount, terms));
    },
    "money/min": (read, requirement, terms) => {
      if (requirement.type !== "money/min") throw new Error(requirement.type);
      return canPayNow(read, requirement.currency, resolveAmount(read, requirement.amount, terms));
    },
  },
  evolve: (slice, event) => {
    const wallet = slice as WalletSlice;
    const entry = event as Ledger;
    const pocket = wallet.pockets[entry.currency];
    const moved = entry.type === "wallet/credited" ? entry.amount : -entry.amount;
    return { ...wallet, pockets: { ...wallet.pockets, [entry.currency]: { ...pocket, [entry.pocket]: pocket[entry.pocket] + moved } } };
  },
};

/** What the stand-in offer kind records when an offer is opened by an effect. */
interface Opened extends BaseEvent {
  type: "offer/test-opened";
  offer: string;
  source: string;
  terms: Terms;
}

/** The offer kind with `offer/open` recorded and, when given, `offer/choose` carrying out effects. */
function standInOffer(pending: { effects: Effect[]; cause: Cause } | null): AnyKind {
  const real = registry().find((kind) => kind.kind === "offer")!;
  return {
    ...real,
    commands: pending === null ? {} : { "offer/choose": (ctx) => ctx.apply(pending.effects, pending.cause) },
    effects: {
      "offer/open": (_ctx, effect, cause) => {
        if (effect.type !== "offer/open") throw new Error(effect.type);
        const opened: Opened = { type: "offer/test-opened", offer: effect.offer, source: cause.source, terms: cause.terms };
        return [opened];
      },
    },
    evolve: (slice) => slice,
  };
}

function kindsWith(pending: { effects: Effect[]; cause: Cause } | null): Registry {
  return registry().map((kind) => (kind.kind === "wallet" ? standInWallet : kind.kind === "offer" ? standInOffer(pending) : kind));
}

interface Lab {
  game: Game;
  send(loose: Loose): StepResult;
  end(slots?: SlotPick[]): Accepted;
  apply(effects: Effect[], cause?: Partial<Cause>): Accepted;
  read(): ReadCtx;
}

/** A game played through the registry with the stand-in wallet and offer kinds. */
function lab(scenario: Id<"scenario">, using: Content = content, seed = "seed-1"): Lab {
  const game = start({ content: using, scenario, seed });
  const run = (kinds: Registry, loose: Loose): StepResult => {
    const command: Command = { ...loose, basedOn: game.state.v };
    const result = stepWith(kinds, game.state, command, game.world(), game.content);
    if (result.ok) {
      game.state = result.state;
      if (loose.type === "turn/end") game.tick += 1;
    }
    return result;
  };
  const accepted = (result: StepResult): Accepted => {
    if (!result.ok) throw new Error(`Rejected with ${result.code}: ${result.detail}`);
    return result;
  };
  return {
    game,
    send: (loose) => run(kindsWith(null), loose),
    end: (slots = []) => accepted(run(kindsWith(null), { type: "turn/end", slots })),
    apply: (effects, cause = {}) =>
      accepted(
        run(kindsWith({ effects, cause: { source: "offer.test.yes", param: null, terms: {}, ...cause } }), {
          type: "offer/choose",
          offer: "x",
          choice: "y",
        }),
      ),
    read: () => ({ state: game.state, world: game.world(), content: game.content }),
  };
}

function own<T extends ActivityEvent["type"]>(result: Accepted, type: T): Extract<ActivityEvent, { type: T }>[] {
  return result.events.filter((event): event is Extract<ActivityEvent, { type: T }> => event.type === type);
}

/** The month's money moves made by activities. Upkeep is the obligation kind's and is left out. */
function ledger(result: Accepted): Ledger[] {
  return result.events.filter(
    (event): event is Ledger =>
      (event.type === "wallet/credited" || event.type === "wallet/debited") && (event as Ledger).reason !== "upkeep",
  );
}

function opened(result: Accepted): Opened[] {
  return result.events.filter((event): event is Opened => event.type === "offer/test-opened");
}

function setQuality(subject: Lab, quality: Id<"quality">, value: number) {
  subject.apply([{ type: "quality/add", quality, amount: value - subject.game.state.quality[quality]! }]);
  expect(subject.game.state.quality[quality]).toBe(value);
}

// ---------------------------------------------------------------------------
// A small content for the cases the real numbers make hard to reach.
// ---------------------------------------------------------------------------

function free(id: Id<"activity">, extra: Partial<ActivityEntry>): ActivityEntry {
  return { id, slot: "free", requires: [], param: null, cost: [], pay: null, hireBp: null, effects: [], counts: [], ...extra };
}

function job(id: Id<"activity">, extra: Partial<ActivityEntry>): ActivityEntry {
  return { id, slot: "main", requires: [], param: null, cost: [], pay: { currency: "NGN", amount: 5000000 }, hireBp: 0, effects: [], counts: [], ...extra };
}

const labActivities: ActivityEntry[] = [
  free("activity.burn", { effects: [{ type: "quality/add", quality: "quality.tech", amount: -20 }] }),
  free("activity.needs-tech", { requires: [{ type: "quality/min", quality: "quality.tech", value: 25 }], effects: [{ type: "quality/add", quality: "quality.tech", amount: 1 }] }),
  // The plain life holds 200,000 naira in the bank and 20,000 in cash.
  free("activity.dear", { cost: [{ currency: "NGN", amount: 30000000, reason: "study" }], effects: [{ type: "quality/add", quality: "quality.tech", amount: 1 }] }),
  free("activity.two-fees", {
    cost: [
      { currency: "NGN", amount: 15000000, reason: "study" },
      { currency: "NGN", amount: 15000000, reason: "social" },
    ],
    effects: [{ type: "quality/add", quality: "quality.tech", amount: 1 }],
  }),
  free("activity.split", { cost: [{ currency: "NGN", amount: 3000000, reason: "fee-document" }] }),
  free("activity.pounds", { cost: [{ currency: "GBP", amount: 30000, reason: "fee-visa" }], effects: [{ type: "quality/add", quality: "quality.tech", amount: 1 }] }),
  free("activity.var-fee", { cost: [{ currency: "NGN", amount: { var: "var.mini-fee" }, reason: "fee-document" }] }),
  free("activity.gig", { effects: [{ type: "activity/gig", min: 100000, max: 500000, perTech: 1000 }] }),
  free("activity.fixed-gig", { effects: [{ type: "activity/gig", min: 200000, max: 200000, perTech: 1000 }] }),
  free("activity.start-sure", { effects: [{ type: "activity/start-job", job: "activity.job-sure" }] }),
  free("activity.walk-out", { effects: [{ type: "activity/end-job", why: "walked-out" }] }),
  job("activity.job-sure", { hireBp: 10000 }),
  job("activity.job-never", { hireBp: 0 }),
  job("activity.job-dollar", { pay: { currency: "USD", amount: 280000 } }),
];

const labContent: Content = {
  ...miniContent,
  quality: {
    ...miniContent.quality,
    "quality.network": { id: "quality.network", group: "people", min: 0, max: 100, shown: true, counts: [] },
  },
  activity: { ...miniContent.activity, ...Object.fromEntries(labActivities.map((entry) => [entry.id, entry])) },
  offer: { ...miniContent.offer, "offer.job": content.offer["offer.job"]! },
  // So a hunt for a job with a full chance always lands, and one with none never does.
  tuning: { ...miniContent.tuning, quality: { ...miniContent.tuning.quality, hireMaxBp: 10000 } },
};

const pick = (activity: Id<"activity">, param: string | null = null): SlotPick => ({ activity, param });
const hunt = (target: Id<"activity">): SlotPick => pick("activity.job-hunt", target);

// ---------------------------------------------------------------------------

describe("the job, each month", () => {
  test("[R-ACTIVITY-001] given a job, when a month is played, then its pay is credited to the bank as salary, tenure goes up by one, and its effects apply, in that order", () => {
    const tunde = lab("scenario.tunde");
    const entry = content.activity["activity.job-bank-officer"]!;
    const result = tunde.end([]);
    expect(ledger(result).filter((line) => line.reason === "salary")).toEqual([
      { type: "wallet/credited", via: "money/add", asked: "bank", currency: "NGN", pocket: "bank", amount: entry.pay!.amount, reason: "salary" },
    ]);
    expect(tunde.game.state.activity.tenure["activity.job-bank-officer"]).toBe(49);
    expect(own(result, "activity/month-worked")).toEqual([
      { type: "activity/month-worked", job: "activity.job-bank-officer", tenure: 49, pay: { currency: "NGN", amount: entry.pay!.amount } },
    ]);
    const types = result.events.map((event) => event.type);
    const salary = types.indexOf("wallet/credited");
    const worked = types.indexOf("activity/month-worked");
    const effect = result.events.findIndex((event) => event.type === "quality/changed" && (event as { source?: string }).source === entry.id);
    expect(salary).toBeGreaterThanOrEqual(0);
    expect(salary).toBeLessThan(worked);
    expect(worked).toBeLessThan(effect);
    expect(result.events.filter((event) => (event as { source?: string }).source === entry.id)).toEqual([
      { type: "quality/changed", quality: "quality.network", amount: 1, source: entry.id },
      { type: "quality/changed", quality: "quality.wellbeing", amount: -5, source: entry.id },
    ]);
  });

  test("[R-ACTIVITY-001] given a job paid in dollars, when a month is played, then the pay is credited to the dollar bank pocket", () => {
    const plain = lab("scenario.plain", labContent);
    plain.apply([{ type: "activity/start-job", job: "activity.job-dollar" }]);
    const result = plain.end([]);
    expect(ledger(result).filter((line) => line.reason === "salary")).toEqual([
      { type: "wallet/credited", via: "money/add", asked: "bank", currency: "USD", pocket: "bank", amount: 280000, reason: "salary" },
    ]);
    expect(plain.game.state.wallet.pockets.USD.bank).toBe(280000);
  });

  test("[R-ACTIVITY-001] given no job, when a month is played, then nothing is paid and no tenure moves", () => {
    const ada = lab("scenario.ada");
    const result = ada.end([]);
    expect(ledger(result)).toEqual([]);
    expect(own(result, "activity/month-worked")).toEqual([]);
    expect(ada.game.state.activity.tenure).toEqual({});
  });

  test("[R-ACTIVITY-001] given a job, when a month is played, then the report says what the salary was", () => {
    const game = start({ content, scenario: "scenario.tunde" });
    const result = game.endTurn([]);
    expect(result.lines).toContainEqual({
      key: "line.activity.salary",
      params: { job: "activity.job-bank-officer", amount: { currency: "NGN", amount: content.activity["activity.job-bank-officer"]!.pay!.amount as number } },
      tone: "good",
      attention: false,
      counts: [],
    });
  });

  test("[R-ACTIVITY-001] given a job held, when another is started, then only one is held", () => {
    const tunde = lab("scenario.tunde");
    tunde.apply([{ type: "activity/start-job", job: "activity.job-teacher" }]);
    expect(tunde.game.state.activity.job).toBe("activity.job-teacher");
    const result = tunde.end([]);
    expect(own(result, "activity/month-worked").map((event) => event.job)).toEqual(["activity.job-teacher"]);
  });
});

describe("what may fill a slot", () => {
  test("[R-ACTIVITY-002] given a job as a slot, when the turn is ended, then it is rejected with not-legal", () => {
    const game = start({ content, scenario: "scenario.ada" });
    expect(game.expectRejected({ type: "turn/end", slots: [pick("activity.job-teacher")] }, "not-legal").code).toBe("not-legal");
  });

  test("[R-ACTIVITY-002] given an activity that is not in content, or a slot that is not a pick, when the turn is ended, then it is rejected with not-legal", () => {
    const game = start({ content, scenario: "scenario.ada" });
    expect(game.expectRejected({ type: "turn/end", slots: [pick("activity.nothing")] }, "not-legal").code).toBe("not-legal");
    expect(game.expectRejected({ type: "turn/end", slots: [null as unknown as SlotPick] }, "not-legal").code).toBe("not-legal");
  });

  test("[R-ACTIVITY-002] given an activity whose requirements do not hold, when the turn is ended, then it is rejected with not-legal", () => {
    const game = start({ content, scenario: "scenario.ada" });
    expect(game.state.quality["quality.tech"]).toBeLessThan(40);
    expect(game.expectRejected({ type: "turn/end", slots: [pick("activity.build-portfolio")] }, "not-legal").code).toBe("not-legal");
    const zainab = start({ content, scenario: "scenario.zainab" });
    zainab.endTurn([pick("activity.build-portfolio")]);
  });

  test("[R-ACTIVITY-002] given a param on an activity that takes none, or none on one that takes one, when the turn is ended, then it is rejected with not-legal", () => {
    const game = start({ content, scenario: "scenario.ada" });
    expect(game.expectRejected({ type: "turn/end", slots: [pick("activity.rest", "activity.job-teacher")] }, "not-legal").code).toBe("not-legal");
    expect(game.expectRejected({ type: "turn/end", slots: [pick("activity.job-hunt")] }, "not-legal").code).toBe("not-legal");
  });

  test("[R-ACTIVITY-002] [R-ACTIVITY-005] given a hunt for a job whose requirements do not hold, the job held, or something that is not a job, when the turn is ended, then it is rejected with not-legal", () => {
    const ada = start({ content, scenario: "scenario.ada" });
    expect(ada.expectRejected({ type: "turn/end", slots: [hunt("activity.job-remote-dev")] }, "not-legal").code).toBe("not-legal");
    expect(ada.expectRejected({ type: "turn/end", slots: [hunt("activity.rest")] }, "not-legal").code).toBe("not-legal");
    const tunde = start({ content, scenario: "scenario.tunde" });
    expect(tunde.expectRejected({ type: "turn/end", slots: [hunt("activity.job-bank-officer")] }, "not-legal").code).toBe("not-legal");
    tunde.endTurn([hunt("activity.job-bank-senior")]);
    ada.endTurn([hunt("activity.job-teacher")]);
  });

  test("[R-ACTIVITY-002] given one bad slot among good ones, when the turn is ended, then the whole turn is rejected and nothing moves", () => {
    const game = start({ content, scenario: "scenario.ada" });
    expect(game.expectRejected({ type: "turn/end", slots: [pick("activity.rest"), pick("activity.build-portfolio")] }, "not-legal").code).toBe("not-legal");
    expect(game.state.turn.month).toBe(0);
  });
});

describe("the params a free activity may take now", () => {
  function readWith(game: Game, change: (state: State) => State): ReadCtx {
    return { state: change(game.state), world: game.world(), content: game.content };
  }
  const routeIn = (to: RouteStateName) => (state: State): State => ({ ...state, route: { ...state.route, [UK]: { ...state.route[UK]!, state: to } } });
  const band = (value: number | null, held: "held" | "pending" = "held") => (state: State): State => ({
    ...state,
    document: { ...state.document, "document.english-test": { state: held, readyMonth: 0, expiresMonth: 24, value } },
  });
  const grade = (value: number) => (state: State): State => ({ ...state, quality: { ...state.quality, "quality.edu-grade": value } });
  const all = (...changes: ((state: State) => State)[]) => (state: State): State => changes.reduce((acc, change) => change(acc), state);
  const school = content.activity["activity.apply-to-school"]!;

  test("[R-ACTIVITY-002] given an activity that takes no param, when its params are listed, then there are none to list", () => {
    const game = start({ content, scenario: "scenario.ada" });
    expect(paramsFor(readWith(game, (state) => state), content.activity["activity.rest"]!)).toBeNull();
  });

  test("[R-ACTIVITY-002] [R-ACTIVITY-005] given a life, when the jobs to hunt are listed, then they are the jobs whose requirements hold, less the one held", () => {
    const ada = start({ content, scenario: "scenario.ada" });
    const huntEntry = content.activity["activity.job-hunt"]!;
    expect(paramsFor(readWith(ada, (state) => state), huntEntry)).toEqual([
      "activity.job-teacher",
      "activity.job-customer-service",
      "activity.job-junior-dev",
      "activity.job-bank-officer",
    ]);
    const tunde = start({ content, scenario: "scenario.tunde" });
    expect(paramsFor(readWith(tunde, (state) => state), huntEntry)).toEqual([
      "activity.job-teacher",
      "activity.job-customer-service",
      "activity.job-bank-senior",
    ]);
  });

  test("[R-ACTIVITY-002] given routes in each state, when the routes to look into are listed, then only a heard route is", () => {
    const game = start({ content, scenario: "scenario.ada" });
    const look = content.activity["activity.look-into-route"]!;
    expect(paramsFor(readWith(game, routeIn("heard")), look)).toEqual([UK]);
    for (const other of ["unknown", "known", "applying"] as const) expect(paramsFor(readWith(game, routeIn(other)), look)).toEqual([]);
  });

  test("[R-ACTIVITY-002] given a known route, a grade and a band, when the schools are listed, then each school whose minimums are met is listed, each edge included", () => {
    const game = start({ content, scenario: "scenario.ada" });
    expect(game.state.quality["quality.edu-grade"]).toBe(4);
    expect(paramsFor(readWith(game, all(routeIn("known"), band(65))), school)).toEqual(["school.northgate", "school.ashby"]);
    expect(paramsFor(readWith(game, all(routeIn("known"), band(70))), school)).toEqual(["school.northgate", "school.ashby", "school.kingsmere"]);
    expect(paramsFor(readWith(game, all(routeIn("known"), band(60))), school)).toEqual(["school.northgate"]);
    expect(paramsFor(readWith(game, all(routeIn("known"), band(55))), school)).toEqual([]);
    expect(paramsFor(readWith(game, all(routeIn("known"), band(70), grade(3))), school)).toEqual(["school.northgate"]);
    expect(paramsFor(readWith(game, all(routeIn("known"), band(70), grade(2))), school)).toEqual([]);
  });

  test("[R-ACTIVITY-002] given no band held, a route not known, or an application already there, when the schools are listed, then those are left out", () => {
    const game = start({ content, scenario: "scenario.ada" });
    expect(paramsFor(readWith(game, routeIn("known")), school)).toEqual([]);
    expect(paramsFor(readWith(game, all(routeIn("known"), band(70, "pending"))), school)).toEqual([]);
    expect(paramsFor(readWith(game, all(routeIn("known"), band(null))), school)).toEqual([]);
    expect(paramsFor(readWith(game, all(routeIn("heard"), band(70))), school)).toEqual([]);
    const applied = (state: State): State => ({
      ...state,
      route: {
        ...state.route,
        [UK]: {
          ...state.route[UK]!,
          schools: {
            "school.northgate": { state: "pending", readyMonth: 3, discount: 0 },
            "school.kingsmere": { state: "offer", readyMonth: 2, discount: 0 },
          },
        },
      },
    });
    expect(paramsFor(readWith(game, all(routeIn("known"), band(70), applied)), school)).toEqual(["school.ashby"]);
  });
});

describe("resolving the slots", () => {
  test("[R-ACTIVITY-003] given a slot whose requirements an earlier slot broke, when the turn resolves, then it fails, no effect applies and the report says why", () => {
    const plain = lab("scenario.plain", labContent);
    const result = plain.end([pick("activity.burn"), pick("activity.needs-tech")]);
    expect(own(result, "activity/slot-failed")).toEqual([
      { type: "activity/slot-failed", slot: 1, activity: "activity.needs-tech", param: null, why: "requirements" },
    ]);
    expect(plain.game.state.quality["quality.tech"]).toBe(10);
    expect(result.lines).toContainEqual({ key: "line.activity.failed-requirements", params: { activity: "activity.needs-tech" }, tone: "bad", attention: false, counts: [] });
  });

  test("[R-ACTIVITY-003] given the same two slots the other way round, when the turn resolves, then both are played, first slot first", () => {
    const plain = lab("scenario.plain", labContent);
    const result = plain.end([pick("activity.needs-tech"), pick("activity.burn")]);
    expect(own(result, "activity/slot-played").map((event) => [event.slot, event.activity])).toEqual([
      [0, "activity.needs-tech"],
      [1, "activity.burn"],
    ]);
    expect(own(result, "activity/slot-failed")).toEqual([]);
    expect(plain.game.state.quality["quality.tech"]).toBe(11);
  });

  test("[R-ACTIVITY-003] given a cost that cannot be paid, when the slot resolves, then it fails, nothing is paid and no effect applies", () => {
    const plain = lab("scenario.plain", labContent);
    // The month's upkeep is still charged in the due phase, so the pockets are compared with a month in which every slot rests.
    const rested = lab("scenario.plain", labContent);
    rested.end([]);
    const result = plain.end([pick("activity.dear"), pick("activity.needs-tech")]);
    expect(own(result, "activity/slot-failed")).toEqual([{ type: "activity/slot-failed", slot: 0, activity: "activity.dear", param: null, why: "cost" }]);
    expect(ledger(result)).toEqual([]);
    expect(plain.game.state.wallet.pockets.NGN).toEqual(rested.game.state.wallet.pockets.NGN);
    expect(plain.game.state.quality["quality.tech"]).toBe(31);
    expect(result.lines).toContainEqual({ key: "line.activity.failed-cost", params: { activity: "activity.dear" }, tone: "bad", attention: false, counts: [] });
  });

  test("[R-ACTIVITY-003] given two costs each payable alone but not together, when the slot resolves, then it fails and neither is paid", () => {
    const plain = lab("scenario.plain", labContent);
    const result = plain.end([pick("activity.two-fees")]);
    expect(own(result, "activity/slot-failed").map((event) => event.why)).toEqual(["cost"]);
    expect(ledger(result)).toEqual([]);
  });

  test("[R-ACTIVITY-003] given a hunt for a job an earlier slot started, when the hunt resolves, then it fails because the param is no longer one it may take", () => {
    const plain = lab("scenario.plain", labContent);
    const result = plain.end([pick("activity.start-sure"), hunt("activity.job-sure")]);
    expect(plain.game.state.activity.job).toBe("activity.job-sure");
    expect(own(result, "activity/slot-failed")).toEqual([
      { type: "activity/slot-failed", slot: 1, activity: "activity.job-hunt", param: "activity.job-sure", why: "param" },
    ]);
    expect(own(result, "activity/hunted")).toEqual([]);
  });

  test("[R-ACTIVITY-004] given a naira cost, when it is paid, then it is taken from any pocket, cash first, under its own reason", () => {
    const plain = lab("scenario.plain", labContent);
    const cash = plain.game.state.wallet.pockets.NGN.cash;
    const result = plain.end([pick("activity.split")]);
    expect(ledger(result)).toEqual([
      { type: "wallet/debited", via: "money/take", asked: "any", currency: "NGN", pocket: "cash", amount: cash, reason: "fee-document" },
      { type: "wallet/debited", via: "money/take", asked: "any", currency: "NGN", pocket: "bank", amount: 3000000 - cash, reason: "fee-document" },
    ]);
  });

  test("[R-ACTIVITY-004] given two naira costs with their own reasons, when they are paid, then each is paid under its own reason", () => {
    const plain = lab("scenario.plain", labContent);
    plain.apply([{ type: "money/add", currency: "NGN", pocket: "bank", amount: 50000000, reason: "gift" }]);
    const result = plain.end([pick("activity.two-fees")]);
    expect(ledger(result).map((line) => [line.via, line.reason, line.amount])).toEqual([
      ["money/take", "study", 2000000],
      ["money/take", "study", 13000000],
      ["money/take", "social", 15000000],
    ]);
    expect(own(result, "activity/slot-played")).toHaveLength(1);
  });

  test("[R-ACTIVITY-004] given a cost in pounds, when it is paid, then it is paid as a foreign fee under its own reason", () => {
    const worker = lab("scenario.worker", labContent);
    const result = worker.end([pick("activity.pounds")]);
    expect(ledger(result).filter((line) => line.type === "wallet/debited")).toEqual([
      { type: "wallet/debited", via: "money/pay-fee", asked: "fee", currency: "GBP", pocket: "bank", amount: 30000, reason: "fee-visa" },
    ]);
  });

  test("[R-ACTIVITY-004] given a cost read from the world, when it is paid, then the world's figure is taken", () => {
    const plain = lab("scenario.plain", labContent);
    const fee = plain.game.world().vars["var.mini-fee"]!;
    const result = plain.end([pick("activity.var-fee")]);
    expect(ledger(result).reduce((sum, line) => sum + line.amount, 0)).toBe(fee);
  });

  test("[R-ACTIVITY-003] given a played slot, when it resolves, then the report says it was done, before its effects", () => {
    const plain = lab("scenario.plain", labContent);
    const result = plain.end([pick("activity.study")]);
    const keys = result.lines.map((line) => line.key);
    expect(result.lines).toContainEqual({ key: "line.activity.played", params: { activity: "activity.study" }, tone: "plain", attention: false, counts: [] });
    expect(keys.indexOf("line.activity.played")).toBeLessThan(keys.indexOf("line.quality.gain"));
    const changed = result.events.filter((event) => event.type === "quality/changed" && (event as { source?: string }).source === "activity.study");
    expect(changed).toEqual([{ type: "quality/changed", quality: "quality.tech", amount: 4, source: "activity.study" }]);
  });
});

describe("empty slots", () => {
  const rest = content.tuning.quality.wellbeingRest;

  test("[R-TURN-006] given three free slots and one filled, when the month resolves, then the two empty ones each give rest", () => {
    const plain = lab("scenario.plain", labContent);
    setQuality(plain, "quality.wellbeing", 30);
    const result = plain.end([hunt("activity.job-never")]);
    expect(own(result, "activity/rested")).toEqual([{ type: "activity/rested", slots: 2 }]);
    // Then the month's drift of 2 toward 60.
    expect(plain.game.state.quality["quality.wellbeing"]).toBe(30 + 2 * rest + 2);
  });

  test("[R-TURN-006] given three free slots and none filled, when the month resolves, then all three give rest", () => {
    const plain = lab("scenario.plain", labContent);
    setQuality(plain, "quality.wellbeing", 30);
    const result = plain.end([]);
    expect(own(result, "activity/rested")).toEqual([{ type: "activity/rested", slots: 3 }]);
    expect(plain.game.state.quality["quality.wellbeing"]).toBe(30 + 3 * rest - 2);
  });

  test("[R-TURN-006] given a job, two free slots and none filled, when the month resolves, then two give rest after the job's own toll", () => {
    const worker = lab("scenario.worker", labContent);
    setQuality(worker, "quality.wellbeing", 40);
    const result = worker.end([]);
    expect(own(result, "activity/rested")).toEqual([{ type: "activity/rested", slots: 2 }]);
    expect(worker.game.state.quality["quality.wellbeing"]).toBe(40 - 2 + 2 * rest - 2);
  });

  test("[R-TURN-006] given a job and wellbeing under the burnout line, one free slot and none filled, when the month resolves, then one gives rest", () => {
    const worker = lab("scenario.worker", labContent);
    const wellbeing = worker.game.state.quality["quality.wellbeing"]!;
    expect(wellbeing).toBeLessThan(content.tuning.quality.burnoutBelow);
    const result = worker.end([]);
    expect(own(result, "activity/rested")).toEqual([{ type: "activity/rested", slots: 1 }]);
    expect(worker.game.state.quality["quality.wellbeing"]).toBe(wellbeing - 2 + rest + 2);
  });

  test("[R-TURN-006] given every free slot filled, when the month resolves, then nothing rests", () => {
    const plain = lab("scenario.plain", labContent);
    const result = plain.end([hunt("activity.job-never"), hunt("activity.job-never"), hunt("activity.job-never")]);
    expect(own(result, "activity/rested")).toEqual([]);
  });
});

describe("hunting for a job", () => {
  const teacher = content.activity["activity.job-teacher"]!;

  test("[R-ACTIVITY-005] given a job's base chance and a network, when the chance is worked out, then it is the base plus 20 for each point of network", () => {
    expect(hireChanceBp(teacher, 0, hireTuning)).toBe(teacher.hireBp);
    expect(hireChanceBp(teacher, 15, hireTuning)).toBe(teacher.hireBp! + 15 * hireTuning.networkHireBp);
    expect(hireTuning.networkHireBp).toBe(20);
  });

  test("[R-ACTIVITY-005] given a chance that would pass 9500, when it is worked out, then it stops at 9500, and just under the cap it does not", () => {
    const strong = { ...teacher, hireBp: 7500 };
    expect(hireChanceBp(strong, 99, hireTuning)).toBe(9480);
    expect(hireChanceBp(strong, 100, hireTuning)).toBe(9500);
    expect(hireChanceBp({ ...teacher, hireBp: 9000 }, 100, hireTuning)).toBe(9500);
    expect(hireTuning.hireMaxBp).toBe(9500);
  });

  test("[R-ACTIVITY-005] given a hunt that lands, when it resolves, then a job offer opens naming the job in its terms", () => {
    const plain = lab("scenario.plain", labContent);
    const result = plain.end([hunt("activity.job-sure")]);
    expect(own(result, "activity/hunted")).toEqual([{ type: "activity/hunted", job: "activity.job-sure", hired: true }]);
    expect(opened(result)).toEqual([{ type: "offer/test-opened", offer: "offer.job", source: "activity.job-hunt", terms: { job: "activity.job-sure" } }]);
    expect(plain.game.state.draws.job).toBe(1);
    expect(result.lines).toContainEqual({ key: "line.activity.hunt-hired", params: { job: "activity.job-sure" }, tone: "good", attention: true, counts: [] });
  });

  test("[R-ACTIVITY-005] given a hunt that misses, when it resolves, then no offer opens and the report says so", () => {
    const plain = lab("scenario.plain", labContent);
    const result = plain.end([hunt("activity.job-never")]);
    expect(own(result, "activity/hunted")).toEqual([{ type: "activity/hunted", job: "activity.job-never", hired: false }]);
    expect(opened(result)).toEqual([]);
    expect(plain.game.state.draws.job).toBe(1);
    expect(result.lines).toContainEqual({ key: "line.activity.hunt-missed", params: { job: "activity.job-never" }, tone: "plain", attention: false, counts: [] });
  });

  test.prop([fc.string({ minLength: 1, maxLength: 8 })], { numRuns: 30 })(
    "[R-ACTIVITY-005] given any seed, when Ada hunts for the teaching job, then it lands exactly when the job stream's first draw falls under her chance",
    (seed) => {
      const ada = lab("scenario.ada", content, seed);
      const chance = hireChanceBp(teacher, ada.game.state.quality["quality.network"]!, hireTuning);
      const expected = characterRandom(seed, {}).chance("job", chance);
      const result = ada.end([hunt("activity.job-teacher")]);
      expect(own(result, "activity/hunted")).toEqual([{ type: "activity/hunted", job: "activity.job-teacher", hired: expected }]);
      expect(opened(result)).toHaveLength(expected ? 1 : 0);
    },
  );
});

describe("starting and leaving a job", () => {
  test("[R-ACTIVITY-006] given a job held, when another is started, then it replaces the old one at once and the old tenure is kept", () => {
    const tunde = lab("scenario.tunde");
    const result = tunde.apply([{ type: "activity/start-job", job: "activity.job-teacher" }]);
    expect(own(result, "activity/job-started")).toEqual([{ type: "activity/job-started", job: "activity.job-teacher", previous: "activity.job-bank-officer" }]);
    expect(tunde.game.state.activity.job).toBe("activity.job-teacher");
    expect(tunde.game.state.activity.tenure["activity.job-bank-officer"]).toBe(48);
    expect(tunde.game.view().job).toEqual({ id: "activity.job-teacher", months: 0 });
  });

  test("[R-ACTIVITY-006] given a job named by a term, when it is started, then the job is read from the terms in hand", () => {
    const ada = lab("scenario.ada");
    ada.apply([{ type: "activity/start-job", job: { term: "job" } }], { terms: { job: "activity.job-junior-dev" } });
    expect(ada.game.state.activity.job).toBe("activity.job-junior-dev");
  });

  test("[R-ACTIVITY-006] given the job already held, when it is started again, then nothing happens", () => {
    const tunde = lab("scenario.tunde");
    const result = tunde.apply([{ type: "activity/start-job", job: "activity.job-bank-officer" }]);
    expect(own(result, "activity/job-started")).toEqual([]);
  });

  test("[R-ACTIVITY-006] given a job, when the player quits, then there is no job, the tenure is kept and the free slots go back to three", () => {
    const game = start({ content, scenario: "scenario.tunde" });
    const result = game.accept({ type: "activity/quit" });
    expect(game.state.activity.job).toBeNull();
    expect(game.state.activity.tenure["activity.job-bank-officer"]).toBe(48);
    expect(game.view().freeSlots).toBe(content.tuning.turn.freeSlotsNoJob);
    expect(result.lines).toEqual([{ key: "line.activity.quit", params: { job: "activity.job-bank-officer" }, tone: "plain", attention: false, counts: [] }]);
    game.endTurn([]);
    expect(game.state.activity.tenure["activity.job-bank-officer"]).toBe(48);
  });

  test("[R-ACTIVITY-006] given no job, when the player quits, then it is rejected with not-legal", () => {
    const game = start({ content, scenario: "scenario.ada" });
    expect(game.expectRejected({ type: "activity/quit" }, "not-legal").code).toBe("not-legal");
  });

  test("[R-ACTIVITY-006] given a job, when an effect ends it, then there is no job, the reason is kept on the event and the report says so", () => {
    const worker = lab("scenario.worker", labContent);
    const result = worker.end([pick("activity.walk-out")]);
    expect(own(result, "activity/job-ended")).toEqual([{ type: "activity/job-ended", job: "activity.job-clerk", why: "walked-out" }]);
    expect(worker.game.state.activity.job).toBeNull();
    expect(worker.game.state.activity.tenure["activity.job-clerk"]).toBe(13);
    expect(result.lines).toContainEqual({ key: "line.activity.job-ended", params: { job: "activity.job-clerk" }, tone: "bad", attention: false, counts: [] });
  });

  test("[R-ACTIVITY-006] given no job, when an effect ends it, then nothing happens", () => {
    const plain = lab("scenario.plain", labContent);
    const result = plain.end([pick("activity.walk-out")]);
    expect(own(result, "activity/job-ended")).toEqual([]);
  });

  test("[R-ACTIVITY-006] given tenure in several jobs, when activity/tenure is judged, then the listed jobs add up, and an empty list means every job", () => {
    const tunde = lab("scenario.tunde");
    tunde.apply([{ type: "activity/start-job", job: "activity.job-teacher" }]);
    tunde.end([]);
    const read = tunde.read();
    const both: Id<"activity">[] = ["activity.job-bank-officer", "activity.job-teacher"];
    expect(check(read, { type: "activity/tenure", activities: both, months: 49 })).toEqual({ met: true, have: 49, need: 49 });
    expect(check(read, { type: "activity/tenure", activities: both, months: 50 })).toEqual({ met: false, have: 49, need: 50 });
    expect(check(read, { type: "activity/tenure", activities: ["activity.job-bank-officer"], months: 36 })).toEqual({ met: true, have: 48, need: 36 });
    expect(check(read, { type: "activity/tenure", activities: [], months: 49 })).toEqual({ met: true, have: 49, need: 49 });
    expect(check(read, { type: "activity/tenure", activities: ["activity.job-mid-dev"], months: 1 })).toEqual({ met: false, have: 0, need: 1 });
  });
});

describe("requirements stop mattering once the job is held", () => {
  test("[R-ACTIVITY-007] given a job whose requirements stop holding, when months pass, then the job is kept and still pays", () => {
    const worker = lab("scenario.worker", labContent);
    setQuality(worker, "quality.edu-level", 0);
    expect(check(worker.read(), miniContent.activity["activity.job-clerk"]!.requires[0]!).met).toBe(false);
    const result = worker.end([]);
    expect(worker.game.state.activity.job).toBe("activity.job-clerk");
    expect(own(result, "activity/month-worked")).toHaveLength(1);
    expect(ledger(result).filter((line) => line.reason === "salary")).toHaveLength(1);
  });

  test("[R-ACTIVITY-007] given a job whose requirements do not hold, when the jobs to hunt are listed, then it is not among them", () => {
    const ada = start({ content, scenario: "scenario.ada" });
    const listed = paramsFor({ state: ada.state, world: ada.world(), content }, content.activity["activity.job-hunt"]!) ?? [];
    expect(listed).not.toContain("activity.job-mid-dev");
    expect(listed).not.toContain("activity.job-remote-dev");
  });
});

describe("side gigs", () => {
  test("[R-ACTIVITY-008] given a gig, when it resolves, then it pays cash: a draw on the gig stream between its figures, plus its figure for each point of tech", () => {
    const plain = lab("scenario.plain", labContent, "gig-seed");
    const tech = plain.game.state.quality["quality.tech"]!;
    const drawn = characterRandom("gig-seed", {}).between("gig", 100000, 500000);
    const result = plain.end([pick("activity.gig")]);
    expect(ledger(result)).toEqual([
      { type: "wallet/credited", via: "money/add", asked: "cash", currency: "NGN", pocket: "cash", amount: drawn + 1000 * tech, reason: "gig" },
    ]);
    expect(plain.game.state.draws.gig).toBe(1);
    expect(result.lines).toContainEqual({ key: "line.activity.gig", params: { amount: { currency: "NGN", amount: drawn + 1000 * tech } }, tone: "good", attention: false, counts: [] });
  });

  test("[R-ACTIVITY-008] given a gig whose lowest and highest figures are equal, when it resolves, then it pays exactly that plus the tech figure", () => {
    const plain = lab("scenario.plain", labContent);
    const tech = plain.game.state.quality["quality.tech"]!;
    const result = plain.end([pick("activity.fixed-gig")]);
    expect(ledger(result).map((line) => line.amount)).toEqual([200000 + 1000 * tech]);
  });

  test("[R-ACTIVITY-008] given the real side gig, when it resolves, then the pay lies between its figures plus the tech figure", () => {
    const zainab = lab("scenario.zainab");
    const tech = zainab.game.state.quality["quality.tech"]!;
    const gig = content.activity["activity.side-gig"]!.effects[0]!;
    if (gig.type !== "activity/gig") throw new Error("The side gig's first effect is the gig.");
    const result = zainab.end([pick("activity.side-gig")]);
    const paid = ledger(result).filter((line) => line.reason === "gig");
    expect(paid).toHaveLength(1);
    expect(paid[0]!.pocket).toBe("cash");
    expect(paid[0]!.amount).toBeGreaterThanOrEqual(gig.min + gig.perTech * tech);
    expect(paid[0]!.amount).toBeLessThanOrEqual(gig.max + gig.perTech * tech);
  });
});

describe("same again", () => {
  test("[R-ACTIVITY-009] given slots played, when the month ends, then they are stored and shown, and an empty month stores none", () => {
    const plain = lab("scenario.plain", labContent);
    const slots = [pick("activity.study"), pick("activity.dear"), hunt("activity.job-never")];
    plain.end(slots);
    expect(plain.game.state.activity.lastSlots).toEqual(slots);
    expect(plain.game.view().lastSlots).toEqual(slots);
    plain.end([]);
    expect(plain.game.state.activity.lastSlots).toEqual([]);
  });
});

describe("the view of activities", () => {
  test("[R-ACTIVITY-002] given a life, when the view is read, then every free activity is listed with why not, its params, its cost and whether it can be paid", () => {
    const game = start({ content, scenario: "scenario.ada" });
    const read: ReadCtx = { state: game.state, world: game.world(), content };
    const view = game.view();
    const freeIds = Object.values(content.activity).filter((entry) => entry.slot === "free").map((entry) => entry.id);
    expect(view.activities.map((option) => option.id)).toEqual(freeIds);
    const portfolio = view.activities.find((option) => option.id === "activity.build-portfolio")!;
    expect(portfolio).toMatchObject({ allowed: false, missing: content.activity["activity.build-portfolio"]!.requires, params: null, cost: [], affordable: true });
    const huntOption = view.activities.find((option) => option.id === "activity.job-hunt")!;
    expect(huntOption).toMatchObject({ allowed: true, missing: [], params: paramsFor(read, content.activity["activity.job-hunt"]!) });
    const english = view.activities.find((option) => option.id === "activity.study-english")!;
    const fee = content.activity["activity.study-english"]!.cost[0]!;
    expect(english.cost).toEqual([{ currency: "NGN", amount: fee.amount }]);
    expect(english.affordable).toBe(check(read, { type: "money/can-pay", currency: "NGN", amount: fee.amount }).met);
  });

  test("[R-ACTIVITY-002] given an activity with a param and nothing it may take, when the view is read, then it is not allowed", () => {
    const worker = start({ scenario: "scenario.worker" });
    const huntOption = worker.view().activities.find((option) => option.id === "activity.job-hunt")!;
    expect(huntOption).toMatchObject({ allowed: false, missing: [], params: [] });
  });

  test("[R-ACTIVITY-004] given a cost read from the world, when the view is read, then the cost shows the world's figure", () => {
    const game = start({ content: labContent, scenario: "scenario.plain" });
    const option = game.view().activities.find((item) => item.id === "activity.var-fee")!;
    expect(option.cost).toEqual([{ currency: "NGN", amount: game.world().vars["var.mini-fee"]! }]);
  });

  test("[R-ACTIVITY-003] given costs in one currency, when whether they can be paid is judged, then they are judged together", () => {
    const asked: number[] = [];
    const judge = (requirement: { type: string; amount?: unknown }) => {
      asked.push(requirement.amount as number);
      return { met: (requirement.amount as number) <= 100 };
    };
    expect(canPayAll([{ currency: "NGN", amount: 60 }, { currency: "NGN", amount: 60 }], judge)).toBe(false);
    expect(asked).toEqual([120]);
    expect(canPayAll([{ currency: "NGN", amount: 60 }, { currency: "GBP", amount: 60 }], judge)).toBe(true);
    expect(canPayAll([], judge)).toBe(true);
  });
});

describe("jobs as requirements", () => {
  test("[R-ACTIVITY-001] given a life with and without a job, when the job requirements are judged, then they follow the job held", () => {
    const tunde = start({ content, scenario: "scenario.tunde" });
    const ada = start({ content, scenario: "scenario.ada" });
    const of = (game: Game): ReadCtx => ({ state: game.state, world: game.world(), content });
    expect(check(of(tunde), { type: "job/any" }).met).toBe(true);
    expect(check(of(tunde), { type: "job/none" }).met).toBe(false);
    expect(check(of(tunde), { type: "job/is", activities: ["activity.job-teacher", "activity.job-bank-officer"] }).met).toBe(true);
    expect(check(of(tunde), { type: "job/is", activities: ["activity.job-teacher"] }).met).toBe(false);
    expect(check(of(ada), { type: "job/any" }).met).toBe(false);
    expect(check(of(ada), { type: "job/none" }).met).toBe(true);
    expect(check(of(ada), { type: "job/is", activities: ["activity.job-teacher"] }).met).toBe(false);
  });
});

describe("invariants and random play", () => {
  test("[R-ACTIVITY-001] given a free activity or an unknown id held as the job, when the invariants are checked, then it is named", () => {
    const game = start({ content, scenario: "scenario.ada" });
    const bad = (job: string) => activityKind.invariants?.({ ...game.state, activity: { ...game.state.activity, job: job as Id<"activity"> } }, content) ?? [];
    expect(bad("activity.rest")).toHaveLength(1);
    expect(bad("activity.ghost")).toHaveLength(1);
    expect(activityKind.invariants?.(game.state, content)).toEqual([]);
  });

  const lives = Object.keys(content.scenario) as Id<"scenario">[];

  test.prop([fc.constantFrom(...lives), fc.string({ minLength: 1, maxLength: 8 }), fc.array(fc.nat(), { minLength: 30, maxLength: 30 })], { numRuns: 15 })(
    "[R-ACTIVITY-002] given the real lives, when commands from the legal list are played, then every one is accepted and the invariants hold",
    (life, seed, picks) => {
      const game = start({ content, scenario: life, seed });
      for (const choice of picks) {
        const legal = legalCommands(game.view());
        if (legal.length === 0) {
          game.grant(1);
          continue;
        }
        const command = legal[choice % legal.length]!;
        const result = game.send(command);
        if (!result.ok) throw new Error(`${command.type} ${JSON.stringify(command)} was rejected with ${result.code}: ${result.detail}`);
        expect(result.ok).toBe(true);
        expect(checkInvariants(game.state, content)).toEqual([]);
      }
    },
  );

  test("[R-ACTIVITY-002] given a life with jobs to hunt, when the legal list is read, then it offers a hunt for each of them", () => {
    const game = start({ content, scenario: "scenario.ada" });
    const view = game.view();
    const hunts = legalCommands(view)
      .filter((command) => command.type === "turn/end")
      .flatMap((command) => (command.type === "turn/end" ? command.slots : []))
      .filter((slot) => slot.activity === "activity.job-hunt")
      .map((slot) => slot.param);
    const jobs = view.activities.find((option) => option.id === "activity.job-hunt")!.params!;
    for (const target of jobs) expect(hunts).toContain(target);
  });
});
