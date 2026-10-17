// The working copy of one step. Everything a step does happens here, and the
// draft is dropped whole when a command is rejected (R-ENGINE-002): events,
// lines, draws and instance numbers alike. The input state is never touched.
import { checkWith, resolveAmount } from "./check";
import type { EngineCtx, PrefixOf, Registry, SliceKey, TurnInProgress } from "./kind";
import { prefixOf } from "./kind";
import { characterRandom } from "./random";
import { applyEventWith } from "./state";
import type { BaseEvent, Cause, Content, Effect, EffectType, ReadCtx, ReportLine, State, Stream, World, Sender } from "./types";

export interface Draft {
  readonly kinds: Registry;
  readonly content: Content;
  readonly world: World;
  readonly sender: Sender;
  state: State;
  /** The engine's counters while the step runs. Written to the state by `engine/stepped`. */
  readonly draws: Partial<Record<Stream, number>>;
  nextInstance: number;
  readonly events: BaseEvent[];
  readonly applied: Set<BaseEvent>;
  readonly lines: ReportLine[];
  turn: TurnInProgress | null;
}

export function openDraft(kinds: Registry, state: State, world: World, content: Content, sender: Sender = "player"): Draft {
  return {
    kinds,
    sender,
    content,
    world,
    state,
    draws: { ...state.draws },
    nextInstance: state.nextInstance,
    events: [],
    applied: new Set(),
    lines: [],
    turn: null,
  };
}

export function readOf(draft: Draft): ReadCtx {
  return { state: draft.state, world: draft.world, content: draft.content };
}

/** Which kind carries out each effect, by the part before the slash. */
const EFFECT_OWNER: Record<PrefixOf<EffectType>, SliceKey> = {
  people: "people",
  interview: "interview",
  money: "wallet",
  wallet: "wallet",
  quality: "quality",
  activity: "activity",
  document: "document",
  route: "route",
  obligation: "obligation",
  offer: "offer",
  turn: "turn",
  setpiece: "setpiece",
  place: "place",
  status: "status",
  credit: "credit",
  goal: "goal",
  home: "home",
  things: "things",
};

/** Apply one event to the draft and collect its report lines. An event already applied is skipped. */
export function applyToDraft(draft: Draft, event: BaseEvent): void {
  if (draft.applied.has(event)) return;
  draft.state = applyEventWith(draft.kinds, draft.state, event, draft.content);
  draft.applied.add(event);
  draft.events.push(event);
  const kind = draft.kinds.find((candidate) => candidate.kind === prefixOf(event.type));
  const lines = kind?.lines?.(event, draft.state, draft.content) ?? [];
  draft.lines.push(...lines);
}

/**
 * Apply what a kind's handler returned. Events that ctx.apply or ctx.emit
 * already applied are skipped. Any other event must be the kind's own: a kind
 * changes another kind only through an effect (R-ENGINE-013).
 */
export function applyReturned(draft: Draft, owner: SliceKey, events: readonly BaseEvent[]): void {
  for (const event of events) {
    if (draft.applied.has(event)) continue;
    if (prefixOf(event.type) !== owner) {
      throw new Error(`The ${owner} kind returned the event ${event.type}. A kind emits only its own events; it changes others through effects.`);
    }
    applyToDraft(draft, event);
  }
}

function effectOwner(type: EffectType): SliceKey {
  return EFFECT_OWNER[prefixOf(type) as PrefixOf<EffectType>];
}

export function makeCtx(draft: Draft): EngineCtx {
  const read = (): ReadCtx => readOf(draft);
  const ctx: EngineCtx = {
    get state() {
      return draft.state;
    },
    world: draft.world,
    content: draft.content,
    sender: draft.sender,
    random: characterRandom(draft.state.seed, draft.draws),
    nextId(prefix) {
      const id = `${prefix}-${String(draft.nextInstance)}`;
      draft.nextInstance += 1;
      return id;
    },
    amount: (amount, terms = {}) => resolveAmount(read(), amount, terms),
    check: (requirement, terms = {}) => checkWith(read(), requirement, terms, draft.kinds),
    apply(effects: Effect[], cause: Cause) {
      const produced: BaseEvent[] = [];
      for (const effect of effects) {
        const owner = effectOwner(effect.type);
        const handler = draft.kinds.find((kind) => kind.kind === owner)?.effects?.[effect.type];
        if (handler === undefined) throw new Error(`No kind carries out the effect ${effect.type} (expected the ${owner} kind).`);
        const events = handler(ctx, effect, cause);
        applyReturned(draft, owner, events);
        produced.push(...events);
      }
      return produced;
    },
    emit(owner, events) {
      applyReturned(draft, owner, events);
      return events;
    },
    get turn() {
      return draft.turn;
    },
  };
  return ctx;
}
