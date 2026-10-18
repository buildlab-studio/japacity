// The command route's work and the view's (docs/rules/server.md R-SERVER-001
// to 006, R-SERVER-015, R-SERVER-019; clock.md R-CLOCK-003 to 006): find the
// account's character, run one transaction, and answer with the view after it
// and the clock. Nothing is predicted and nothing hidden leaves.
import type { PresetReply, PresetRequest, PresetStep, ServerReply, ViewReply } from "@japacity/api";
import { presetAnswer, presetOffered } from "@japacity/content";
import type { Command, Rejection, ReportLine } from "@japacity/sim";
import { viewFor } from "@japacity/sim";

import { clockView } from "../clock/view";
import type { ServerDeps } from "../deps";
import { withNumbers } from "../lottery/numbers";
import { bookOf } from "../pair/book";
import { bondedWith, carry } from "../pair/carry";
import type { Answer } from "./answer";
import { refusal } from "./answer";
import { afterCommit, queueDiverged } from "./commit";
import type { Live } from "./load";
import type { Act, TxOptions, TxResult } from "./transaction";
import { transact } from "./transaction";

const ENCODER = new TextEncoder();

/**
 * R-SERVER-001: a request body that holds a command and the version it was
 * based on, and nothing else is read. R-SERVER-037: a command over
 * `commandBytes` of JSON is refused before it is read. The largest a player
 * sends, a month's slots, is a few hundred bytes; an accepted command is
 * logged as it came, so anything bigger would only fill the log.
 */
export function readRequest(body: unknown, commandBytes: number): { command: Command; basedOn: number } | null {
  if (typeof body !== "object" || body === null) return null;
  const { command, basedOn } = body as { command?: unknown; basedOn?: unknown };
  if (typeof command !== "object" || command === null || Array.isArray(command)) return null;
  if (typeof (command as { type?: unknown }).type !== "string") return null;
  if (ENCODER.encode(JSON.stringify(command)).length > commandBytes) return null;
  if (typeof basedOn !== "number" || !Number.isSafeInteger(basedOn)) return null;
  return { command: command as Command, basedOn };
}

/** The account's character, or null. */
export async function characterOf(deps: ServerDeps, account: string): Promise<string | null> {
  return (await deps.stores.account.get(account))?.character ?? null;
}

function clockOf(deps: ServerDeps, live: Live, at: number) {
  return clockView(deps.config, at, live.state, live.refilledAt, live.content.tuning.turn.cap);
}

/** The held life of `character` among the lives of one transaction. */
function liveOf(lives: readonly Live[], character: string): Live {
  const live = lives.find((each) => each.id === character);
  if (live === undefined) throw new Error(`${character} was not held.`);
  return live;
}

function onlyLive(lives: readonly Live[]): Live {
  const live = lives[0];
  if (live === undefined || lives.length !== 1) throw new Error(`One character was held, not ${String(lives.length)}.`);
  return live;
}

/** The answers every route gives alike: a divergence queued for the rollback tool, a character the store does not hold. */
async function unusual<T>(deps: ServerDeps, outcome: Exclude<TxResult<T>, { kind: "done" | "rejected" }>): Promise<Answer<never>> {
  if (outcome.kind === "diverged") {
    await queueDiverged(deps, outcome.diverged);
    return refusal(409, "diverged", "This character is being checked. Play resumes once it is mended.");
  }
  return refusal(404, "no-character", outcome.refusal.detail);
}

/**
 * R-SERVER-001, R-SERVER-002, R-SERVER-005: the player's command in one
 * transaction. `stale` unless `basedOn` is the stored version; the command is
 * stamped with the version after the grant, the current tick and the sender
 * `player`. A rejection writes nothing and comes back with the clock.
 */
export async function sendCommand(deps: ServerDeps, account: string, body: unknown): Promise<Answer<ServerReply>> {
  const request = readRequest(body, deps.config.limits.commandBytes);
  if (request === null) return refusal(400, "not-legal", "The request is not a command with the version it was based on.");
  const character = await characterOf(deps, account);
  if (character === null) return refusal(404, "no-character", "This account has no character yet.");

  // The stale check reads the stored version after the load, so a stale reply carries a true clock; nothing is written either way.
  const act: Act<ReportLine[]> = (lives, turn) => {
    const live = liveOf(lives, character);
    if (request.basedOn !== live.storedV) {
      return { ok: false, code: "stale", detail: `The command is based on version ${String(request.basedOn)}, the character is at ${String(live.storedV)}.` };
    }
    const before = live.state;
    const result = turn.send(live, { ...request.command, basedOn: live.state.v }, "player");
    if (!result.ok) return result;
    // R-PAIR-004: what the command does to a shared record and the other life goes in the same transaction.
    const book = bookOf(turn);
    const carried = carry({ book, turn, lives }, live, before, result.events, "player");
    if (carried !== null) return carried;
    book.flush();
    return { ok: true, value: result.lines };
  };
  const outcome = await transact(deps, [character, ...(await bondedWith(deps, character))], act);
  switch (outcome.kind) {
    case "done": {
      const live = liveOf(outcome.lives, character);
      await afterCommit(deps, [live], "player");
      await afterCommit(deps, outcome.lives.filter((each) => each !== live), "authority");
      const view = await withNumbers(deps, live.id, live.state, viewFor({ state: live.state, world: outcome.world, content: live.content }));
      return { status: 200, body: { ok: true, view, lines: outcome.value, clock: clockOf(deps, live, outcome.at) } };
    }
    case "rejected":
      return { status: 200, body: { ...outcome.rejection, clock: clockOf(deps, liveOf(outcome.lives, character), outcome.at) } };
    case "diverged":
    case "refused":
      return unusual(deps, outcome);
    default: {
      const never: never = outcome;
      throw new Error(`Unknown outcome ${String(never)}.`);
    }
  }
}

/** R-SERVER-046: a body that holds the archetype, the age step, the home and the version seen, and nothing else is read. */
function readPresetRequest(body: unknown): PresetRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { archetype, age, home, basedOn } = body as Partial<Record<keyof PresetRequest, unknown>>;
  if (typeof archetype !== "string" || typeof home !== "string") return null;
  if (typeof age !== "number" || !Number.isSafeInteger(age)) return null;
  if (typeof basedOn !== "number" || !Number.isSafeInteger(basedOn)) return null;
  return { archetype, age, home, basedOn };
}

interface Played {
  trail: PresetStep[];
  lines: ReportLine[];
  refusal: Rejection | null;
}

/**
 * R-SERVER-046 (decision 0008): the prologue's preset in one transaction as R-SERVER-002 runs a command. `stale` unless
 * `basedOn` is the stored version; then `prologue/choose` for each step in turn with content's `presetAnswer` at the card
 * the view shows, each logged as the player's, until the prologue closes, a step has no open answer (its card shows),
 * an answer is refused, or `limits.presetSteps` are played. A refusal after some steps keeps them and comes back in the
 * reply; a refusal at the first step writes nothing, as a command's does. What follows a commit runs once, after it:
 * the player's own steps nudge no one, as a command of theirs does not. `answerAt` is content's answer, swapped only by
 * a test that needs a step refused.
 */
export async function playPreset(deps: ServerDeps, account: string, body: unknown, answerAt: typeof presetAnswer = presetAnswer): Promise<Answer<PresetReply>> {
  const request = readPresetRequest(body);
  if (request === null) return refusal(400, "not-legal", "The request is not an archetype, an age and a home with the version it was based on.");
  if (!presetOffered(request.archetype, request.age, request.home)) return refusal(400, "not-legal", "The door offers no such archetype, age or home.");
  const character = await characterOf(deps, account);
  if (character === null) return refusal(404, "no-character", "This account has no character yet.");

  const act: Act<Played> = (lives, turn) => {
    const live = liveOf(lives, character);
    if (request.basedOn !== live.storedV) {
      return { ok: false, code: "stale", detail: `The preset is based on version ${String(request.basedOn)}, the character is at ${String(live.storedV)}.` };
    }
    if (!live.state.prologue.open) return { ok: false, code: "not-legal", detail: "There is no prologue open." };
    const played: Played = { trail: [], lines: [], refusal: null };
    while (played.trail.length < deps.config.limits.presetSteps) {
      // The card as the player's view shows it, so each answer is the one the client would have sent.
      const card = viewFor({ state: live.state, world: turn.world, content: live.content }).prologue;
      if (card === null) break;
      const answer = answerAt(request.archetype, request.age, request.home, card.step, card.answers);
      if (answer === null) break;
      const result = turn.send(live, { type: "prologue/choose", step: card.step, answer, basedOn: live.state.v }, "player");
      if (!result.ok) {
        played.refusal = result;
        break;
      }
      const { draw, lastOutcome } = live.state.prologue;
      played.trail.push({ step: card.step, answer, draw, outcome: lastOutcome });
      played.lines.push(...result.lines);
    }
    if (played.trail.length === 0 && played.refusal !== null) return played.refusal;
    return { ok: true, value: played };
  };
  const outcome = await transact(deps, [character], act);
  switch (outcome.kind) {
    case "done": {
      const live = onlyLive(outcome.lives);
      await afterCommit(deps, outcome.lives, "player");
      const view = await withNumbers(deps, live.id, live.state, viewFor({ state: live.state, world: outcome.world, content: live.content }));
      const { trail, lines, refusal: refused } = outcome.value;
      const body: PresetReply = { ok: true, view, lines, clock: clockOf(deps, live, outcome.at), stepped: trail.length, trail, ...(refused === null ? {} : { refusal: refused }) };
      return { status: 200, body };
    }
    case "rejected":
      return { status: 200, body: { ...outcome.rejection, clock: clockOf(deps, onlyLive(outcome.lives), outcome.at) } };
    case "diverged":
    case "refused":
      return unusual(deps, outcome);
    default: {
      const never: never = outcome;
      throw new Error(`Unknown outcome ${String(never)}.`);
    }
  }
}

/**
 * R-CLOCK-003, R-CLOCK-004, R-SERVER-015: the view after the same load and
 * grant, with the clock. R-LOTTERY-013, R-LOTTERY-017: with `since`, the
 * lines of every row after that version its player did not send (a draw's
 * payment, a grant, the stand-in's answers), so a player who was away sees
 * them. Rows older than the latest snapshot are not replayed, so their lines
 * are not in the reply.
 */
export async function readView(deps: ServerDeps, account: string, since: number | null = null): Promise<Answer<ViewReply>> {
  const character = await characterOf(deps, account);
  if (character === null) return refusal(404, "no-character", "This account has no character yet.");
  const outcome = await transact(deps, [character], () => ({ ok: true, value: null }));
  switch (outcome.kind) {
    case "done": {
      const live = onlyLive(outcome.lives);
      await afterCommit(deps, outcome.lives, "player");
      const view = await withNumbers(deps, live.id, live.state, viewFor({ state: live.state, world: outcome.world, content: live.content }));
      const lines = since === null ? [] : live.sentFor.filter((sent) => sent.v > since).flatMap((sent) => sent.lines);
      return { status: 200, body: { ok: true, view, lines, clock: clockOf(deps, live, outcome.at) } };
    }
    case "rejected":
      throw new Error("A view steps nothing and cannot be rejected.");
    case "diverged":
    case "refused":
      return unusual(deps, outcome);
    default: {
      const never: never = outcome;
      throw new Error(`Unknown outcome ${String(never)}.`);
    }
  }
}

/**
 * R-SERVER-006: an authority command (`lottery/pay`, an apology's
 * `turns/grant`) for one character, through the same transaction as a
 * player's, sent by `authority`. The character's player is nudged after the
 * commit. R-CLOCK-008: such a grant does not move `refilledAt`.
 */
export async function sendAuthority(deps: ServerDeps, character: string, command: Command): Promise<TxResult<ReportLine[]>> {
  const outcome = await transact(deps, [character], (lives, turn) => {
    const live = onlyLive(lives);
    const result = turn.send(live, { ...command, basedOn: live.state.v }, "authority");
    return result.ok ? { ok: true, value: result.lines } : result;
  });
  if (outcome.kind === "done") await afterCommit(deps, outcome.lives, "authority");
  if (outcome.kind === "diverged") await queueDiverged(deps, outcome.diverged);
  return outcome;
}

/** R-SERVER-021, R-SERVER-023: loads a character and writes its upgrade to the current content, stepping nothing. For the sweep. */
export async function upgradeCharacter(deps: ServerDeps, character: string, options: TxOptions = { grant: false }): Promise<TxResult<null>> {
  const outcome = await transact(deps, [character], () => ({ ok: true, value: null }), options);
  if (outcome.kind === "diverged") await queueDiverged(deps, outcome.diverged);
  return outcome;
}
