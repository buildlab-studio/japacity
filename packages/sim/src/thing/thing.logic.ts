// The things a life owns at home (home.md R-HOME-013; design page 12 sections 2 and 4). The market sells a
// thing delivered at once; it stands in the home lived in when that home may hold it (the family house only the small
// things, in your corner, and the car in its carport), and while it stands it does something in life: a lift once, a
// lift each month it is lived with, and a change to acts the simulation already has. Some cost to run a month, taken at
// the close. Selling one back, or leaving Lagos, brings in its resale figure. Where a thing stands in the room, and how
// the room is arranged, is the room's own, kept beside the save, never here.
import { bp } from "../engine/int";
import type { RegisteredKind } from "../engine/kind";
import { emit, ownOf } from "../engine/kind";
import { reject } from "../engine/reject";
import type {
  BaseEvent,
  Cause,
  Command,
  Content,
  Ctx,
  Effect,
  HomePlace,
  Id,
  PlayerView,
  ReadCtx,
  Rejection,
  ReportLine,
  State,
  ThingAdd,
  ThingEntry,
  ThingShut,
  ThingsSlice,
} from "../engine/types";
import { homeOf } from "../home/home.logic";
import type { ThingsEvent } from "./thing.events";

/** The cause a purchase, a sale and the month's running are applied under: the thing itself. */
function causeOf(thing: Id<"thing">): Cause {
  return { source: thing, param: null, terms: {} };
}

function record(ctx: Ctx, events: ThingsEvent[]): BaseEvent[] {
  return emit(ctx, "things", events);
}

function addsOf(adds: readonly ThingAdd[]): Effect[] {
  return adds.filter((add) => add.amount !== 0).map((add): Effect => ({ type: "quality/add", quality: add.quality, amount: add.amount }));
}

/** Naira held in cash and bank together. */
function nairaHeld(state: State): number {
  const { cash, bank } = state.wallet.pockets.NGN;
  return cash + bank;
}

function owns(state: State, thing: Id<"thing">): boolean {
  return state.things.owned.some((owned) => owned.thing === thing);
}

/** The home the things stand in: where the character lives at home in Lagos, or null abroad, on the road, evicted or a guest. */
function livesAt(state: State, content: Content): HomePlace | null {
  if (state.place.where !== "home") return null;
  return homeOf(state, content).place;
}

/** Whether a thing may stand in a home (the family house holds only the small things, in your corner, and the car). */
function standsIn(entry: ThingEntry, home: HomePlace | null): boolean {
  return home !== null && entry.homes.includes(home);
}

/**
 * The things that work now, in catalogue order: owned, standing in the home lived in, their needs owned, and of each
 * group only the dearest that stands (two lights do not make more light).
 */
export function working(read: Pick<ReadCtx, "state" | "content">): ThingEntry[] {
  const { state, content } = read;
  if (state.things.owned.length === 0) return [];
  const home = livesAt(state, content);
  if (home === null) return [];
  const standing = Object.values(content.thing).filter((entry) => owns(state, entry.id) && standsIn(entry, home) && entry.needs.every((need) => owns(state, need)));
  return standing.filter((entry) => {
    if (entry.group === null) return true;
    const best = standing.filter((other) => other.group === entry.group).reduce((top, other) => (other.price > top.price ? other : top));
    return best.id === entry.id;
  });
}

/** What a thing takes to run a month as the close takes it: its running cost, cut by a thing that eases it (the phone and the data). */
function runningOf(read: Pick<ReadCtx, "state" | "content">, entry: ThingEntry, works: readonly ThingEntry[] = working(read)): number {
  if (entry.running === 0) return 0;
  return works.reduce((cost, other) => (other.eases?.thing === entry.id ? bp(cost, other.eases.bp) : cost), entry.running);
}

/** What a thing owned sells for: its resale share of what was paid. */
function resaleOf(entry: ThingEntry, paid: number): number {
  return bp(paid, entry.resaleBp);
}

/** Why the market would refuse a thing now, or null when it would sell it. The command and the view read one answer. */
function buyShut(read: Pick<ReadCtx, "state" | "content">, entry: ThingEntry): ThingShut | null {
  const { state, content } = read;
  const home = livesAt(state, content);
  if (home === null) return "away";
  if (owns(state, entry.id)) return "owned";
  if (!standsIn(entry, home)) return "home";
  if (!entry.needs.every((need) => owns(state, need))) return "needs";
  if (nairaHeld(state) < entry.price) return "short";
  return null;
}

/** The car stands at home: the ride sheet offers Drive (R-WORLD-017). */
export function drives(read: Pick<ReadCtx, "state" | "content">): boolean {
  return working(read).some((entry) => entry.drive === true);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function buyCommand(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "thing/buy") throw new Error(`thing/buy cannot handle ${command.type}.`);
  const entry = ownOf(ctx.content.thing, command.thing);
  if (entry === undefined) return reject("unknown-id", `${String(command.thing)} is no thing of the market.`);
  const shut = buyShut(ctx, entry);
  if (shut === "away") return reject("not-legal", "The market delivers to a home in Lagos.");
  if (shut === "owned") return reject("not-legal", `${entry.id} is owned already.`);
  if (shut === "home") return reject("not-legal", `${entry.id} has no place in this home.`);
  if (shut === "needs") return reject("not-legal", `${entry.id} needs ${entry.needs.join(", ")} first.`);
  if (shut === "short") return reject("cannot-afford", `${entry.id} costs ${String(entry.price)} kobo and the naira held cannot cover it.`);
  const events = record(ctx, [{ type: "things/bought", thing: entry.id, month: ctx.state.turn.month, paid: entry.price }]);
  const cause = causeOf(entry.id);
  ctx.apply([{ type: "money/take", currency: "NGN", pocket: "any", amount: entry.price, reason: "goods" }, ...addsOf(entry.bought)], cause);
  return events;
}

function sellCommand(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "thing/sell") throw new Error(`thing/sell cannot handle ${command.type}.`);
  const entry = ownOf(ctx.content.thing, command.thing);
  if (entry === undefined) return reject("unknown-id", `${String(command.thing)} is no thing of the market.`);
  const owned = ctx.state.things.owned.find((one) => one.thing === entry.id);
  if (owned === undefined) return reject("not-legal", `${entry.id} is not owned.`);
  if (ctx.state.place.where !== "home") return reject("not-legal", "A thing is sold in Lagos.");
  const amount = resaleOf(entry, owned.paid);
  const events = record(ctx, [{ type: "things/sold", thing: entry.id, amount }]);
  if (amount > 0) ctx.apply([{ type: "money/add", currency: "NGN", pocket: "bank", amount, reason: "sale" }], causeOf(entry.id));
  return events;
}

/** R-PLACE-002 with the market: leaving Lagos, what is owned is sold at its resale figures, one line saying so. */
function sellOffEffect(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "things/sell-off") throw new Error(`things/sell-off cannot carry out ${effect.type}.`);
  const { owned } = ctx.state.things;
  if (owned.length === 0) return [];
  const amount = owned.reduce((sum, one) => {
    const entry = ctx.content.thing[one.thing];
    return entry === undefined ? sum : sum + resaleOf(entry, one.paid);
  }, 0);
  const events = record(ctx, [{ type: "things/sold-off", things: owned.map((one) => one.thing), amount }]);
  if (amount > 0) ctx.apply([{ type: "money/add", currency: "NGN", pocket: "bank", amount, reason: "sale" }], cause);
  return events;
}

// ---------------------------------------------------------------------------
// The month's close
// ---------------------------------------------------------------------------

/**
 * The `due` phase: each thing that works this month is lived with. One that costs to run takes its month (fuel, the
 * plan, the bouquet, the light) from the naira held, cash first, and gives its monthly lift; with the month's cost not
 * held it stands idle and gives nothing. One that costs nothing gives its lift.
 */
function due(ctx: Ctx): BaseEvent[] {
  const works = working(ctx);
  const events: BaseEvent[] = [];
  for (const entry of works) {
    const cost = runningOf(ctx, entry, works);
    const cause = causeOf(entry.id);
    if (cost > 0) {
      if (nairaHeld(ctx.state) < cost) {
        events.push(...record(ctx, [{ type: "things/stood", thing: entry.id, amount: cost }]));
        continue;
      }
      events.push(...record(ctx, [{ type: "things/ran", thing: entry.id, amount: cost }]));
      ctx.apply([{ type: "money/take", currency: "NGN", pocket: "any", amount: cost, reason: "running" }], cause);
    }
    ctx.apply(addsOf(entry.monthly), cause);
  }
  return events;
}

// ---------------------------------------------------------------------------
// Evolve, lines, invariants, view
// ---------------------------------------------------------------------------

function evolve(slice: ThingsSlice, event: ThingsEvent): ThingsSlice {
  switch (event.type) {
    case "things/bought":
      return { owned: [...slice.owned, { thing: event.thing, month: event.month, paid: event.paid }] };
    case "things/sold":
      return { owned: slice.owned.filter((one) => one.thing !== event.thing) };
    case "things/sold-off":
      return { owned: [] };
    case "things/ran":
    case "things/stood":
      return slice;
    default: {
      const never: never = event;
      throw new Error(`Unknown things event ${JSON.stringify(never)}.`);
    }
  }
}

function line(key: string, params: ReportLine["params"], tone: ReportLine["tone"], attention = false): ReportLine {
  return { key, params, tone, attention, counts: [] };
}

function lines(event: ThingsEvent): ReportLine[] {
  switch (event.type) {
    case "things/bought":
      return [line("line.things.bought", { thing: event.thing, amount: { currency: "NGN", amount: event.paid } }, "plain")];
    case "things/sold":
      return [line("line.things.sold", { thing: event.thing, amount: { currency: "NGN", amount: event.amount } }, "plain")];
    case "things/sold-off":
      return [line("line.things.sold-off", { count: event.things.length, amount: { currency: "NGN", amount: event.amount } }, "plain", true)];
    case "things/ran":
      return [line("line.things.ran", { thing: event.thing, amount: { currency: "NGN", amount: event.amount } }, "plain")];
    case "things/stood":
      return [line("line.things.stood", { thing: event.thing, amount: { currency: "NGN", amount: event.amount } }, "bad")];
    default: {
      const never: never = event;
      void never;
      return [];
    }
  }
}

function invariants(state: State, content: Content): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const one of state.things.owned) {
    if (content.thing[one.thing] === undefined) problems.push(`The thing ${one.thing} owned is no thing of the market.`);
    if (seen.has(one.thing)) problems.push(`The thing ${one.thing} is owned twice.`);
    seen.add(one.thing);
    if (!Number.isSafeInteger(one.paid) || one.paid < 0) problems.push(`The thing ${one.thing} was paid ${String(one.paid)}.`);
  }
  return problems;
}

/** The things owned, the market with each thing's price, resale, running and why it is shut, whether Drive is offered, and the month's running. */
function thingsView(read: ReadCtx): PlayerView["things"] {
  const works = working(read);
  const home = livesAt(read.state, read.content);
  const owned = read.state.things.owned.map((one) => {
    const entry = read.content.thing[one.thing];
    return { thing: one.thing, month: one.month, stored: entry === undefined || !standsIn(entry, home), resale: entry === undefined ? 0 : resaleOf(entry, one.paid) };
  });
  return {
    owned,
    market: Object.values(read.content.thing).map((entry) => ({
      thing: entry.id,
      price: entry.price,
      resale: resaleOf(entry, entry.price),
      running: runningOf(read, entry, works),
      shut: buyShut(read, entry),
    })),
    drive: works.some((entry) => entry.drive === true),
    running: works.reduce((sum, entry) => sum + runningOf(read, entry, works), 0),
  };
}

export const thingsKind: RegisteredKind<ThingsSlice, ThingsEvent> = {
  kind: "things",
  initial: () => ({ owned: [] }),
  commands: { "thing/buy": buyCommand, "thing/sell": sellCommand },
  effects: { "things/sell-off": sellOffEffect },
  phases: { due },
  evolve,
  lines,
  invariants,
  view: (read) => ({ things: thingsView(read) }),
};
