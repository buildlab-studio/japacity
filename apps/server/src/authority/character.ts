// A new character for an account (docs/rules/server.md R-SERVER-016,
// account.md R-ACCOUNT-015): a 128-bit seed made once, the state at version
// 0, the account pointed at it. The reply is the first view.
import type { Id, Save } from "@japacity/sim";
import { int, newState, viewFor } from "@japacity/sim";

import { clockView, tickAt } from "../clock/view";
import type { ServerDeps } from "../deps";
import type { ViewReply } from "../types";
import { tickRow } from "../world/ticks";
import type { Answer } from "./answer";
import { refusal } from "./answer";

const ID_BYTES = 16;
const BYTE_BITS = 8;

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** R-SERVER-016: the seed of a new character, `server.seedBits` of secure random bytes as hex. */
export function newSeed(deps: Pick<ServerDeps, "config" | "randomBytes">): string {
  return hex(deps.randomBytes(int.divFloor(deps.config.server.seedBits, BYTE_BITS)));
}

/**
 * R-SERVER-016, R-ACCOUNT-015: makes the account's one character in `scenario`.
 * R-PEOPLE-011, decision 0009: a sibling made from an invite starts from the
 * inviter's family draw; its first segment starts from that state, so every
 * replay begins where the life did.
 */
export async function newCharacter(deps: ServerDeps, account: string, scenario: Id<"scenario">, family?: Save["family"]): Promise<Answer<ViewReply>> {
  const row = await deps.stores.account.get(account);
  // a session without an account row has no code of its own; the accounts work makes the row at sign-in.
  if (row === null) return refusal(401, "signed-out", "Sign in again to make a character.");
  if (row.character !== null) return refusal(409, "one-character", "This account already has a character.");
  const content = deps.contents.current;
  if (content.scenario[scenario] === undefined) return refusal(400, "unknown-id", `There is no scenario ${scenario}.`);

  const seed = newSeed(deps);
  const id = `character-${hex(deps.randomBytes(ID_BYTES))}`;
  const at = deps.now();
  const world = (await tickRow(deps, tickAt(deps.config.clock, at))).world;
  const state = family === undefined ? newState(scenario, seed, content) : newState(scenario, seed, content, { family });
  const overlay = content.overlay === undefined ? {} : { overlay: content.overlay };
  const created = await deps.stores.player.create({
    id,
    account,
    refilledAt: at,
    content: content.version,
    ...overlay,
    start: family === undefined ? { scenario, seed, worldSeed: deps.secrets.worldSeed } : { base: state },
    state,
  });
  if (!created.ok) throw new Error(`A new character id was refused: ${created.detail}`);
  const pointed = await deps.stores.account.setCharacter(account, id);
  if (!pointed.ok) {
    await deps.stores.player.remove(id);
    return refusal(409, "one-character", "This account already has a character.");
  }
  const clock = clockView(deps.config, at, state, at, content.tuning.turn.cap);
  return { status: 200, body: { ok: true, view: viewFor({ state, world, content }), lines: [], clock } };
}
