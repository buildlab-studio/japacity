import { fc, test } from "@fast-check/vitest";
import { content, text } from "@japacity/content";
import { describe, expect } from "vitest";

import { bp, divFloor, valueInKobo } from "../engine/int";
import { checkInvariantsWith } from "../engine/invariants";
import type { Registry } from "../engine/kind";
import { stepWith } from "../engine/step";
import type {
  Accepted,
  BaseEvent,
  Content,
  Ctx,
  Effect,
  Id,
  OfferEntry,
  OfferState,
  PlayerView,
  Rejection,
  RejectionCode,
  RequirementResult,
  StepResult,
  Terms, ForeignCurrency } from "../engine/types";
import { hiddenPaths, viewWith } from "../engine/view";
import { registry } from "../kinds";
import { replayTo } from "../sweep/crossing.journey";
import { legalCommands } from "../testing/legal";
import type { Game, Loose } from "../testing/play";
import { start } from "../testing/play";
import type { OfferEvent } from "./offer.events";

const ADA: Id<"scenario"> = "scenario.ada";
const TUNDE: Id<"scenario"> = "scenario.tunde";
const STANDING: Id<"quality"> = "quality.standing";
const WELLBEING: Id<"quality"> = "quality.wellbeing";
const tuning = content.tuning.offer;

// ---------------------------------------------------------------------------
// Content variants: the real content with some offers changed, so a test can
// make a roll certain or a fraud sure. Every other number is the real one.
// ---------------------------------------------------------------------------

function entryOf(source: Content, id: Id<"offer">): OfferEntry {
  const entry = source.offer[id];
  if (entry === undefined) throw new Error(`No ${id} in content.`);
  return entry;
}

/** The real content with the named offers changed and, when `onlyThese`, every other offer never rolled. */
function variant(changes: Partial<Record<Id<"offer">, Partial<OfferEntry>>>, onlyThese = false): Content {
  const copy = JSON.parse(JSON.stringify(content)) as Content;
  for (const entry of Object.values(copy.offer)) {
    const change = changes[entry.id];
    if (change !== undefined) Object.assign(entry, change);
    else if (onlyThese) entry.chanceBp = 0;
  }
  return copy;
}

/** Ids of the rolled entries (chance above zero) in the real content. */
const rolled = Object.values(content.offer).filter((entry) => entry.chanceBp > 0);

// ---------------------------------------------------------------------------
// A game on a test registry: the route kind is still a stub, so its
// requirements can be set to hold, and `route/depart` carries out effects.
// ---------------------------------------------------------------------------

interface Lab {
  game: Game;
  kinds: Registry;
  send(loose: Loose): StepResult;
  accept(loose: Loose): Accepted;
  reject(loose: Loose, code: RejectionCode): Rejection;
  end(): Accepted;
  apply(effects: Effect[], terms?: Terms): Accepted;
  open(offer: Id<"offer">, terms?: Terms): OfferState | undefined;
  view(): PlayerView;
}

function lab(options: { scenario?: Id<"scenario">; content?: Content; seed?: string; routeHolds?: boolean; from?: Game } = {}): Lab {
  const used = options.content ?? content;
  const game = options.from ?? start({ scenario: options.scenario ?? ADA, content: used, seed: options.seed ?? "seed-1" });
  let pending: { effects: Effect[]; terms: Terms } = { effects: [], terms: {} };
  const holds = (): RequirementResult => ({ met: true });
  const kinds: Registry = registry().map((kind) =>
    kind.kind !== "route"
      ? kind
      : {
          ...kind,
          commands: {
            ...kind.commands,
            "route/depart": (ctx: Ctx): BaseEvent[] => ctx.apply(pending.effects, { source: "test", param: null, terms: pending.terms }),
          },
          ...(options.routeHolds === true ? { requirements: { ...kind.requirements, "route/deposit": holds, "route/state": holds } } : {}),
        },
  );
  const send = (loose: Loose): StepResult => {
    const result = stepWith(kinds, game.state, { ...loose, basedOn: game.state.v }, game.world(), used);
    if (result.ok) {
      game.state = result.state;
      if (loose.type === "turn/end") game.tick += 1;
    }
    return result;
  };
  const accept = (loose: Loose): Accepted => {
    const result = send(loose);
    if (!result.ok) throw new Error(`${loose.type} was rejected with ${result.code}: ${result.detail}`);
    return result;
  };
  const subject: Lab = {
    game,
    kinds,
    send,
    accept,
    reject(loose, code) {
      const before = game.state;
      const result = send(loose);
      if (result.ok) throw new Error(`${loose.type} was accepted; expected ${code}.`);
      expect(result.code).toBe(code);
      expect(game.state).toBe(before);
      return result;
    },
    end: () => accept({ type: "turn/end", slots: [] }),
    apply(effects, terms = {}) {
      pending = { effects, terms };
      return accept({ type: "route/depart", route: "route.uk-masters" });
    },
    open(offer, terms = {}) {
      const result = subject.apply([{ type: "offer/open", offer }], terms);
      return opened(result)[0];
    },
    view: () => viewWith(kinds, { state: game.state, world: game.world(), content: used }),
  };
  return subject;
}

function own<T extends OfferEvent["type"]>(result: { events: BaseEvent[] }, type: T): Extract<OfferEvent, { type: T }>[] {
  return result.events.filter((event): event is Extract<OfferEvent, { type: T }> => event.type === type);
}

function opened(result: { events: BaseEvent[] }): OfferState[] {
  return own(result, "offer/opened").map((event) => event.item);
}

function openEntries(subject: Lab): Id<"offer">[] {
  return Object.values(subject.game.state.offer.items).map((item) => item.entry);
}

function setNaira(subject: Lab, bank: number, cash = 0): void {
  const pocket = subject.game.state.wallet.pockets.NGN;
  const effects: Effect[] = [];
  const change = (where: "bank" | "cash", now: number, want: number) => {
    if (now > want) effects.push({ type: "money/take", currency: "NGN", pocket: where, amount: now - want, reason: "mishap" });
    if (now < want) effects.push({ type: "money/add", currency: "NGN", pocket: where, amount: want - now, reason: "gift" });
  };
  change("bank", pocket.bank, bank);
  change("cash", pocket.cash, cash);
  if (effects.length > 0) subject.apply(effects);
}

function qualityChanges(result: { events: BaseEvent[] }, source: string): [string, number][] {
  return result.events
    .filter((event) => event.type === "quality/changed" && (event as unknown as { source: string }).source === source)
    .map((event) => {
      const change = event as unknown as { quality: string; amount: number };
      return [change.quality, change.amount];
    });
}

const CERTAIN = 10000;

describe("coming up", () => {
  test("[R-OFFER-001] given every rolled offer certain and holding, when a month comes up, then money opens first in id order, and only the monthly limit", () => {
    const always = variant(Object.fromEntries(rolled.map((entry) => [entry.id, { chanceBp: CERTAIN, when: [] }])));
    const subject = lab({ content: always });
    const first = subject.end();
    const money = rolled.filter((entry) => entry.group === "money").map((entry) => entry.id).sort();
    expect(tuning.maxNewPerMonth).toBe(2);
    expect(opened(first).map((item) => item.entry)).toEqual(money.slice(0, tuning.maxNewPerMonth));
    const second = subject.end();
    expect(opened(second).map((item) => item.entry)).toEqual(money.slice(2, 4));
  });

  test("[R-OFFER-001] given only life and family offers certain, when a month comes up, then life comes before family, and family in id order", () => {
    const subject = lab({
      scenario: TUNDE,
      content: variant(
        {
          "offer.harvest": { chanceBp: CERTAIN },
          "offer.aso-ebi": { chanceBp: CERTAIN },
          "offer.fuel-scarcity": { chanceBp: CERTAIN },
        },
        true,
      ),
    });
    expect(opened(subject.end()).map((item) => item.entry)).toEqual(["offer.fuel-scarcity", "offer.aso-ebi"]);
  });

  test("[R-OFFER-001] given one fewer open than the most allowed, when two certain offers come up, then one opens; at the most allowed, none is rolled", () => {
    const long = { expiresAfter: 6 };
    const certain = variant(
      {
        "offer.nepa-bill": long,
        "offer.brother-fees": long,
        "offer.mum-shop": long,
        "offer.harvest": long,
        "offer.fuel-scarcity": { chanceBp: CERTAIN },
        "offer.laptop-fault": { chanceBp: CERTAIN },
      },
      true,
    );
    const below = lab({ content: certain });
    for (const id of ["offer.nepa-bill", "offer.brother-fees", "offer.mum-shop"] as const) below.open(id);
    expect(tuning.maxOpen).toBe(4);
    expect(opened(below.end()).map((item) => item.entry)).toEqual(["offer.fuel-scarcity"]);

    const full = lab({ content: certain });
    for (const id of ["offer.nepa-bill", "offer.brother-fees", "offer.mum-shop", "offer.harvest"] as const) full.open(id);
    const draws = full.game.state.draws.offer ?? 0;
    expect(opened(full.end())).toEqual([]);
    expect(full.game.state.draws.offer ?? 0).toBe(draws);
  });

  test("[R-OFFER-001] given a certain offer whose conditions do not hold, when months come up, then it never opens and no draw is made for it", () => {
    const subject = lab({ content: variant({ "offer.recruiter-message": { chanceBp: CERTAIN } }, true) });
    for (let month = 0; month < 3; month += 1) expect(opened(subject.end())).toEqual([]);
    expect(subject.game.state.draws.offer ?? 0).toBe(0);
  });

  test("[R-OFFER-001] given a certain offer that is still open, when the next month comes up, then a second one does not open", () => {
    const subject = lab({ content: variant({ "offer.fuel-scarcity": { chanceBp: CERTAIN, expiresAfter: 3, cooldown: 0 } }, true) });
    expect(opened(subject.end())).toHaveLength(1);
    expect(opened(subject.end())).toEqual([]);
    expect(openEntries(subject)).toEqual(["offer.fuel-scarcity"]);
  });

  test("[R-OFFER-001] given a cooldown of 3, when the offer opened in month 1, then it does not come up in months 2 and 3, and does in month 4", () => {
    const subject = lab({ content: variant({ "offer.fuel-scarcity": { chanceBp: CERTAIN, cooldown: 3, expiresAfter: 1 } }, true) });
    const months = [1, 2, 3, 4].map(() => opened(subject.end()).length);
    expect(months).toEqual([1, 0, 0, 1]);
    expect(subject.game.state.offer.lastOpened["offer.fuel-scarcity"]).toBe(4);
  });

  test("[R-OFFER-001] given a limit of two times, when the offer keeps coming up, then it opens twice and never again", () => {
    const subject = lab({ content: variant({ "offer.fuel-scarcity": { chanceBp: CERTAIN, cooldown: 0, expiresAfter: 1, maxTimes: 2 } }, true) });
    const months = [1, 2, 3, 4].map(() => opened(subject.end()).length);
    expect(months).toEqual([1, 1, 0, 0]);
    expect(subject.game.state.offer.timesOpened["offer.fuel-scarcity"]).toBe(2);
  });

  test("[R-OFFER-001] given offers with no chance whose conditions hold, when months come up, then they never open", () => {
    const subject = lab({ content: variant({ "offer.salary-loan": { chanceBp: 0, when: [] } }, true) });
    for (let month = 0; month < 4; month += 1) expect(opened(subject.end())).toEqual([]);
    expect(subject.game.state.draws.offer ?? 0).toBe(0);
  });

  test("[R-OFFER-001] given one holding offer with a small chance, when a month comes up, then exactly one draw is made on the offer stream", () => {
    const subject = lab({ content: variant({ "offer.fuel-scarcity": { chanceBp: 1 } }, true) });
    subject.end();
    expect(subject.game.state.draws.offer).toBe(1);
  });
});

describe("opening", () => {
  test("[R-OFFER-002] given a range term, when the offer opens, then it is one draw in whole steps between its ends, each end reachable", () => {
    const spec = entryOf(content, "offer.quick-loan").terms.max;
    if (typeof spec !== "object" || spec.from !== "range") throw new Error("The quick loan's max is a range.");
    const easy = variant({ "offer.quick-loan": { when: [] } });
    const seen = new Set<number>();
    for (let seed = 0; seed < 60; seed += 1) {
      const subject = lab({ content: easy, seed: `range-${String(seed)}` });
      const item = subject.open("offer.quick-loan")!;
      const value = item.terms.max as number;
      expect((value - spec.min) % spec.step).toBe(0);
      expect(value).toBeGreaterThanOrEqual(spec.min);
      expect(value).toBeLessThanOrEqual(spec.max);
      expect(item.terms.min).toBe(entryOf(content, "offer.quick-loan").terms.min);
      seen.add(value);
    }
    expect(seen.has(spec.min)).toBe(true);
    expect(seen.has(spec.max)).toBe(true);
  });

  test("[R-OFFER-002] given a quality term, when the offer opens, then it is the quality times its figure", () => {
    const subject = lab();
    const means = subject.game.state.quality["quality.family-means"]!;
    const item = subject.open("offer.family-pledge")!;
    expect(item.terms).toEqual({ show: means * 30000000, gift: means * 6000000 });
  });

  test("[R-OFFER-002] given a pay term, when the offer opens, then it is the monthly pay of the job held times its figure, up to its cap", () => {
    const tunde = lab({ scenario: TUNDE });
    const pay = content.activity["activity.job-bank-officer"]!.pay!.amount as number;
    expect(tunde.open("offer.salary-loan")!.terms.max).toBe(4 * pay);

    const senior = lab({ scenario: TUNDE });
    senior.apply([{ type: "activity/start-job", job: "activity.job-mid-dev" }]);
    const midPay = content.activity["activity.job-mid-dev"]!.pay!.amount as number;
    expect(4 * midPay).toBeGreaterThan(300000000);
    expect(senior.open("offer.salary-loan")!.terms.max).toBe(300000000);
  });

  test("[R-OFFER-002] given a job paid in dollars, when a pay term is fixed, then the pay is valued in naira at the official rate", () => {
    const wide = variant({ "offer.salary-loan": { terms: { min: 10000000, max: { from: "pay", times: 4, cap: 100000000000 } } } });
    const subject = lab({ scenario: TUNDE, content: wide });
    subject.apply([{ type: "activity/start-job", job: "activity.job-remote-dev" }]);
    const pay = content.activity["activity.job-remote-dev"]!.pay!;
    expect(pay.currency).toBe("USD");
    const rates = subject.game.world().rates;
    const official = Object.fromEntries(Object.entries(rates).map(([key, rate]) => [key, rate.official])) as Record<ForeignCurrency, number>;
    const naira = valueInKobo(pay.amount as number, "USD", official);
    expect(subject.open("offer.salary-loan")!.terms.max).toBe(4 * naira);
  });

  test("[R-OFFER-002] given a job held whose pay reads a salary no route has recorded, when a pay term is fixed, then the job pays nothing and the term is zero", () => {
    const subject = lab({ scenario: TUNDE, content: variant({ "offer.salary-loan": { when: [] } }) });
    subject.apply([{ type: "activity/start-job", job: "activity.job-gulf-cleaner" }]);
    expect(content.activity["activity.job-gulf-cleaner"]!.pay!.amount).toMatchObject({ term: "salary" });
    expect(subject.open("offer.salary-loan")!.terms.max).toBe(0);
  });

  test("[R-OFFER-002] given a sponsor's job abroad paid a year, when a pay term is fixed, then it is the month's pay from the recorded salary, valued in naira at the official rate", () => {
    const abroad = replayTo("tunde-abroad", content, (game) => content.activity[game.state.activity.job ?? "activity.rest"]?.where === "abroad");
    // The bonus is a home offer; placed anywhere here so the term is fixed on a job paid a year.
    const subject = lab({ from: abroad, content: variant({ "offer.december-bonus": { when: [], where: "any" } }) });
    const sponsor = subject.game.state.route["route.uk-skilled"]?.gate;
    if (sponsor?.gate !== "sponsor" || sponsor.sponsor === null) throw new Error("The recorded life flew without a sponsor.");
    const rates = subject.game.world().rates;
    const official = Object.fromEntries(Object.entries(rates).map(([key, rate]) => [key, rate.official])) as Record<ForeignCurrency, number>;
    const month = valueInKobo(divFloor(sponsor.sponsor.salary, 12), "GBP", official);
    const cap = content.offer["offer.december-bonus"]!.terms.pay;
    if (typeof cap !== "object" || cap.from !== "pay") throw new Error("The December bonus reads no pay term.");
    expect(month).toBeLessThan(cap.cap);
    expect(subject.open("offer.december-bonus")!.terms.pay).toBe(month);
  });

  test("[R-OFFER-002] given no job, when a pay term is fixed, then it is zero", () => {
    const subject = lab({ content: variant({ "offer.salary-loan": { when: [] } }) });
    expect(subject.open("offer.salary-loan")!.terms.max).toBe(0);
  });

  test("[R-OFFER-002] given an offer opening in a month, when it opens, then its month, its expiry and the entry's record are kept", () => {
    // Tunde, so two months of upkeep leave enough for a family request to hold.
    const subject = lab({ scenario: TUNDE, content: variant({}, true) });
    subject.end();
    subject.end();
    const item = subject.open("offer.nepa-bill")!;
    expect(item).toMatchObject({ entry: "offer.nepa-bill", openedMonth: 2, expiresMonth: 2 + entryOf(content, "offer.nepa-bill").expiresAfter });
    expect(subject.game.state.offer.lastOpened["offer.nepa-bill"]).toBe(2);
    expect(subject.game.state.offer.timesOpened["offer.nepa-bill"]).toBe(1);
  });

  test("[R-OFFER-002] [R-OFFER-006] given a sure fraud or a sure honest offer, when it opens, then the hidden fraud is fixed on the fraud stream and each sign by its own chance on the offer stream", () => {
    const signs = [
      { key: "cash-only", honestBp: 0, fraudBp: CERTAIN },
      { key: "office", honestBp: CERTAIN, fraudBp: 0 },
    ];
    const fraud = lab({ routeHolds: true, content: variant({ "offer.held-funds-agent": { fraudBp: CERTAIN, signs } }) });
    const bad = fraud.open("offer.held-funds-agent")!;
    expect(bad.secret).toEqual({ fraud: true });
    expect(bad.signs).toEqual(["cash-only"]);
    expect(fraud.game.state.draws.fraud).toBe(1);
    expect(fraud.game.state.draws.offer).toBe(2);

    const honest = lab({ routeHolds: true, content: variant({ "offer.held-funds-agent": { fraudBp: 0, signs } }) });
    const good = honest.open("offer.held-funds-agent")!;
    expect(good.secret).toEqual({ fraud: false });
    expect(good.signs).toEqual(["office"]);
  });
});

describe("choosing", () => {
  test("[R-OFFER-003] given an open offer, when a choice is taken, then its effects apply with the offer as the source and the offer is removed", () => {
    const subject = lab();
    const item = subject.open("offer.nepa-bill")!;
    const bank = subject.game.state.wallet.pockets.NGN.bank;
    const result = subject.accept({ type: "offer/choose", offer: item.id, choice: "pay" });
    // A bill is paid by transfer, the bank first (decision 0012 as amended).
    expect(result.events).toContainEqual({ type: "wallet/debited", currency: "NGN", pocket: "bank", amount: 2500000, reason: "family" });
    expect(subject.game.state.wallet.pockets.NGN.bank).toBe(bank - 2500000);
    expect(qualityChanges(result, "offer.nepa-bill.pay")).toEqual([[STANDING, 3]]);
    expect(own(result, "offer/taken")).toEqual([{ type: "offer/taken", id: item.id, entry: "offer.nepa-bill", choice: "pay" }]);
    expect(subject.game.state.offer.items).toEqual({});
    expect(result.lines.find((line) => line.key === "line.offer.taken")).toMatchObject({ params: { offer: "offer.nepa-bill", choice: "pay" } });
  });

  test("[R-OFFER-003] given an offer that asks for an amount, when one between its terms is picked, then it is the term amount for the effects; each end is allowed", () => {
    for (const pick of ["min", "max"] as const) {
      const subject = lab({ scenario: TUNDE });
      const item = subject.open("offer.salary-loan")!;
      const amount = item.terms[pick] as number;
      const bank = subject.game.state.wallet.pockets.NGN.bank;
      subject.accept({ type: "offer/choose", offer: item.id, choice: "take", amount });
      const loan = Object.values(subject.game.state.obligation.items).find((owed) => owed.entry === "obligation.salary-loan");
      expect(loan).toMatchObject({ principal: amount, outstanding: amount });
      expect(subject.game.state.wallet.pockets.NGN.bank).toBe(bank + amount);
    }
  });

  test("[R-OFFER-003] given an offer that asks for an amount, when it is outside the terms, a fraction or missing, then it is rejected with bad-amount", () => {
    const subject = lab({ scenario: TUNDE });
    const item = subject.open("offer.salary-loan")!;
    const min = item.terms.min as number;
    const max = item.terms.max as number;
    for (const amount of [min - 1, max + 1, Number("150000.5")]) {
      expect(subject.reject({ type: "offer/choose", offer: item.id, choice: "take", amount }, "bad-amount").code).toBe("bad-amount");
    }
    expect(subject.reject({ type: "offer/choose", offer: item.id, choice: "take" }, "bad-amount").code).toBe("bad-amount");
  });

  test("[R-OFFER-003] given no such offer or no such choice, when one is chosen, then it is rejected with unknown-id or not-legal", () => {
    const subject = lab();
    const item = subject.open("offer.nepa-bill")!;
    expect(subject.reject({ type: "offer/choose", offer: "offer-999", choice: "pay" }, "unknown-id").code).toBe("unknown-id");
    expect(subject.reject({ type: "offer/choose", offer: item.id, choice: "dance" }, "not-legal").code).toBe("not-legal");
  });

  test("[R-OFFER-003] given an offer name that is a built-in object key, when it is chosen, then it is rejected with unknown-id and nothing throws", () => {
    const subject = lab();
    subject.open("offer.nepa-bill");
    for (const offer of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      expect(subject.reject({ type: "offer/choose", offer, choice: "pay" }, "unknown-id").code).toBe("unknown-id");
    }
  });

  test("[R-OFFER-003] given a choice whose conditions do not hold, when it is chosen, then it is rejected with not-legal", () => {
    const nepa = entryOf(content, "offer.nepa-bill");
    const strict = variant({
      "offer.nepa-bill": { choices: nepa.choices.map((choice) => (choice.id === "pay" ? { ...choice, requires: [{ type: "quality/min", quality: STANDING, value: 100 }] } : choice)) },
    });
    const subject = lab({ content: strict });
    const item = subject.open("offer.nepa-bill")!;
    expect(subject.reject({ type: "offer/choose", offer: item.id, choice: "pay" }, "not-legal").code).toBe("not-legal");
    subject.accept({ type: "offer/choose", offer: item.id, choice: "leave" });
  });

  test("[R-OFFER-003] given a debit that cannot be paid, when the choice is taken, then it is rejected with cannot-afford; exactly enough is accepted", () => {
    const short = lab();
    const item = short.open("offer.nepa-bill")!;
    setNaira(short, 2499999);
    expect(short.reject({ type: "offer/choose", offer: item.id, choice: "pay" }, "cannot-afford").code).toBe("cannot-afford");

    const exact = lab();
    const again = exact.open("offer.nepa-bill")!;
    setNaira(exact, 0, 2500000);
    exact.accept({ type: "offer/choose", offer: again.id, choice: "pay" });
    expect(exact.game.state.wallet.pockets.NGN.cash).toBe(0);
  });

  test("[R-OFFER-003] [R-WALLET-018] given an agent's fee with the naira short in cash and bank together, when the offer is taken, then it is rejected with cannot-afford; with the bank short and cash holding the rest, the fee being over the line for cash, the bank goes first and cash pays the rest", () => {
    const subject = lab({ scenario: TUNDE, routeHolds: true, content: variant({ "offer.held-funds-agent": { fraudBp: 0 } }) });
    const item = subject.open("offer.held-funds-agent")!;
    const amount = item.terms.min as number;
    const fee = bp(amount, 400);
    expect(fee).toBeGreaterThan(content.tuning.wallet.cashUpTo);
    setNaira(subject, 0, fee - 1);
    expect(subject.reject({ type: "offer/choose", offer: item.id, choice: "take", amount }, "cannot-afford").code).toBe("cannot-afford");
    setNaira(subject, fee - 1, amount + 1);
    const result = subject.accept({ type: "offer/choose", offer: item.id, choice: "take", amount });
    expect(result.events.filter((event) => event.type === "wallet/debited" && (event as { reason?: string }).reason === "fee-agent")).toEqual([
      { type: "wallet/debited", currency: "NGN", pocket: "bank", amount: fee - 1, reason: "fee-agent" },
      { type: "wallet/debited", currency: "NGN", pocket: "cash", amount: 1, reason: "fee-agent" },
    ]);
    // The fee is gone, the bank first; the funds he holds sit locked, and cash keeps the rest.
    expect(subject.game.state.wallet.pockets.NGN).toEqual({ bank: 0, cash: amount, locked: amount });
  });
});

describe("fraud", () => {
  test("[R-OFFER-004] given an agent who is a fraud, when his offer is taken, then the fee is paid and nothing else happens", () => {
    const subject = lab({ scenario: TUNDE, routeHolds: true, content: variant({ "offer.held-funds-agent": { fraudBp: CERTAIN } }) });
    const item = subject.open("offer.held-funds-agent")!;
    const amount = item.terms.min as number;
    setNaira(subject, 0, bp(amount, 400));
    const result = subject.accept({ type: "offer/choose", offer: item.id, choice: "take", amount });
    expect(result.events.filter((event) => event.type.startsWith("wallet/"))).toEqual([
      { type: "wallet/debited", currency: "NGN", pocket: "cash", amount: bp(amount, 400), reason: "fee-agent" },
    ]);
    expect(Object.values(subject.game.state.obligation.items).map((owed) => owed.entry)).toEqual(["obligation.upkeep"]);
    expect(subject.game.state.wallet.pockets.NGN.locked).toBe(0);
  });

  test("[R-OFFER-004] given an honest agent, when his offer is taken, then the fee is paid and the held funds open", () => {
    const subject = lab({ scenario: TUNDE, routeHolds: true, content: variant({ "offer.held-funds-agent": { fraudBp: 0 } }) });
    const item = subject.open("offer.held-funds-agent")!;
    const amount = item.terms.min as number;
    setNaira(subject, 0, bp(amount, 400));
    subject.accept({ type: "offer/choose", offer: item.id, choice: "take", amount });
    expect(Object.values(subject.game.state.obligation.items).map((owed) => owed.entry)).toContain("obligation.held-funds-agent");
    expect(subject.game.state.wallet.pockets.NGN).toEqual({ bank: 0, cash: 0, locked: amount });
  });
});

describe("lapsing", () => {
  test("[R-OFFER-005] given a family request, when its month comes, then its lapse choice is applied and it is removed", () => {
    const subject = lab({ content: variant({}, true) });
    const item = subject.open("offer.nepa-bill")!;
    expect(item.expiresMonth).toBe(1);
    const result = subject.end();
    expect(qualityChanges(result, "offer.nepa-bill.leave")).toEqual([
      [STANDING, -4],
      [WELLBEING, -3],
    ]);
    expect(own(result, "offer/lapsed")).toEqual([{ type: "offer/lapsed", id: item.id, entry: "offer.nepa-bill", choice: "leave" }]);
    expect(subject.game.state.offer.items).toEqual({});
  });

  test("[R-OFFER-005] given a lapse choice that cannot be paid, when the month comes, then the offer is removed and nothing is applied", () => {
    const subject = lab({ content: variant({ "offer.nepa-bill": { onExpire: "pay" } }, true) });
    const item = subject.open("offer.nepa-bill")!;
    setNaira(subject, 0);
    const result = subject.end();
    expect(own(result, "offer/lapsed")).toEqual([{ type: "offer/lapsed", id: item.id, entry: "offer.nepa-bill", choice: null }]);
    expect(qualityChanges(result, "offer.nepa-bill.pay")).toEqual([]);
  });

  test("[R-OFFER-005] given an offer that lapses after two months and names no choice, when one month passes it is still open; after two it is removed and nothing happens", () => {
    const subject = lab({ scenario: TUNDE, content: variant({}, true) });
    const item = subject.open("offer.salary-loan")!;
    expect(entryOf(content, "offer.salary-loan")).toMatchObject({ expiresAfter: 2, onExpire: null });
    subject.end();
    expect(subject.game.state.offer.items[item.id]).toBeDefined();
    const result = subject.end();
    expect(own(result, "offer/lapsed")).toEqual([{ type: "offer/lapsed", id: item.id, entry: "offer.salary-loan", choice: null }]);
    expect(subject.game.state.offer.items).toEqual({});
  });
});

describe("the view", () => {
  test("[R-OFFER-006] given a fraud offer open, when the view is read, then nothing hidden shows and its signs, terms and choices do", () => {
    const subject = lab({ scenario: TUNDE, routeHolds: true, content: variant({ "offer.held-funds-agent": { fraudBp: CERTAIN } }) });
    const item = subject.open("offer.held-funds-agent")!;
    // Enough cash for the agent's fee at the smallest amount.
    setNaira(subject, 0, 100000000);
    const view = subject.view();
    expect(hiddenPaths(view)).toEqual([]);
    expect(view.offers).toEqual([
      {
        id: item.id,
        entry: "offer.held-funds-agent",
        openedMonth: 0,
        expiresMonth: item.expiresMonth,
        terms: item.terms,
        signs: item.signs,
        choices: [
          { id: "take", allowed: true, pick: { min: item.terms.min as number, max: item.terms.max as number } },
          { id: "walk-away", allowed: true, pick: null },
        ],
      },
    ]);
  });

  test("[R-OFFER-006] given a choice that cannot be paid or an amount range that is empty, when the view is read, then that choice is not allowed", () => {
    const poor = lab();
    poor.open("offer.nepa-bill");
    setNaira(poor, 0);
    expect(poor.view().offers[0]?.choices).toEqual([
      { id: "pay", allowed: false, pick: null },
      { id: "leave", allowed: true, pick: null },
    ]);

    const jobless = lab({ content: variant({ "offer.salary-loan": { when: [] } }) });
    jobless.open("offer.salary-loan");
    expect(jobless.view().offers[0]?.choices[0]).toEqual({ id: "take", allowed: false, pick: { min: 10000000, max: 0 } });
  });
});

describe("opened by an effect", () => {
  test("[R-OFFER-007] given an offer with no chance, when an effect opens it with terms, then it opens and the terms are added to its own", () => {
    const subject = lab();
    const item = subject.open("offer.job", { job: "activity.job-teacher" })!;
    expect(item.terms).toEqual({ job: "activity.job-teacher" });
    const result = subject.accept({ type: "offer/choose", offer: item.id, choice: "accept" });
    expect(subject.game.state.activity.job).toBe("activity.job-teacher");
    expect(result.lines.find((line) => line.key === "line.offer.taken")).toBeDefined();
  });

  test("[R-OFFER-007] given conditions that do not hold, when an effect opens the offer, then nothing opens", () => {
    const subject = lab();
    expect(subject.open("offer.recruiter-message")).toBeUndefined();
    expect(subject.game.state.offer).toEqual({ items: {}, lastOpened: {}, timesOpened: {} });
  });

  test("[R-OFFER-007] given the monthly limit and a cooldown, when effects open offers, then neither stops them", () => {
    const subject = lab();
    for (const id of ["offer.nepa-bill", "offer.brother-fees", "offer.mum-shop"] as const) expect(subject.open(id)).toBeDefined();
    expect(Object.keys(subject.game.state.offer.items)).toHaveLength(3);
    const nepa = Object.values(subject.game.state.offer.items).find((item) => item.entry === "offer.nepa-bill")!;
    subject.accept({ type: "offer/choose", offer: nepa.id, choice: "leave" });
    expect(subject.open("offer.nepa-bill")).toBeDefined();
    expect(subject.game.state.offer.timesOpened["offer.nepa-bill"]).toBe(2);
  });

  test("[R-OFFER-007] given an offer that may open once, when an effect opens it again, then nothing opens", () => {
    const subject = lab();
    const item = subject.open("offer.family-pledge")!;
    subject.accept({ type: "offer/choose", offer: item.id, choice: "decline" });
    expect(subject.open("offer.family-pledge")).toBeUndefined();
    expect(subject.game.state.offer.timesOpened["offer.family-pledge"]).toBe(1);
  });

  test("[R-PEOPLE-034] given a family request open beside another offer, when offer/close names it, then it closes unanswered with its own line: no choice taken, nothing paid, the other offer and the counts untouched", () => {
    const subject = lab();
    const nepa = subject.open("offer.nepa-bill")!;
    const fees = subject.open("offer.brother-fees")!;
    const naira = subject.game.state.wallet.pockets.NGN;
    const counts = { lastOpened: subject.game.state.offer.lastOpened, timesOpened: subject.game.state.offer.timesOpened };
    const result = subject.apply([{ type: "offer/close", offer: "offer.nepa-bill" }]);
    expect(own(result, "offer/closed")).toEqual([{ type: "offer/closed", id: nepa.id, entry: "offer.nepa-bill" }]);
    expect(result.events.filter((event) => event.type === "offer/taken" || event.type === "offer/lapsed" || event.type.startsWith("wallet/"))).toEqual([]);
    expect(result.lines).toContainEqual({ key: "line.offer.closed", params: { offer: "offer.nepa-bill" }, tone: "plain", attention: false, counts: [] });
    expect(text["line.offer.closed"]).toContain("{offer}");
    expect(subject.game.state.offer.items[nepa.id]).toBeUndefined();
    expect(subject.game.state.offer.items[fees.id]).toBeDefined();
    expect(subject.game.state.wallet.pockets.NGN).toEqual(naira);
    expect({ lastOpened: subject.game.state.offer.lastOpened, timesOpened: subject.game.state.offer.timesOpened }).toEqual(counts);
  });

  test("[R-PEOPLE-034] given the named offer not open, when offer/close is applied, then nothing happens", () => {
    const subject = lab();
    const fees = subject.open("offer.brother-fees")!;
    const before = subject.game.state.offer;
    const result = subject.apply([{ type: "offer/close", offer: "offer.nepa-bill" }]);
    expect(result.events.filter((event) => event.type.startsWith("offer/"))).toEqual([]);
    expect(result.lines.filter((line) => line.key.startsWith("line.offer."))).toEqual([]);
    expect(subject.game.state.offer).toEqual(before);
    expect(subject.game.state.offer.items[fees.id]).toBeDefined();
  });

  test("[R-OFFER-007] given an offer already open, when an effect opens it again, then the waiting one closes unanswered and the new one opens with its own terms", () => {
    const subject = lab();
    const first = subject.open("offer.job", { job: "activity.job-teacher" })!;
    const result = subject.apply([{ type: "offer/open", offer: "offer.job" }], { job: "activity.job-customer-service" });
    const second = opened(result)[0]!;
    expect(own(result, "offer/replaced")).toEqual([{ type: "offer/replaced", id: first.id, entry: "offer.job" }]);
    expect(second.id).not.toBe(first.id);
    expect(second.terms).toEqual({ job: "activity.job-customer-service" });
    expect(openEntries(subject)).toEqual(["offer.job"]);
    expect(subject.game.state.offer.items[first.id]).toBeUndefined();
    expect(subject.game.state.offer.timesOpened["offer.job"]).toBe(2);
    expect(result.lines.map((line) => line.key)).toEqual(["line.offer.replaced", "line.offer.opened"]);
    expect(subject.game.state.activity.job).toBeNull();
  });

  test("[R-OFFER-007] given an offer with a lapse choice already open, when an effect opens it again, then the lapse choice's effects are not applied", () => {
    const subject = lab();
    expect(entryOf(content, "offer.nepa-bill").onExpire).toBe("leave");
    subject.open("offer.nepa-bill");
    const before = { quality: subject.game.state.quality, wallet: subject.game.state.wallet };
    const result = subject.apply([{ type: "offer/open", offer: "offer.nepa-bill" }]);
    expect(own(result, "offer/lapsed")).toEqual([]);
    expect(own(result, "offer/replaced")).toHaveLength(1);
    expect(subject.game.state.quality).toEqual(before.quality);
    expect(subject.game.state.wallet).toEqual(before.wallet);
    expect(openEntries(subject)).toEqual(["offer.nepa-bill"]);
  });

  test("[R-OFFER-007] given a job hunt that lands, when the month resolves, then a job offer opens naming the job, and accepting it starts the job", () => {
    const subject = lab({ content: variant({}, true) });
    const hunt = { activity: "activity.job-hunt" as const, param: "activity.job-customer-service" };
    let item: OfferState | undefined;
    for (let month = 0; month < 20 && item === undefined; month += 1) {
      // the hunt is applied for at once and the employer answers as the month ends.
      subject.accept({ type: "activity/now", ...hunt });
      item = opened(subject.accept({ type: "turn/end", slots: [] }))[0];
    }
    expect(item).toMatchObject({ entry: "offer.job", terms: { job: "activity.job-customer-service" } });
    subject.accept({ type: "offer/choose", offer: item!.id, choice: "accept" });
    expect(subject.game.state.activity.job).toBe("activity.job-customer-service");
  });
});

describe("a hunt that lands while a job offer waits", () => {
  test("[R-OFFER-007] [R-ACTIVITY-005] given a job offer waiting, when a later hunt lands another job, then the later job offer is the one on the table", () => {
    const sure = (id: Id<"activity">) => ({ ...content.activity[id]!, hireBp: 10000 });
    const certain: Content = {
      ...content,
      activity: { ...content.activity, "activity.job-teacher": sure("activity.job-teacher"), "activity.job-customer-service": sure("activity.job-customer-service") },
      tuning: { ...content.tuning, quality: { ...content.tuning.quality, hireMaxBp: 10000 } },
    };
    const subject = lab({ content: certain });
    // each hunt is applied for at once and answered as its month ends.
    subject.accept({ type: "activity/now", activity: "activity.job-hunt", param: "activity.job-teacher" });
    const first = opened(subject.accept({ type: "turn/end", slots: [] }))[0]!;
    expect(first.terms).toEqual({ job: "activity.job-teacher" });
    subject.accept({ type: "activity/now", activity: "activity.job-hunt", param: "activity.job-customer-service" });
    const month = subject.accept({ type: "turn/end", slots: [] });
    expect(own(month, "offer/replaced").map((event) => event.id)).toEqual([first.id]);
    const waiting = subject.view().offers.filter((offer) => offer.entry === "offer.job");
    expect(waiting.map((offer) => offer.terms.job)).toEqual(["activity.job-customer-service"]);
    subject.accept({ type: "offer/choose", offer: waiting[0]!.id, choice: "accept" });
    expect(subject.game.state.activity.job).toBe("activity.job-customer-service");
  });
});

describe("lines and invariants", () => {
  test("[R-OFFER-002] [R-OFFER-005] given each line, when it is shown, then it has words; an opened offer calls for attention and names its entry", () => {
    const keys = ["opened", "taken", "lapsed"].map((what) => `line.offer.${what}`);
    expect(keys.filter((key) => (text[key] ?? "").trim() === "")).toEqual([]);
    const subject = lab({ content: variant({ "offer.fuel-scarcity": { chanceBp: CERTAIN } }, true) });
    const result = subject.end();
    expect(result.lines.find((line) => line.key === "line.offer.opened")).toEqual({
      key: "line.offer.opened",
      params: { offer: "offer.fuel-scarcity" },
      tone: "plain",
      attention: true,
      counts: [],
    });
    const lapsed = subject.end();
    expect(lapsed.lines.find((line) => line.key === "line.offer.lapsed")).toMatchObject({ params: { offer: "offer.fuel-scarcity", choice: "trek" } });
  });

  test.prop([fc.constantFrom<Id<"scenario">>("scenario.ada", "scenario.tunde", "scenario.zainab"), fc.string({ minLength: 1, maxLength: 6 }), fc.array(fc.nat(), { minLength: 40, maxLength: 40 })], {
    numRuns: 20,
  })("[R-OFFER-003] [R-OFFER-006] given offers coming up often, when random legal commands are played, then each is accepted, the invariants hold and nothing hidden shows", (scenario, seed, picks) => {
    const often = variant(Object.fromEntries(rolled.map((entry) => [entry.id, { chanceBp: 5000 }])));
    const subject = lab({ scenario, seed, content: often, routeHolds: true });
    for (const pick of picks) {
      const view = subject.view();
      const legal = legalCommands(view);
      if (legal.length === 0) break;
      const command = legal[pick % legal.length]!;
      const result = subject.send(command);
      if (!result.ok) throw new Error(`${command.type} from the legal list was rejected with ${result.code}: ${result.detail}`);
      expect(checkInvariantsWith(subject.kinds, subject.game.state, often)).toEqual([]);
      expect(hiddenPaths(subject.view())).toEqual([]);
    }
  });
});
