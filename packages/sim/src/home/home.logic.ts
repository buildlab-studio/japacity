// Home: where the character lives in Lagos (docs/rules/home.md). The family house, a room on the
// lagoon in Makoko that costs far less until a month the settlement is cleared (then someone takes
// the character in, or the family does), or a room in a compound in Ojuelegba, its year's rent paid
// upfront the Lagos way (R-HOME-010). Nothing here moves money between lives (R-PEOPLE-004).
import { check, resolveAmount } from "../engine/check";
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
  HomeMoveShut,
  Id,
  ObligationState,
  ObligationType,
  PlayerView,
  ReadCtx,
  Rejection,
  ReportLine,
  Requirement,
  RequirementResult,
  State,
  Tuning,
} from "../engine/types";
import { livingCharge } from "../obligation/obligation.logic";
import { isDown } from "../offer/offer.luck";
import type { HomeEvent } from "./home.events";

export const FAMILY_HOUSE: HomePlace = "place.family-house";
export const MAKOKO: HomePlace = "place.makoko";
export const COMPOUND: HomePlace = "place.compound-room";
const HOMES: readonly HomePlace[] = [FAMILY_HOUSE, MAKOKO, COMPOUND];
export const MAKOKO_UPKEEP: Id<"obligation"> = "obligation.upkeep-makoko";
/** R-HOME-010: the room in a compound's own upkeep, and its year's rent. */
export const COMPOUND_UPKEEP: Id<"obligation"> = "obligation.upkeep-compound";
export const COMPOUND_RENT: Id<"obligation"> = "obligation.rent-compound";
/** The upkeep a room of one's own charges in place of the family's. */
const ROOM_UPKEEP: Readonly<Partial<Record<HomePlace, Id<"obligation">>>> = { [MAKOKO]: MAKOKO_UPKEEP, [COMPOUND]: COMPOUND_UPKEEP };
const ROOM_UPKEEPS: readonly Id<"obligation">[] = [MAKOKO_UPKEEP, COMPOUND_UPKEEP];
export const TAKEN_IN: Id<"offer"> = "offer.taken-in";
export const WHERE_NEXT: Id<"offer"> = "offer.where-next";
const STANDING: Id<"quality"> = "quality.standing";
/** The cause of a move made by the command, and of the first month's rent it paid. */
export const MOVE_SOURCE = "home.move";
/** The whole of a charge, in basis points. */
const FULL = 10_000;
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

/** The family's own upkeep is open: the rooms' upkeeps are the only others at home. */
function familyUpkeepOpen(state: State, content: Content): boolean {
  return upkeepItems(state, content).some((item) => !ROOM_UPKEEPS.includes(item.entry) && (content.obligation[item.entry]?.where ?? "home") === "home");
}

/** The upkeep item charged where the character lives: the room's own, or at the family house any other at home. */
function upkeepWhereLiving(state: State, content: Content, place: HomePlace): ObligationState | undefined {
  const own = ROOM_UPKEEP[place];
  return upkeepItems(state, content).find((item) => (own === undefined ? !ROOM_UPKEEPS.includes(item.entry) && (content.obligation[item.entry]?.where ?? "home") === "home" : item.entry === own));
}

/** R-HOME-010: what moving into the room in a compound takes at once: the year's rent and the agent's and the agreement's fees on it. */
export function compoundMoveIn(home: Tuning["home"]): number {
  return home.compound.rentYear + bp(home.compound.rentYear, home.compound.feesBp);
}

/** R-HOME-008: what a move takes at once: Makoko's first month's rent, the room's year and fees, nothing for the family house. */
function takesNow(home: Tuning["home"], to: HomePlace): number {
  switch (to) {
    case "place.makoko":
      return home.makokoUpkeep;
    case "place.compound-room":
      return compoundMoveIn(home);
    case "place.family-house":
      return 0;
    default: {
      const never: never = to;
      throw new Error(`Unknown home ${String(never)}.`);
    }
  }
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
/** R-HOME-009: the support a life from sixteen sends home once abroad. */
const HOME_SUPPORT: Id<"obligation"> = "obligation.home-support";

/**
 * R-HOME-009: the starting life's charges at home, as `obligation/open` effects: a fixed life's starting obligations,
 * or for a life from sixteen, which starts owing nothing, what its home card opens for the family house
 * (R-PROLOGUE-006, 012). Only obligations of `types` are given, each at `shareBp` of its amount. The family house
 * reopens them on a move back (R-HOME-002) and on a return (R-PLACE-007), and the family's support abroad opens
 * from them (R-PLACE-002), so every life is charged the same way whichever way it started.
 */
export function homeCharges(read: ReadCtx, types: readonly ObligationType[], shareBp: number = FULL): Effect[] {
  const scenario = read.content.scenario[read.state.scenario];
  if (scenario === undefined) return [];
  // A life from sixteen owes nothing at the start, so its home card's family-house answer stands for its upkeep, and
  // `tuning.prologue.homeSupport` for the support the fixed lives list (R-HOME-009): the card cannot carry it, since
  // the card's effects open at the close, at home, where no support is sent.
  const opens: Effect[] =
    scenario.prologue === true
      ? [
          ...(read.content.prologue[HOME_CARD]?.answers.find((answer) => answer.id === FAMILY_ANSWER)?.effects ?? []),
          { type: "obligation/open", obligation: HOME_SUPPORT, amount: read.content.tuning.prologue.homeSupport },
        ]
      : scenario.obligations.map((owed): Effect => ({ type: "obligation/open", obligation: owed.obligation, amount: owed.amount }));
  return opens.flatMap((effect): Effect[] => {
    if (effect.type !== "obligation/open") return [];
    const entry = read.content.obligation[effect.obligation];
    if (entry === undefined || !types.includes(entry.type)) return [];
    if (shareBp === FULL) return [effect];
    const amount = effect.amount === undefined ? entry.amount : resolveAmount(read, effect.amount);
    return [{ type: "obligation/open", obligation: effect.obligation, amount: bp(amount, shareBp) }];
  });
}

/** The family house's own upkeep, as `obligation/open` effects at the starting life's charge (R-HOME-002, R-HOME-009). */
function familyUpkeep(read: ReadCtx): Effect[] {
  return homeCharges(read, ["upkeep"]).filter((effect) => {
    if (effect.type !== "obligation/open") return false;
    const entry = read.content.obligation[effect.obligation];
    return entry !== undefined && !ROOM_UPKEEPS.includes(entry.id) && (entry.where ?? "home") === "home";
  });
}

/** R-HOME-008: what living at a home charges a month, as the bill will take it: Makoko's rent, the room's upkeep, or the family's. */
function monthlyAt(read: ReadCtx, to: HomePlace): number {
  if (to === MAKOKO) return livingCharge(read, MAKOKO_UPKEEP, read.content.tuning.home.makokoUpkeep);
  if (to === COMPOUND) return livingCharge(read, COMPOUND_UPKEEP, read.content.tuning.home.compound.upkeep);
  return familyUpkeep(read).reduce((sum, effect) => {
    if (effect.type !== "obligation/open") return sum;
    const amount = effect.amount === undefined ? (read.content.obligation[effect.obligation]?.amount ?? 0) : resolveAmount(read, effect.amount);
    return sum + livingCharge(read, effect.obligation, amount);
  }, 0);
}

/**
 * R-HOME-002, R-HOME-008: why `home/move` to a home not lived in would be refused at home, or null when it would be
 * taken. The command and the card read the same answer.
 */
function moveShut(read: ReadCtx, to: HomePlace): HomeMoveShut | null {
  if (homeOf(read.state, read.content).moved === read.state.turn.month) return "moved";
  if (nairaHeld(read.state) < takesNow(read.content.tuning.home, to)) return "short";
  return null;
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
 * The move itself, for the command and for an answer that moves. Whatever upkeep and rent the old
 * home charged close. To Makoko: the first month's rent is taken cash first then bank, and
 * Makoko's upkeep opens at the tuning's charge. To the room in a compound (R-HOME-010): the year's
 * rent and the fees are taken at once under `rent`, the year's rent opens paid for its first year
 * (R-OBLIGATION-015), and the room's own upkeep opens. To the family house: the family's upkeep
 * reopens at the starting life's charge, the family talks, and a year's rent paid on a room is gone.
 * An open taken-in or where-next offer is settled by it, except the one being answered. `charge` is
 * false for an answer, whose own effects pay the rent so the offer shows its price and judges it
 * (R-OFFER-003). `putOut`: the move is R-HOME-011's, the rent gone bad.
 */
function moveTo(ctx: Ctx, to: HomePlace, cause: Cause, charge: boolean, putOut = false): BaseEvent[] {
  const { tuning } = ctx.content;
  const read: ReadCtx = { state: ctx.state, world: ctx.world, content: ctx.content };
  const from = homeOf(ctx.state, ctx.content).place;
  const rent = takesNow(tuning.home, to);
  const moved: HomeEvent = { type: "home/moved", from, to, month: ctx.state.turn.month, rent, ...(putOut ? { putOut: true as const } : {}) };
  const events = record(ctx, [ctx.state.prologue.open ? { ...moved, opening: true } : moved]);
  const effects: Effect[] = [
    { type: "obligation/close", obligationType: "upkeep" },
    { type: "obligation/close", obligationType: "rent" },
  ];
  if (to === COMPOUND) {
    if (charge && rent > 0) effects.push({ type: "money/take", currency: "NGN", pocket: "any", amount: rent, reason: "rent" });
    effects.push({ type: "obligation/open", obligation: COMPOUND_RENT, amount: tuning.home.compound.rentYear });
    effects.push({ type: "obligation/open", obligation: COMPOUND_UPKEEP, amount: tuning.home.compound.upkeep });
  } else if (to === MAKOKO) {
    if (charge && rent > 0) effects.push({ type: "money/take", currency: "NGN", pocket: "any", amount: rent, reason: "upkeep" });
    effects.push({ type: "obligation/open", obligation: MAKOKO_UPKEEP, amount: rent });
    // The rent paid on the move is this month's: the room's first charge, at this month's end, is already met (the
    // The prologue's room pays nothing on the move, so its
    // first month is charged as any other.
    if (rent > 0 && !ctx.state.prologue.open) effects.push({ type: "obligation/relief", obligationType: "upkeep", bp: FULL });
  } else {
    effects.push(...familyUpkeep(read));
    if (tuning.home.returnStanding !== 0) effects.push({ type: "quality/add", quality: STANDING, amount: tuning.home.returnStanding });
  }
  for (const offer of [TAKEN_IN, WHERE_NEXT]) {
    if (!cause.source.startsWith(`${offer}.`)) effects.push({ type: "offer/close", offer });
  }
  ctx.apply(effects.filter((effect) => effect.type !== "obligation/relief"), cause);
  // Its own cause, so the line it tells names the move whatever answer or command made it.
  ctx.apply(effects.filter((effect) => effect.type === "obligation/relief"), { source: MOVE_SOURCE, param: null, terms: {} });
  return events;
}

function moveCommand(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "home/move") throw new Error(`home/move cannot handle ${command.type}.`);
  if (!isHome(command.to)) return reject("unknown-id", `${String(command.to)} is no home.`);
  if (ctx.state.place.where !== "home") return reject("not-legal", "The home is in Lagos: a move is made at home.");
  const lives = homeOf(ctx.state, ctx.content);
  if (lives.place === command.to) return reject("not-legal", `The character lives at ${command.to} already.`);
  const shut = moveShut(ctx, command.to);
  if (shut === "moved") return reject("not-legal", "One move a month: the character moved this month.");
  if (shut === "short") return reject("cannot-afford", command.to === COMPOUND ? "The year's rent and the fees are not held." : "The first month's rent is not held.");
  return moveTo(ctx, command.to, { source: MOVE_SOURCE, param: null, terms: {} }, true);
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
  // R-HOME-011: a rent gone bad sends the character back to the family house, as an eviction from Makoko does. The
  // rent's default closed it (the landlord took the room back), so a room lived in with no rent open is a room lost.
  const renting = Object.values(ctx.state.obligation.items).some((item) => item.entry === COMPOUND_RENT);
  if (!renting && homeOf(ctx.state, ctx.content).place === COMPOUND) {
    return moveTo(ctx, FAMILY_HOUSE, { source: "home.put-out", param: null, terms: {} }, false, true);
  }
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
      // R-HOME-011: a rent gone bad is told with attention; a move of one's own is said quietly.
      return event.putOut === true ? [line("line.home.put-out", { place: event.to }, "bad", true)] : [line("line.home.moved", { place: event.to }, "plain", false)];
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
  if (state.place.where === "home" && home.place === FAMILY_HOUSE && upkeepItems(state, content).some((item) => ROOM_UPKEEPS.includes(item.entry))) {
    problems.push("A room's upkeep is open while the character lives at the family house.");
  }
  return problems;
}

/**
 * R-HOME-007, R-HOME-008: where the character lives, the monthly charge there as the bill takes it, the eviction
 * chance a month in Makoko now, and at home the moves the card offers, each with its charge a month and why it is shut.
 */
export function homeView(read: ReadCtx): PlayerView["home"] {
  const lives = homeOf(read.state, read.content);
  const charge = lives.place === null ? undefined : upkeepWhereLiving(read.state, read.content, lives.place);
  const atHome = read.state.place.where === "home";
  return {
    place: lives.place,
    since: lives.since,
    guest: lives.guest,
    rent: charge === undefined ? null : { currency: "NGN", amount: livingCharge(read, charge.entry, charge.amount) },
    evictionBp: evictionChanceBp(read),
    moved: lives.moved,
    moves: atHome
      ? HOMES.filter((to) => to !== lives.place).map((to) => ({
          to,
          monthly: { currency: "NGN" as const, amount: monthlyAt(read, to) },
          now: takesNow(read.content.tuning.home, to),
          shut: moveShut(read, to),
        }))
      : [],
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
