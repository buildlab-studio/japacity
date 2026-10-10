// Home: where the character lives in Lagos (docs/rules/home.md). The family house, or a room on
// the lagoon in Makoko that costs far less, until a month the settlement is cleared. Then someone
// takes the character in, or the family does. Nothing here moves money between lives (R-PEOPLE-004).
import { check } from "../engine/check";
import { bp, divFloor } from "../engine/int";
import type { RegisteredKind } from "../engine/kind";
import { emit } from "../engine/kind";
import { reject } from "../engine/reject";
import type {
  BaseEvent,
  Cause,
  Command,
  Content,
  Ctx,
  Effect,
  HomeHost,
  HomePlace,
  HomeSlice,
  Id,
  ObligationState,
  PlayerView,
  ReadCtx,
  Rejection,
  ReportLine,
  Requirement,
  RequirementResult,
  State,
} from "../engine/types";
import { isDown } from "../offer/offer.luck";
import type { HomeEvent } from "./home.events";

export const FAMILY_HOUSE: HomePlace = "place.family-house";
export const MAKOKO: HomePlace = "place.makoko";
const HOMES: readonly HomePlace[] = [FAMILY_HOUSE, MAKOKO];
export const MAKOKO_UPKEEP: Id<"obligation"> = "obligation.upkeep-makoko";
export const TAKEN_IN: Id<"offer"> = "offer.taken-in";
export const WHERE_NEXT: Id<"offer"> = "offer.where-next";
const STANDING: Id<"quality"> = "quality.standing";
/** The words keys a line names a real player by: the other life's own name is never in this state. */
export const HOME_FRIEND = "home.friend";
export const HOME_GUEST = "home.guest";
/** The bond stages a moment can be added at (R-PEOPLE-014): a friend only connected has no moments yet. */
const MOMENT_STAGES: readonly string[] = ["courting", "partner", "married"];

function record(ctx: Ctx, events: HomeEvent[]): BaseEvent[] {
  return emit(ctx, "home", events);
}

function isHome(value: unknown): value is HomePlace {
  return (HOMES as readonly unknown[]).includes(value);
}

function upkeepItems(state: State, content: Content): ObligationState[] {
  return Object.values(state.obligation.items).filter((item) => content.obligation[item.entry]?.type === "upkeep");
}

/** The family's own upkeep is open: Makoko's is the only other upkeep at home. */
function familyUpkeepOpen(state: State, content: Content): boolean {
  return upkeepItems(state, content).some((item) => item.entry !== MAKOKO_UPKEEP && (content.obligation[item.entry]?.where ?? "home") === "home");
}

/**
 * Where the character lives now. Back from abroad, the family house takes them back (R-PLACE-007
 * reopens its upkeep), whatever the slice held when they left; the slice catches up in the next
 * turn's first phase, and every reading here sees it already.
 */
export function homeOf(state: State, content: Content): HomeSlice {
  const { home } = state;
  if (state.place.where !== "home" || home.place === FAMILY_HOUSE || !familyUpkeepOpen(state, content)) return home;
  return { ...home, place: FAMILY_HOUSE, guest: null };
}

/** R-HOME-003: the eviction chance a month in Makoko now, halved while the character is down as a `bad` offer is (R-LUCK-003). */
export function evictionChanceBp(read: ReadCtx): number {
  const chance = read.content.tuning.home.evictionBp;
  return isDown(read) ? divFloor(chance, 2) : chance;
}

/** R-HOME-003: the settlement was cleared this month, so no other `bad` offer opens in it. */
export function evictedThisMonth(state: State): boolean {
  return state.home.evicted !== null && state.home.evicted === state.turn.month;
}

/** The home card that closes the life from sixteen (prologue.md, step 11), and its answer for the family house. */
const HOME_CARD = "home";
const FAMILY_ANSWER = "family-house";

/**
 * What the family house charges this life: a fixed life's starting obligations, or for a life from sixteen, which
 * starts owing nothing, the upkeep its home card opens for the family house (R-PROLOGUE-006, 012).
 */
function familyCharge(read: ReadCtx): Effect[] {
  const scenario = read.content.scenario[read.state.scenario];
  if (scenario === undefined) return [];
  if (scenario.prologue !== true) return scenario.obligations.map((owed): Effect => ({ type: "obligation/open", obligation: owed.obligation, amount: owed.amount }));
  return read.content.prologue[HOME_CARD]?.answers.find((answer) => answer.id === FAMILY_ANSWER)?.effects ?? [];
}

/** The starting life's upkeep at home, as `obligation/open` effects at its own charge (R-HOME-002, as R-PLACE-007). */
function familyUpkeep(read: ReadCtx): Effect[] {
  return familyCharge(read).filter((effect) => {
    if (effect.type !== "obligation/open") return false;
    const entry = read.content.obligation[effect.obligation];
    return entry !== undefined && entry.type === "upkeep" && entry.id !== MAKOKO_UPKEEP && (entry.where ?? "home") === "home";
  });
}

/** Naira held in cash and bank together. */
function nairaHeld(state: State): number {
  const { cash, bank } = state.wallet.pockets.NGN;
  return cash + bank;
}

// ---------------------------------------------------------------------------
// Hosts: R-HOME-004
// ---------------------------------------------------------------------------

/**
 * Who would take the character in. `friend`: a real player joined to this character whose facts
 * show them at home (R-PEOPLE-001), the first bond by id. `someone`: the first `person` entry of
 * role sibling (the content has no friend role) with a home in Lagos (in the city, not abroad)
 * whose `when` holds.
 */
export function hostFor(read: ReadCtx, host: HomeHost): string | null {
  switch (host) {
    case "friend": {
      const found = Object.entries(read.state.people.bonds)
        .filter(([, bond]) => bond.with.kind === "player" && bond.stage !== "ended" && bond.facts !== null && bond.facts.where === "home")
        .map(([id]) => id)
        .sort();
      return found[0] ?? null;
    }
    case "someone": {
      const found = Object.values(read.content.person).find(
        (person) => person.role === "sibling" && person.profile.country === null && person.profile.home === "city" && person.when.every((requirement) => check(read, requirement).met),
      );
      return found?.id ?? null;
    }
    default: {
      const never: never = host;
      throw new Error(`Unknown host ${String(never)}.`);
    }
  }
}

function judgeHost(read: ReadCtx, requirement: Requirement): RequirementResult {
  if (requirement.type !== "home/host") throw new Error(`home/host cannot judge ${requirement.type}.`);
  return { met: read.state.place.where === "home" && hostFor(read, requirement.host) !== null };
}

// ---------------------------------------------------------------------------
// Moving: R-HOME-002
// ---------------------------------------------------------------------------

/**
 * The move itself, for the command and for an answer that moves. To Makoko: the family's upkeep
 * closes, the first month's rent is taken cash first then bank, and Makoko's upkeep opens at the
 * tuning's charge. To the family house: Makoko's closes, the family's reopens at the starting
 * life's charge, and the family talks. An open taken-in or where-next offer is settled by it,
 * except the one being answered. `charge` is false for an answer, whose own effects pay the rent
 * so the offer shows its price and judges it (R-OFFER-003).
 */
function moveTo(ctx: Ctx, to: HomePlace, cause: Cause, charge: boolean): BaseEvent[] {
  const { tuning } = ctx.content;
  const read: ReadCtx = { state: ctx.state, world: ctx.world, content: ctx.content };
  const from = homeOf(ctx.state, ctx.content).place;
  const rent = to === MAKOKO ? tuning.home.makokoUpkeep : 0;
  const moved: HomeEvent = { type: "home/moved", from, to, month: ctx.state.turn.month, rent };
  const events = record(ctx, [ctx.state.prologue.open ? { ...moved, opening: true } : moved]);
  const effects: Effect[] = [{ type: "obligation/close", obligationType: "upkeep" }];
  if (to === MAKOKO) {
    if (charge && rent > 0) effects.push({ type: "money/take", currency: "NGN", pocket: "any", amount: rent, reason: "upkeep" });
    effects.push({ type: "obligation/open", obligation: MAKOKO_UPKEEP, amount: rent });
  } else {
    effects.push(...familyUpkeep(read));
    if (tuning.home.returnStanding !== 0) effects.push({ type: "quality/add", quality: STANDING, amount: tuning.home.returnStanding });
  }
  for (const offer of [TAKEN_IN, WHERE_NEXT]) {
    if (!cause.source.startsWith(`${offer}.`)) effects.push({ type: "offer/close", offer });
  }
  ctx.apply(effects, cause);
  return events;
}

function moveCommand(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "home/move") throw new Error(`home/move cannot handle ${command.type}.`);
  if (!isHome(command.to)) return reject("unknown-id", `${String(command.to)} is no home.`);
  if (ctx.state.place.where !== "home") return reject("not-legal", "The home is in Lagos: a move is made at home.");
  const lives = homeOf(ctx.state, ctx.content);
  if (lives.place === command.to) return reject("not-legal", `The character lives at ${command.to} already.`);
  if (lives.moved === ctx.state.turn.month) return reject("not-legal", "One move a month: the character moved this month.");
  if (command.to === MAKOKO && nairaHeld(ctx.state) < ctx.content.tuning.home.makokoUpkeep) {
    return reject("cannot-afford", "The first month's rent is not held.");
  }
  return moveTo(ctx, command.to, { source: "home.move", param: null, terms: {} }, true);
}

/** The move an answer makes (R-HOME-004). The answer's conditions and its debits were judged before it ran. */
function moveEffect(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "home/move") throw new Error(`home/move cannot carry out ${effect.type}.`);
  if (ctx.state.place.where !== "home" || homeOf(ctx.state, ctx.content).place === effect.place) return [];
  return moveTo(ctx, effect.place, cause, false);
}

// ---------------------------------------------------------------------------
// Taken in: R-HOME-004
// ---------------------------------------------------------------------------

function guestEffect(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "home/guest") throw new Error(`home/guest cannot carry out ${effect.type}.`);
  const read: ReadCtx = { state: ctx.state, world: ctx.world, content: ctx.content };
  const by = hostFor(read, effect.host);
  if (by === null) return [];
  const month = ctx.state.turn.month;
  const events = record(ctx, [{ type: "home/taken-in", host: effect.host, by, month, until: month + ctx.content.tuning.home.guestMonths }]);
  ctx.apply([{ type: "obligation/close", obligationType: "upkeep" }], cause);
  // A kindness, recorded as a moment with the friend where the bond keeps moments (R-PEOPLE-014).
  const bond = effect.host === "friend" ? ctx.state.people.bonds[by] : undefined;
  if (bond !== undefined && MOMENT_STAGES.includes(bond.stage)) ctx.apply([{ type: "people/moment", kind: "met" }], { ...cause, param: by });
  return events;
}

// ---------------------------------------------------------------------------
// Hosting: R-HOME-005
// ---------------------------------------------------------------------------

function hostCommand(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "home/host") throw new Error(`home/host cannot handle ${command.type}.`);
  const known = Object.values(ctx.state.people.bonds).some((bond) => bond.with.kind === "player" && bond.with.pair === command.pair);
  if (!known) return reject("unknown-id", `No joined player is on the pair ${String(command.pair)}.`);
  if (command.until !== null && (!Number.isSafeInteger(command.until) || command.until < 0)) return reject("bad-amount", "A stay ends in a month.");
  return record(ctx, [{ type: "home/hosting", pair: command.pair, until: command.until }]);
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

/** The turn's first phase: the family house took the character back on a return (R-PLACE-007), and a stay hosted has run out. */
function spend(ctx: Ctx): BaseEvent[] {
  const events: BaseEvent[] = [];
  const { home } = ctx.state;
  if (homeOf(ctx.state, ctx.content) !== home) events.push(...record(ctx, [{ type: "home/taken-back", month: ctx.state.turn.month }]));
  if (home.hosting !== null && home.hosting.until < ctx.state.turn.month) events.push(...record(ctx, [{ type: "home/hosting", pair: home.hosting.pair, until: null }]));
  return events;
}

/**
 * R-HOME-005: while a joined player's character stays, the host's upkeep is up by the tuning's
 * share of its charge, taken as the upkeep is (cash first, then bank, what is held).
 */
function due(ctx: Ctx): BaseEvent[] {
  const { hosting } = ctx.state.home;
  if (hosting === null || hosting.until < ctx.state.turn.month || ctx.state.place.where !== "home") return [];
  const upkeep = upkeepItems(ctx.state, ctx.content).find((item) => (ctx.content.obligation[item.entry]?.where ?? "home") === "home");
  if (upkeep === undefined) return [];
  const rise = bp(upkeep.amount, ctx.content.tuning.home.hostBp);
  const taken = Math.min(rise, nairaHeld(ctx.state));
  if (rise === 0) return [];
  const events = record(ctx, [{ type: "home/hosted", pair: hosting.pair, amount: rise }]);
  if (taken > 0) ctx.apply([{ type: "money/take", currency: "NGN", pocket: "any", amount: taken, reason: "upkeep" }], { source: "home.hosting", param: null, terms: {} });
  return events;
}

/**
 * The `clocks` phase. R-HOME-003: a month lived in Makoko draws on the stream `home`; on it the
 * settlement is cleared. R-HOME-004: a guest whose stay has come to its month is asked where next.
 */
function clocks(ctx: Ctx): BaseEvent[] {
  if (ctx.state.place.where !== "home") return [];
  const { home } = ctx.state;
  const month = ctx.state.turn.month;
  if (home.guest !== null && month >= home.guest.until && !Object.values(ctx.state.offer.items).some((item) => item.entry === WHERE_NEXT)) {
    const { makokoUpkeep, guestMonths } = ctx.content.tuning.home;
    ctx.apply([{ type: "offer/open", offer: WHERE_NEXT }], { source: "home.stay-ended", param: null, terms: { rent: makokoUpkeep, months: guestMonths } });
    return [];
  }
  const lives = upkeepItems(ctx.state, ctx.content).some((item) => item.entry === MAKOKO_UPKEEP);
  if (homeOf(ctx.state, ctx.content).place !== MAKOKO || !lives) return [];
  const read: ReadCtx = { state: ctx.state, world: ctx.world, content: ctx.content };
  if (!ctx.random.chance("home", evictionChanceBp(read))) return [];
  const lost = Math.min(ctx.state.wallet.pockets.NGN.cash, ctx.content.tuning.home.evictionLossNaira);
  const events = record(ctx, [{ type: "home/evicted", month, lost }]);
  const effects: Effect[] = [{ type: "obligation/close", obligationType: "upkeep" }];
  if (lost > 0) effects.push({ type: "money/take", currency: "NGN", pocket: "cash", amount: lost, reason: "mishap" });
  effects.push({ type: "offer/open", offer: TAKEN_IN });
  ctx.apply(effects, { source: "home.evicted", param: null, terms: { months: ctx.content.tuning.home.guestMonths } });
  return events;
}

// ---------------------------------------------------------------------------
// Evolve, lines, invariants, view
// ---------------------------------------------------------------------------

function evolve(slice: HomeSlice, event: HomeEvent): HomeSlice {
  switch (event.type) {
    case "home/moved":
      return { ...slice, place: event.to, since: event.month, guest: null, moved: event.opening === true ? slice.moved : event.month };
    case "home/taken-back":
      return { ...slice, place: FAMILY_HOUSE, since: event.month, guest: null };
    case "home/evicted":
      return { ...slice, place: null, since: event.month, guest: null, evicted: event.month };
    case "home/taken-in":
      return { ...slice, place: null, since: event.month, guest: { host: event.host, by: event.by, until: event.until } };
    case "home/hosting":
      return { ...slice, hosting: event.until === null ? null : { pair: event.pair, until: event.until } };
    case "home/hosted":
      return slice;
    default: {
      const never: never = event;
      throw new Error(`Unknown home event ${JSON.stringify(never)}.`);
    }
  }
}

function line(key: string, params: ReportLine["params"], tone: ReportLine["tone"], attention: boolean): ReportLine {
  return { key, params, tone, attention, counts: [] };
}

function lines(event: HomeEvent): ReportLine[] {
  switch (event.type) {
    case "home/moved":
      return [line("line.home.moved", { place: event.to }, "plain", false)];
    case "home/evicted":
      // Told straight (text.md R-TEXT-002): what went with the room is its own figure, not the wallet's; with no cash held, none is named.
      return [line(event.lost > 0 ? "line.home.evicted" : "line.home.evicted-no-cash", { lost: { currency: "NGN", amount: event.lost } }, "bad", true)];
    case "home/taken-in":
      // A friend is named by the words for one (the pair's name is the other life's), someone of the story by their entry.
      return [line("line.home.taken-in", { who: event.host === "friend" ? HOME_FRIEND : event.by, months: event.until - event.month }, "good", true)];
    case "home/hosted":
      // A host's guest is always a real player, named by the words for one.
      return [line("line.home.hosting", { who: HOME_GUEST, amount: { currency: "NGN", amount: event.amount } }, "bad", false)];
    case "home/taken-back":
    case "home/hosting":
      // The return and the authority's word are told by their own lines.
      return [];
    default: {
      const never: never = event;
      void never;
      return [];
    }
  }
}

function invariants(state: State, content: Content): string[] {
  const problems: string[] = [];
  const { home } = state;
  if (home.place !== null && !isHome(home.place)) problems.push(`The home ${String(home.place)} is no home.`);
  if (home.guest !== null && home.place !== null) problems.push("A guest lives at the host's, not at a home of their own.");
  if (state.place.where === "home" && home.place === FAMILY_HOUSE && upkeepItems(state, content).some((item) => item.entry === MAKOKO_UPKEEP)) {
    problems.push("Makoko's upkeep is open while the character lives at the family house.");
  }
  return problems;
}

/** R-HOME-007: where the character lives, the monthly charge there, and the eviction chance a month in Makoko now. */
export function homeView(read: ReadCtx): PlayerView["home"] {
  const lives = homeOf(read.state, read.content);
  const charge = lives.place === null ? undefined : upkeepItems(read.state, read.content).find((item) => (item.entry === MAKOKO_UPKEEP) === (lives.place === MAKOKO));
  return {
    place: lives.place,
    since: lives.since,
    guest: lives.guest,
    rent: charge === undefined ? null : { currency: "NGN", amount: charge.amount },
    evictionBp: evictionChanceBp(read),
    moved: lives.moved,
  };
}

export const homeKind: RegisteredKind<HomeSlice, HomeEvent> = {
  kind: "home",
  initial: () => ({ place: FAMILY_HOUSE, since: 0, guest: null, moved: null, evicted: null, hosting: null }),
  commands: { "home/move": moveCommand, "home/host": hostCommand },
  effects: { "home/move": moveEffect, "home/guest": guestEffect },
  phases: { spend, due, clocks },
  evolve,
  lines,
  invariants,
  requirements: { "home/host": judgeHost },
  view: (read) => ({ home: homeView(read) }),
};
