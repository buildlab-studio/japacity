// From docs/rules/advice.md: the four ways to look into a route and the
// agents. The official page is `activity.look-into-route`; the friend, the
// adviser and the two ways to an agent are here, with the agents' offers and
// the chaser a friend puts the player onto (R-ADVICE-013).
// Joined into the activity and offer tables in index.ts.
import type { ActivityEntry, Id, OfferChoice, OfferEntry, Requirement } from "@japacity/sim";

import { routeTable } from "../route/route.data";
import { tuning } from "../tuning/tuning.data";

const FRIEND: Id<"activity"> = "activity.ask-someone-who-went";
const ADVISER: Id<"activity"> = "activity.see-adviser";
const TO_STOP: Id<"activity"> = "activity.see-agent-stop";
const TO_OFFICE: Id<"activity"> = "activity.see-agent-office";
const AT_STOP: Id<"offer"> = "offer.agent-stop";
const AT_OFFICE: Id<"offer"> = "offer.agent-office";
const PROMISE: Id<"offer"> = "offer.agent-promise";
const PAPERS: Id<"offer"> = "offer.agent-papers";
const CHASER: Id<"offer"> = "offer.agent-chaser";

/** R-ADVICE-013: the papers a chaser follows up. The simulation's CHASED holds the same. */
const CHASED_PAPERS: Id<"document">[] = ["document.transcript", "document.police-certificate", "document.tb-certificate"];

const ALL_BOND_STAGES = ["connected", "courting", "partner", "married"] as const;
const NETWORK: Requirement = { type: "quality/min", quality: "quality.network", value: tuning.advice.networkToAsk };

/**
 * R-ADVICE-003: the relationship that lets the player ask someone who went: a
 * bond at courting or later with a person abroad, or the network. A recurring
 * person met in a place is not recorded in the simulation, so it cannot count.
 */
const KNOWS_ONE_WHO_WENT: Requirement = {
  type: "any",
  of: [{ type: "people/bond", role: "partner", stages: ["courting", "partner", "married"], where: "abroad" }, NETWORK],
};

/** R-ADVICE-006: someone the player knows, to check an agent's name with: a bond, or the network. */
const KNOWS_SOMEONE: Requirement = {
  type: "any",
  of: [
    { type: "people/bond", role: "partner", stages: [...ALL_BOND_STAGES] },
    { type: "people/bond", role: "sibling", stages: [...ALL_BOND_STAGES] },
    NETWORK,
  ],
};

/** R-ADVICE-012: no agent before the first chapter is done. */
const FIRST_CHAPTER_DONE: Requirement = { type: "chapter/done", chapter: "chapter.find-your-feet" };

/** A route heard of or known, the road never (R-ROAD-001). */
const SOME_ROUTE_IN_VIEW: Requirement = {
  type: "any",
  of: Object.values(routeTable)
    .filter((route) => route.gate !== "road")
    .map((route): Requirement => ({ type: "route/state", route: route.id, in: ["heard", "known"] })),
};

/** R-ADVICE-007: an agent appears by the place, the chapter and the routes, never by money. */
const AGENT_WHEN: Requirement[] = [{ type: "place/is", where: "home" }, FIRST_CHAPTER_DONE, SOME_ROUTE_IN_VIEW];

/** R-ADVICE-013, R-LUCK-001: a friend's chaser comes up by the place, the chapter and a paper she follows up being made, never by money. */
const CHASER_WHEN: Requirement[] = [
  { type: "place/is", where: "home" },
  FIRST_CHAPTER_DONE,
  { type: "any", of: CHASED_PAPERS.map((document): Requirement => ({ type: "document/pending", document })) },
];

// ---------------------------------------------------------------------------
// The activities
// ---------------------------------------------------------------------------

function free(id: Id<"activity">, requires: Requirement[], param: ActivityEntry["param"], effects: ActivityEntry["effects"]): ActivityEntry {
  return { id, slot: "free", requires, param, cost: [], pay: null, hireBp: null, effects, counts: [] };
}

export const adviceActivityTable: Record<Id<"activity">, ActivityEntry> = {
  // R-ADVICE-003: free and no slot; the word of a friend rides with the month.
  [FRIEND]: { ...free(FRIEND, [KNOWS_ONE_WHO_WENT], "route", [{ type: "route/look-into" }]), slot: "none" },
  // R-ADVICE-004: the fee is the activity kind's, from the tuning, paid from cash; the reading and the looks are its too.
  [ADVISER]: free(ADVISER, [SOME_ROUTE_IN_VIEW], null, []),
  // R-ADVICE-005, 010: going to the stop or up to the office brings the agent there to the table, about the route named.
  [TO_STOP]: free(TO_STOP, [FIRST_CHAPTER_DONE], "route", [{ type: "offer/open", offer: AT_STOP }]),
  [TO_OFFICE]: free(TO_OFFICE, [FIRST_CHAPTER_DONE], "route", [{ type: "offer/open", offer: AT_OFFICE }]),
};

// ---------------------------------------------------------------------------
// The agents
// ---------------------------------------------------------------------------

const BP_WHOLE = 10000;

/**
 * R-ADVICE-006: every tell, in the order a careful player meets them. A tell
 * a fixer carries has `honestBp` 10000, one a scammer carries `fraudBp`
 * 10000; an overpromiser carries the fixer's and the first of the scammer's
 * after it.
 */
function tells(fixer: readonly string[], scammer: readonly string[]): OfferEntry["signs"] {
  const order = ["cash-only", "guarantee", "no-office", "no-licence", "holds-passport", "no-passport", "pay-today", "price-low"];
  return order.map((key) => ({ key, honestBp: fixer.includes(key) ? BP_WHOLE : 0, fraudBp: scammer.includes(key) ? BP_WHOLE : 0 }));
}

const TAKE: OfferChoice = {
  id: "take",
  requires: [],
  pick: null,
  effects: [
    { type: "money/take", currency: "NGN", pocket: "any", amount: { term: "fee" }, reason: "fee-agent" },
    { type: "route/look-into" },
  ],
  // R-ADVICE-005: a scammer gives nothing for the fee, and has papers to sell.
  fraudEffects: [
    { type: "money/take", currency: "NGN", pocket: "any", amount: { term: "fee" }, reason: "fee-agent" },
    { type: "offer/open", offer: PAPERS },
  ],
};

const DECLINE: OfferChoice = { id: "decline", requires: [], pick: null, effects: [], fraudEffects: null };

/** R-ADVICE-013: paying the friend's chaser. She comes about a paper, not a route, and is never a scam. */
const CHASE: OfferChoice = {
  id: "take",
  requires: [],
  pick: null,
  effects: [{ type: "money/take", currency: "NGN", pocket: "any", amount: { term: "fee" }, reason: "fee-agent" }],
  fraudEffects: null,
};

/** R-ADVICE-006: the three free looks. They change nothing but what the sheet shows. */
function looks(): OfferChoice[] {
  const look = (id: string, requires: Requirement[]): OfferChoice => ({ id, requires, pick: null, effects: [], fraudEffects: null });
  return [look("look-office", []), look("look-licence", []), look("look-name", [KNOWS_SOMEONE])];
}

function agent(id: Id<"offer">, who: OfferEntry["terms"][string], fraudBp: number, signs: OfferEntry["signs"]): OfferEntry {
  return {
    id,
    group: "money",
    where: "home",
    when: AGENT_WHEN,
    // Opened by going to him, never rolled.
    chanceBp: 0,
    cooldown: 0,
    maxTimes: null,
    expiresAfter: 1,
    // The fee is drawn by the kind when he opens (R-ADVICE-005); zero stands for it here.
    terms: { fee: 0, who },
    fraudBp,
    signs,
    choices: [TAKE, ...looks(), DECLINE],
    onExpire: "decline",
  };
}

/** The fake papers a scammer sells: papers a route asks for that he can make (R-ADVICE-008). */
const FAKEABLE: Id<"document">[] = ["document.transcript", "document.tb-certificate", "document.medical"];

function fake(document: Id<"document">): OfferChoice {
  return {
    id: document.slice("document.".length),
    requires: [{ type: "document/absent", document }],
    pick: null,
    effects: [
      { type: "money/take", currency: "NGN", pocket: "any", amount: { term: "fee" }, reason: "fee-agent" },
      { type: "document/grant", document },
    ],
    fraudEffects: null,
  };
}

export const adviceOfferTable: Record<Id<"offer">, OfferEntry> = {
  // R-ADVICE-010: the men at Ojuelegba's stop, any of the three kinds, one of three faces drawn each time.
  [AT_STOP]: agent(
    AT_STOP,
    { from: "range", min: 1, max: 3, step: 1 },
    tuning.advice.agentKindsBp.scammer,
    // "No passport needed, we will arrange everything" is a scammer's line: no honest way out goes without one.
    tells(["cash-only"], ["cash-only", "guarantee", "no-office", "no-licence", "holds-passport", "no-passport", "pay-today", "price-low"]),
  ),
  // R-ADVICE-010: a desk in the agent's office, which only a fixer keeps (`fraudBp` 0). He carries no tell.
  [AT_OFFICE]: agent(AT_OFFICE, 1, 0, tells([], [])),
  // R-ADVICE-013: the chaser a friend puts the player onto, about the paper of hers being made first.
  // Always a chaser, so no tell beyond the fixer's (none here).
  [CHASER]: {
    ...agent(CHASER, 1, 0, tells([], [])),
    // A friend's word is life, not money: rolled after the money offers, so it never takes their places.
    group: "life",
    when: CHASER_WHEN,
    // A friend's word comes up about one month in seven while a paper she follows up is
    // being made, and not again for six months. The page gives no chance.
    chanceBp: 1500,
    cooldown: 6,
    choices: [CHASE, ...looks(), DECLINE],
  },
  // R-ADVICE-005: the overpromiser's promise, which lapses in the month he named with nothing moved.
  [PROMISE]: {
    id: PROMISE,
    group: "money",
    where: "home",
    when: [],
    chanceBp: 0,
    cooldown: 0,
    maxTimes: null,
    // He names a month past the one a fixer would bring.
    expiresAfter: tuning.advice.fixerMonths + 1,
    terms: {},
    fraudBp: 0,
    signs: [],
    choices: [{ id: "wait", requires: [], pick: null, effects: [], fraudEffects: null }],
    onExpire: "wait",
  },
  // R-ADVICE-005, 008: the scammer's papers, for the fake papers' fee more.
  [PAPERS]: {
    id: PAPERS,
    group: "money",
    where: "home",
    when: [],
    chanceBp: 0,
    cooldown: 0,
    maxTimes: null,
    expiresAfter: 1,
    terms: { fee: tuning.advice.fakePapersFee, fake: 1 },
    fraudBp: 0,
    signs: [],
    choices: [...FAKEABLE.map(fake), DECLINE],
    onExpire: "decline",
  },
};
