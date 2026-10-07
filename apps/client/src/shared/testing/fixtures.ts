// Views for screen tests. The thin ones come from the real engine and the real
// content, so they follow the kinds as they land. The rich one is built by
// hand on top of a real view, so the screens for offers, routes and the
// interview can be exercised before the kinds that fill them exist.
import { content } from "@japacity/content";
import type { Authority, Command, Id, PlayerView, Rejection, Reply } from "@japacity/sim";
import { newState, standInWorld, viewFor } from "@japacity/sim";

export const SCENARIOS = Object.keys(content.scenario) as Id<"scenario">[];

/** A new life's view, straight from the engine. */
export function engineView(scenario: Id<"scenario"> = SCENARIOS[0]!): PlayerView {
  const state = newState(scenario, "fixture-seed", content);
  return viewFor({ state, world: standInWorld("fixture-world", 0, content), content });
}

const ROUTE = "route.uk-masters" as const;

/** A life in the middle of an application: an offer letter, open offers, and the interview open. */
export function richView(): PlayerView {
  const base = engineView("scenario.tunde");
  const route = base.routes.find((entry) => entry.id === ROUTE);
  if (route === undefined) throw new Error("The content has no UK master's route.");
  const checklist = content.route[ROUTE]?.checklist ?? [];
  return {
    ...base,
    v: 12,
    month: 11,
    turns: { banked: 13, cap: base.turns.cap },
    japacity: { percent: 64, route: ROUTE },
    lastSlots: [{ activity: "activity.rest", param: null }],
    documents: [
      { id: "document.passport", state: "held", readyMonth: null, expiresMonth: 130, value: null },
      { id: "document.english-test", state: "held", readyMonth: null, expiresMonth: 35, value: 65 },
      { id: "document.transcript", state: "pending", readyMonth: 12, expiresMonth: null, value: null },
    ],
    routes: [
      {
        ...route,
        state: "known",
        percent: 64,
        window: "narrowing",
        checklist: checklist.map((item, index) => ({
          id: item.id,
          weight: item.weight,
          met: index < 5,
          have: item.partial ? 1_200_000 : null,
          need: item.partial ? 3_000_000 : null,
          earned: index < 5 ? item.weight : 0,
        })),
        schools: [
          { id: "school.northgate", state: "offer", readyMonth: 9, discount: 100_000 },
          { id: "school.ashby", state: "pending", readyMonth: 13, discount: 0 },
        ],
        school: null,
        funds: { heldMonths: 0, covered: false, shown: 1_200_000, required: 3_000_000 },
        unexplainedBp: 1200,
        refusals: 1,
        lastRefusal: { month: 6, reasons: ["funds", "history"] },
      },
    ],
    setpiece: {
      entry: "setpiece.credibility-interview",
      asked: 1,
      total: 3,
      question: { id: "who-pays", answers: ["own", "lender", "sponsor"], weak: ["sponsor"] },
    },
    offers: [
      {
        id: "offer-7",
        entry: "offer.land-buyer",
        openedMonth: 10,
        expiresMonth: 12,
        terms: { price: 900_000_000 },
        signs: [],
        choices: [
          { id: "sell", allowed: true, pick: null },
          { id: "hold", allowed: true, pick: null },
        ],
      },
      {
        id: "offer-8",
        entry: "offer.held-funds-agent",
        openedMonth: 11,
        expiresMonth: 13,
        terms: { min: 200_000_000, max: 4_000_000_000 },
        signs: ["cash-only", "my-guy"],
        choices: [
          { id: "take", allowed: true, pick: { min: 200_000_000, max: 4_000_000_000 } },
          { id: "walk-away", allowed: true, pick: null },
        ],
      },
    ],
    obligations: [
      ...base.obligations,
      {
        id: "obligation-9",
        entry: "obligation.salary-loan",
        state: "grace",
        openedMonth: 4,
        amount: 0,
        principal: 120_000_000,
        outstanding: 80_000_000,
        monthsLeft: 8,
        missed: 1,
        due: 12_400_000,
      },
    ],
    news: [
      { id: "news.uk-unis-recruit", stage: "in-force", since: 3, forYou: true },
      { id: "news.naira-float", stage: "rumour", since: 9, forYou: false },
    ],
    queued: [{ id: "queued-3", from: "NGN", to: "USD", paid: 50_000_000, readyMonth: 13 }],
    report: {
      month: 11,
      lines: [
        { key: "line.wallet.salary", params: { amount: 45_000_000 }, tone: "good", attention: false, counts: [] },
        { key: "chapter.find-your-feet.close", params: {}, tone: "plain", attention: true, counts: [] },
      ],
      japacityBefore: 58,
      japacityAfter: 64,
      attention: true,
    },
  };
}

export interface FakeAuthority extends Authority {
  sent: Command[];
  /** The next reply is this rejection, once. */
  rejectNext(rejection: Omit<Rejection, "ok">): void;
}

/** An authority that records what is sent and answers with the same view, or a rejection when told to. */
export function fakeAuthority(view: PlayerView): FakeAuthority {
  let pending: Rejection | null = null;
  const sent: Command[] = [];
  return {
    sent,
    rejectNext(rejection) {
      pending = { ok: false, ...rejection };
    },
    view: () => Promise.resolve(view),
    send(command): Promise<Reply> {
      sent.push(command);
      if (pending !== null) {
        const reply = pending;
        pending = null;
        return Promise.resolve(reply);
      }
      return Promise.resolve({ ok: true, view, lines: [] });
    },
  };
}
