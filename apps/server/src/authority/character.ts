// A new character for an account (docs/rules/server.md R-SERVER-016,
// account.md R-ACCOUNT-015): a 128-bit seed made once, the state at version
// 0, the account pointed at it. The reply is the first view. And the end of
// one (R-ACCOUNT-030), so the account may start another.
import type { Id, Save } from "@japacity/sim";
import { int, newState, viewFor } from "@japacity/sim";

import { clockView, tickAt } from "../clock/view";
import type { ServerDeps } from "../deps";
import { leavePairs } from "../pair/leave";
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
function newSeed(deps: Pick<ServerDeps, "config" | "randomBytes">): string {
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

/** The reply of `POST /api/character/end`: the life is gone and the account has room for another. */
export interface EndReply {
  ok: true;
}

/**
 * R-ACCOUNT-030: ends the account's character for good. A real partner or sibling joined to it is told
 * as R-PEOPLE-040 tells them of a deletion; then the account stops naming it, and the life's rows go as
 * the deletion job takes a character's (R-ACCOUNT-017, 018): its conversations but what a hold keeps,
 * its links, every save row, and its ledger mark. The account stays, with its age pass, its username,
 * its ways in and its blocks, so the next life needs no age screen and no bot check.
 */
export async function endCharacter(deps: ServerDeps, account: string): Promise<Answer<EndReply>> {
  const row = await deps.stores.account.get(account);
  if (row === null) return refusal(401, "signed-out", "Sign in again to end this life.");
  const character = row.character;
  if (character === null) return refusal(404, "no-character", "This account has no life to end.");
  await leavePairs(deps, account, character, "restart");
  const cleared = await deps.stores.account.setCharacter(account, null);
  if (!cleared.ok) throw new Error(`The account ${account} kept its character: ${cleared.detail}`);
  const keep = (await deps.stores.moderation.holds(deps.now())).flatMap((hold) => hold.messages);
  await deps.stores.conversation.removeFor(character, keep);
  await deps.stores.invite.remove(character);
  await deps.stores.player.remove(character);
  await deps.stores.ledger.dropMark(character);
  return { status: 200, body: { ok: true } };
}
