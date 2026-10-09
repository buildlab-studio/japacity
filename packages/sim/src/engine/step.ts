// The one function that does the work: step(state, command, world, content).
import { japacity } from "../japacity/japacity.logic";
import { registry } from "../kinds";
import { freeSlots } from "../turn/turn.logic";
import type { Draft } from "./draft";
import { applyReturned, applyToDraft, makeCtx, openDraft, readOf } from "./draft";
import type { EngineStepped } from "./events";
import type { EngineCtx, PrefixOf, Registry, SliceKey } from "./kind";
import { PHASES, prefixOf } from "./kind";
import { isRejection, reject } from "./reject";
import type { Command, CommandType, Content, Rejection, Sender, State, StepResult, World } from "./types";

/** Commands only the authority may send (R-SERVER-013): the turn grant and the draw's payout. */
/** R-PEOPLE-044: the only commands the engine accepts from a stand-in. The kinds judge each as a player's, with the sender in hand. */
export const STAND_IN_COMMANDS = ["interview/answer", "people/answer"] as const satisfies readonly Command["type"][];

export const AUTHORITY_COMMANDS = [
  "turns/grant",
  "lottery/pay",
  "people/link",
  "people/facts",
  "people/moments",
  "people/proposal",
  "people/agreed",
  "people/ended",
  "people/declined",
  "people/withdrawn",
  "people/gossip",
  "people/stand-in",
  "people/family-request",
  "interview/open",
  "interview/scored",
  "home/host",
] as const satisfies readonly CommandType[];

/** Which kind owns each command, by the part before the slash. */
export const COMMAND_OWNER: Record<PrefixOf<CommandType>, SliceKey> = {
  lottery: "lottery",
  people: "people",
  interview: "interview",
  turn: "turn",
  turns: "turn",
  activity: "activity",
  offer: "offer",
  wallet: "wallet",
  obligation: "obligation",
  route: "route",
  setpiece: "setpiece",
  prologue: "prologue",
  status: "status",
  return: "place",
  place: "place",
  home: "home",
};

export function commandOwner(type: CommandType): SliceKey {
  return COMMAND_OWNER[prefixOf(type) as PrefixOf<CommandType>];
}

/** True when some kind of the registry handles the command type. `turn/end` always is. */
export function handles(type: CommandType, kinds: Registry = registry()): boolean {
  if (type === "turn/end") return true;
  const owner = commandOwner(type);
  return kinds.find((kind) => kind.kind === owner)?.commands?.[type] !== undefined;
}

function runCommand(draft: Draft, ctx: EngineCtx, command: Command): Rejection | null {
  const owner = commandOwner(command.type);
  const handler = draft.kinds.find((kind) => kind.kind === owner)?.commands?.[command.type];
  if (handler === undefined) return reject("not-legal", `Nothing handles ${command.type} yet.`);
  const result = handler(ctx, command);
  if (isRejection(result)) return result;
  applyReturned(draft, owner, result);
  return null;
}

/**
 * `turn/end` (R-ENGINE-004). First every kind's `commands["turn/end"]` runs, in
 * registry order, as a validator: it returns a rejection, or [] to let the
 * turn go ahead. The turn kind checks the bank, an open set piece and the slot
 * count (R-TURN-003, R-SETPIECE-002, R-TURN-006). The activity kind checks
 * what fills each slot (R-ACTIVITY-002). A validator never changes anything.
 * Then the phases run in the order of engine.md section 4, each calling every
 * kind that registered it, in registry order. Each kind's events are applied
 * before the next kind is called, so every phase sees the state the one before
 * left. The slots reach the activity kind through `turnSlots(ctx)`.
 */
function runTurn(draft: Draft, ctx: EngineCtx, command: Command & { type: "turn/end" }): Rejection | null {
  for (const kind of draft.kinds) {
    const validate = kind.commands?.["turn/end"];
    if (validate === undefined) continue;
    const result = validate(ctx, command);
    if (isRejection(result)) return result;
    if (result.length > 0) {
      throw new Error(`The ${kind.kind} kind's turn/end handler returned events. It must only validate; do the work in a phase.`);
    }
  }
  const linesBefore = draft.lines.length;
  draft.turn = {
    slots: command.slots,
    freeSlots: freeSlots(draft.state, draft.content),
    japacityBefore: japacity(readOf(draft)).percent,
    lines: () => draft.lines.slice(linesBefore),
  };
  for (const phase of PHASES) {
    for (const kind of draft.kinds) {
      const run = kind.phases?.[phase];
      if (run !== undefined) applyReturned(draft, kind.kind, run(ctx));
    }
  }
  draft.turn = null;
  return null;
}

/** step with a given registry. Tests use this to wrap or swap kinds. */
export function stepWith(
  kinds: Registry,
  state: State,
  command: Command,
  world: World,
  content: Content,
  sender: Sender = "player",
): StepResult {
  if (state.turn.ended && command.type !== "turns/grant") {
    return reject("ended", "The life is over. Only the authority may still grant turns.");
  }
  if ((AUTHORITY_COMMANDS as readonly string[]).includes(command.type) && sender !== "authority") {
    return reject("not-yours", `Only the authority sends ${command.type}.`);
  }
  // R-PEOPLE-044: a stand-in only answers, the interview's questions and a pending step of the joint; every other command is the player's alone.
  if (sender === "stand-in" && !(STAND_IN_COMMANDS as readonly string[]).includes(command.type)) {
    return reject("not-yours", `A stand-in may not send ${command.type}.`);
  }
  if (command.basedOn !== state.v) {
    return reject("stale", `The command is based on version ${String(command.basedOn)}, the state is at ${String(state.v)}.`);
  }
  if (world.tick < state.tick) {
    return reject("clock-went-back", `The world is at tick ${String(world.tick)}, the last accepted command was at ${String(state.tick)}.`);
  }
  if (state.prologue.open && command.type !== "prologue/choose" && command.type !== "turns/grant") {
    return reject("prologue-open", `The prologue is open: ${command.type} waits until it is finished.`);
  }
  const draft = openDraft(kinds, state, world, content, sender);
  const ctx = makeCtx(draft);
  const rejected = command.type === "turn/end" ? runTurn(draft, ctx, command) : runCommand(draft, ctx, command);
  if (rejected !== null) return rejected;
  const stepped: EngineStepped = {
    type: "engine/stepped",
    v: state.v + 1,
    tick: world.tick,
    draws: { ...draft.draws },
    nextInstance: draft.nextInstance,
  };
  applyToDraft(draft, stepped);
  return { ok: true, state: draft.state, events: draft.events, lines: draft.lines };
}

/**
 * Check a command against the state and, if it is accepted, return the new
 * state with its events and report lines. Never changes its inputs.
 */
export function step(state: State, command: Command, world: World, content: Content, sender: Sender = "player"): StepResult {
  return stepWith(registry(), state, command, world, content, sender);
}
