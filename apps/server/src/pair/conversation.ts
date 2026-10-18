// Conversations in preset phrases (pair:preset-phrases-only, pair:conversation-phrases-stored, pair:phrase-checks-before-send;
// person:talking-adds-moments; moderation:open-report-pauses-conversation): the checks in the
// page's order, the row stored, a `said` moment in the record and in both
// lives, and the other side nudged to fetch.
import type { ConversationRead, PairRead, Said } from "@japacity/api";
import type { ConversationRow, Id, PairRecord } from "@japacity/sim";
import { canSay, fillOptions, pairView, saidMoment, time, toHex, viewFor } from "@japacity/sim";

import { characterOf } from "../authority/command";
import type { ServerDeps } from "../deps";
import type { PairAnswer } from "./codes";
import { NOT_POSSIBLE, refused, widen } from "./codes";
import { momentInto } from "./carry";
import { accountOfCharacter } from "./account";
import { field } from "./invite";
import { silenced } from "./restricted";
import { pairStep, sideLive, sideOf, unusual } from "./step";

const MESSAGE_BYTES = 12;

/** The record and the reader's side, or null when the reader is not in it. */
export async function readable(deps: ServerDeps, account: string, key: string): Promise<{ character: string; record: PairRecord; side: "a" | "b" } | null> {
  const character = await characterOf(deps, account);
  if (character === null) return null;
  const row = await deps.stores.pair.get(key);
  if (row === null) return null;
  const record = row.record as PairRecord;
  const at = sideOf(record, character);
  return at === null ? null : { character, record, side: at };
}

/**
 * pair:conversation-phrases-stored, pair:phrase-checks-before-send: a phrase in the pair's conversation. Connected,
 * neither blocked, within `phrasesPerHour`, then the phrase and its fill from
 * the sender's own lists; a report the other side filed on this pair pauses
 * their way in too (moderation:open-report-pauses-conversation), and an account that is gone takes no
 * phrase. A refusal stores nothing and names only the check that failed.
 */
export async function say(deps: ServerDeps, account: string, key: string, body: unknown): Promise<PairAnswer<Said>> {
  const phraseId = field(body, "phrase");
  const fill = field(body, "fill");
  if (phraseId === null) return refused(400, "not-legal", "Name the phrase.");
  const content = deps.contents.current;
  const phrase = content.phrase[phraseId as Id<"phrase">];
  if (phrase === undefined) return refused(400, "unknown-id", `There is no phrase ${phraseId}.`);
  const paused = await silenced(deps, account);
  if (paused !== null) return paused;
  const found = await readable(deps, account, key);
  if (found === null) return refused(404, "unknown-id", "There is no such pair.");
  const { character, record } = found;
  const them = record[found.side === "a" ? "b" : "a"];
  const theirAccount = await accountOfCharacter(deps, them);
  if (theirAccount !== null && (await deps.stores.moderation.openOn(key)).some((report) => report.reporter === theirAccount.id)) {
    return refused(200, "not-possible", NOT_POSSIBLE);
  }
  const now = deps.now();
  const sent = await deps.stores.conversation.sentSince(key, character, now - time.HOUR_MS);
  const message: ConversationRow = { id: `message-${toHex(deps.randomBytes(MESSAGE_BYTES))}`, conversation: key, sender: character, phrase: phrase.id, fill, sentAt: now, readAt: null };

  const outcome = await pairStep(deps, key, ({ book, turn, lives, live }) => {
    const speaker = live(character);
    const held = book.get(key);
    const at = held === null ? null : sideOf(held, character);
    if (speaker === null || held === null || at === null) return { ok: false, code: "not-possible", detail: NOT_POSSIBLE };
    const fills = fillOptions(phrase, speaker.content, viewFor({ state: speaker.state, world: turn.world, content: speaker.content }));
    const allowed = canSay(held, at, phrase, fill, { sent, now, tuning: speaker.content.tuning.pair, fills });
    if (!allowed.ok) return { ok: false, code: allowed.failed, detail: allowed.failed === "not-possible" ? NOT_POSSIBLE : `The phrase cannot be sent: ${allowed.failed}.` };
    if (theirAccount === null) return { ok: false, code: "not-possible", detail: NOT_POSSIBLE };
    const tick = turn.world.tick;
    book.write(key, at, saidMoment(message, phrase, tick));
    // person:talking-adds-moments: talking counts, in both lives.
    for (const each of ["a", "b"] as const) {
      const to = sideLive(lives, held, each);
      if (to === null) continue;
      const failed = momentInto({ book, turn, lives }, to, key, { by: each === at ? "me" : "them", kind: "said", spot: phrase.fill === "spot" ? fill : null, what: phrase.id, tick });
      if (failed !== null) return failed;
    }
    return { ok: true, value: null };
  });
  switch (outcome.kind) {
    case "done": {
      const stored = await deps.stores.conversation.add(message);
      if (!stored.ok) throw new Error(`The message ${message.id} was refused: ${stored.detail}`);
      if (theirAccount !== null) await deps.stores.nudges.send(theirAccount.id, { nudge: "messages" });
      return { status: 200, body: { ok: true, message } };
    }
    case "rejected":
      return { status: 200, body: outcome.rejection };
    case "diverged":
    case "refused":
      return widen(unusual(outcome));
    default: {
      const never: never = outcome;
      throw new Error(`Unknown outcome ${String(never)}.`);
    }
  }
}

/** pair:conversation-phrases-stored: the rows after `after`, then every row from the other side marked read. */
export async function readConversation(deps: ServerDeps, account: string, key: string, after: string | null): Promise<PairAnswer<ConversationRead>> {
  const found = await readable(deps, account, key);
  if (found === null) return refused(404, "unknown-id", "There is no such pair.");
  const messages = await deps.stores.conversation.list(key, after);
  await deps.stores.conversation.markRead(key, found.character, deps.now());
  return { status: 200, body: { ok: true, pair: key, messages } };
}

/** pair:who-may-read-a-record: the record as the reader's side may see it. */
export async function readPair(deps: ServerDeps, account: string, key: string): Promise<PairAnswer<PairRead>> {
  const found = await readable(deps, account, key);
  const view = found === null ? null : pairView(found.record, found.character);
  if (view === null) return refused(404, "unknown-id", "There is no such pair.");
  return { status: 200, body: { ok: true, pair: view } };
}
