// What the engine adds around the contract's KindModule and Ctx, without
// changing types.ts. Kinds import from here; this file imports only types, so
// it never takes part in an import cycle.
import type {
  BaseEvent,
  Content,
  Ctx,
  KindModule,
  Phase,
  ReadCtx,
  ReportLine,
  ScenarioEntry,
  SlotPick,
  State,
} from "./types";

/** The kinds that own a slice of the state, in registry order. */
export const SLICE_KEYS = [
  "turn",
  "quality",
  "activity",
  "wallet",
  "document",
  "route",
  "setpiece",
  "obligation",
  "offer",
  "chapter",
  "news",
  "place",
  "status",
  "credit",
  "goal",
  "prologue",
  "lottery",
  "people",
  "interview",
  "home",
  "things",
] as const satisfies readonly (keyof State)[];

export type SliceKey = (typeof SLICE_KEYS)[number];

/** The phases of a turn, in the order of engine.md section 4. */
export const PHASES = [
  "spend",
  "main",
  "slots",
  "due",
  "settle",
  "papers",
  "clocks",
  "expire",
  "news",
  "hear",
  "month",
  "come-up",
  "chapter",
  "close",
] as const satisfies readonly Phase[];

/** Fails to compile if a Phase is missing from PHASES. */
export const PHASES_COMPLETE: [Exclude<Phase, (typeof PHASES)[number]>] extends [never] ? true : never = true;

/**
 * Instance ids for `initial`. The contract's `initial(scenario, content)` has no
 * way to make ids, so the engine passes this as an optional third argument and
 * threads one counter through every kind in registry order. The counter's end
 * value becomes the new state's `nextInstance`. Ids look like `obligation-1`,
 * the same shape `ctx.nextId` gives during play.
 */
export interface IdSource {
  next(prefix: string): string;
}

/** The instance number of an id such as `obligation-12`, or null for any other shape. */
function instanceNumber(id: string): number | null {
  const match = /-(\d+)$/.exec(id);
  return match === null ? null : Number(match[1]);
}

/**
 * Oldest first, for the instances a kind keeps (obligation:due-phase-charges-oldest-first): by the month
 * opened, then by instance number, so `offer-10` comes after `offer-9` as it was
 * opened after it, then by id.
 */
export function oldestFirst(a: { openedMonth: number; id: string }, b: { openedMonth: number; id: string }): number {
  if (a.openedMonth !== b.openedMonth) return a.openedMonth - b.openedMonth;
  const na = instanceNumber(a.id);
  const nb = instanceNumber(b.id);
  if (na !== null && nb !== null && na !== nb) return na - nb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** A kind as the registry holds it: the contract's KindModule, keyed by its slice. */
export interface RegisteredKind<Slice, E extends BaseEvent> extends KindModule<Slice, E> {
  kind: SliceKey;
  initial(scenario: ScenarioEntry, content: Content, ids?: IdSource): Slice;
}

/** Any registered kind, for code that walks the registry. */
export type AnyKind = RegisteredKind<unknown, BaseEvent>;

/** The registry: every kind with a slice, in the order phases call them. */
export type Registry = readonly AnyKind[];

/** What the engine knows about the turn being resolved. */
export interface TurnInProgress {
  /** The slots of the `turn/end` command, as sent. Read by the activity kind's `slots` phase. */
  slots: SlotPick[];
  /**
   * The free slots the player had when the turn was checked, before any phase
   * ran. The job's toll in `main` can lower wellbeing under the burnout line,
   * and an empty slot still counts as rest at the count the player saw.
   */
  freeSlots: number;
  /** Japacity at the start of the turn, before the `spend` phase. */
  japacityBefore: number | null;
  /** Every report line produced so far in this turn. */
  lines(): ReportLine[];
}

/**
 * The Ctx the engine really hands to kinds. The two extra fields are not in
 * the contract's Ctx. Kinds read them through the helpers
 * below, so they never need a cast.
 */
export interface EngineCtx extends Ctx {
  /** Set while a `turn/end` resolves, null otherwise. */
  turn: TurnInProgress | null;
  /**
   * Apply a kind's own events at once, so the rest of the same handler sees
   * them. Each event must belong to `owner`. The events are still recorded
   * once each: returning them again from the handler is harmless.
   */
  emit(owner: SliceKey, events: BaseEvent[]): BaseEvent[];
}

function isEngineCtx(ctx: Ctx): ctx is EngineCtx {
  return "emit" in ctx && "turn" in ctx;
}

/** What a reader takes: the state, the world and the content, from a step's context or its draft. */
export function readOf(from: ReadCtx): ReadCtx {
  return { state: from.state, world: from.world, content: from.content };
}

/** The turn being resolved, or null outside `turn/end`. */
export function turnInProgress(ctx: Ctx): TurnInProgress | null {
  return isEngineCtx(ctx) ? ctx.turn : null;
}

/** The slots chosen for this turn. Empty outside `turn/end`. */
export function turnSlots(ctx: Ctx): SlotPick[] {
  return turnInProgress(ctx)?.slots ?? [];
}

/** Apply a kind's own events at once. See EngineCtx.emit. */
export function emit(ctx: Ctx, owner: SliceKey, events: BaseEvent[]): BaseEvent[] {
  if (!isEngineCtx(ctx)) throw new Error("emit needs the engine's Ctx.");
  return ctx.emit(owner, events);
}

/** The part of a type before the slash: `wallet/credited` is `wallet`. */
export type PrefixOf<T> = T extends `${infer P}/${string}` ? P : never;

export function prefixOf(type: string): string {
  const at = type.indexOf("/");
  return at < 0 ? type : type.slice(0, at);
}

/**
 * A record read with a key a player sent (engine:player-keys-read-as-own): only an own property counts, so a built-in
 * name ("constructor", "toString") finds nothing and is refused as any unknown id is, never thrown on.
 */
export function ownOf<T>(record: Readonly<Record<string, T>>, key: unknown): T | undefined {
  return typeof key === "string" && Object.hasOwn(record, key) ? record[key] : undefined;
}
