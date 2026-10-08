// The command route's work and the view's (docs/rules/server.md R-SERVER-001
// to 006, R-SERVER-015, R-SERVER-019; clock.md R-CLOCK-003 to 006): find the
// account's character, run one transaction, and answer with the view after it
// and the clock. Nothing is predicted and nothing hidden leaves.
import type { Command, ReportLine } from "@japacity/sim";
import { viewFor } from "@japacity/sim";

import { clockView } from "../clock/view";
import type { ServerDeps } from "../deps";
import type { ServerReply, ViewReply } from "../types";
import type { Answer } from "./answer";
import { refusal } from "./answer";
import { afterCommit, queueDiverged } from "./commit";
import type { Live } from "./load";
import type { Act, TxOptions, TxResult } from "./transaction";
import { transact } from "./transaction";

/** R-SERVER-001: a request body that holds a command and the version it was based on, and nothing else is read. */
export function readRequest(body: unknown): { command: Command; basedOn: number } | null {
  if (typeof body !== "object" || body === null) return null;
  const { command, basedOn } = body as { command?: unknown; basedOn?: unknown };
  if (typeof command !== "object" || command === null || Array.isArray(command)) return null;
  if (typeof (command as { type?: unknown }).type !== "string") return null;
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
  const request = readRequest(body);
  if (request === null) return refusal(400, "not-legal", "The request is not a command with the version it was based on.");
  const character = await characterOf(deps, account);
  if (character === null) return refusal(404, "no-character", "This account has no character yet.");

  // the stale check reads the stored version after the load, so a stale reply carries a true clock; nothing is written either way.
  const act: Act<ReportLine[]> = (lives, turn) => {
    const live = onlyLive(lives);
    if (request.basedOn !== live.storedV) {
      return { ok: false, code: "stale", detail: `The command is based on version ${String(request.basedOn)}, the character is at ${String(live.storedV)}.` };
    }
    const result = turn.send(live, { ...request.command, basedOn: live.state.v }, "player");
    return result.ok ? { ok: true, value: result.lines } : result;
  };
  const outcome = await transact(deps, [character], act);
  switch (outcome.kind) {
    case "done": {
      const live = onlyLive(outcome.lives);
      await afterCommit(deps, outcome.lives, "player");
      const view = viewFor({ state: live.state, world: outcome.world, content: live.content });
      return { status: 200, body: { ok: true, view, lines: outcome.value, clock: clockOf(deps, live, outcome.at) } };
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

/** R-CLOCK-003, R-CLOCK-004, R-SERVER-015: the view after the same load and grant, with the clock. */
export async function readView(deps: ServerDeps, account: string): Promise<Answer<ViewReply>> {
  const character = await characterOf(deps, account);
  if (character === null) return refusal(404, "no-character", "This account has no character yet.");
  const outcome = await transact(deps, [character], () => ({ ok: true, value: null }));
  switch (outcome.kind) {
    case "done": {
      const live = onlyLive(outcome.lives);
      await afterCommit(deps, outcome.lives, "player");
      const view = viewFor({ state: live.state, world: outcome.world, content: live.content });
      return { status: 200, body: { ok: true, view, lines: [], clock: clockOf(deps, live, outcome.at) } };
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
