// Block and report (pair.md R-PAIR-014 to 016; moderation.md R-MODERATION-001,
// 002, 004, 006 to 009). A block ends every bond between the two as a block
// end in both lives and is never shown to the blocked side as a block; a
// report holds what it cites and changes nothing in either life.
import type { PairRecord } from "@japacity/sim";
import { pairId, time } from "@japacity/sim";
import type { ReportReason, ReportRow } from "@japacity/store";

import { characterOf } from "../authority/command";
import type { ServerDeps } from "../deps";
import type { PairAnswer } from "./codes";
import { refused, widen } from "./codes";
import { readable } from "./conversation";
import { field } from "./invite";
import { accountOfCharacter } from "./region";
import { pairStep, sendTo, sideLive, sideOf, unusual } from "./step";

const REPORT_BYTES = 12;
/** `config.moderation` (reportsPerDay 20, holdDays 90) is not in ServerConfig yet; the page's values are used until it is. */
export const REPORTS_PER_DAY = 20;
export const HOLD_DAYS = 90;

const REASONS: readonly ReportReason[] = ["scam", "harassment", "impersonation", "underage", "sexual", "hate", "self-harm", "illegal", "cheating", "advert", "other"];

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** `POST /api/moderation/block`, `/unblock`. The reply never says more than that it was done. */
export interface Blocked {
  ok: true;
}

/** `POST /api/moderation/report`: received at once (R-MODERATION-007). */
export interface Reported {
  ok: true;
  report: string;
}

/** The other character a request names: the other side of `pair`, or `character` itself. */
async function targetOf(deps: ServerDeps, me: string, body: unknown): Promise<string | null> {
  const pair = field(body, "pair");
  if (pair !== null) {
    const row = await deps.stores.pair.get(pair);
    const record = row === null ? null : (row.record as PairRecord);
    const at = record === null ? null : sideOf(record, me);
    if (record === null || at === null) return null;
    const them = record[at === "a" ? "b" : "a"];
    return them === "" ? null : them;
  }
  const character = field(body, "character");
  return character === me ? null : character;
}

/**
 * R-PAIR-015, R-MODERATION-002: writes the block into the record the two
 * share, ending it as a block in both lives, with no standing cost and the
 * joint collapsed by each life's own end.
 */
async function blockRecord(deps: ServerDeps, me: string, them: string): Promise<PairAnswer<Blocked> | null> {
  const key = pairId(me, them);
  if ((await deps.stores.pair.get(key)) === null) return null;
  const outcome = await pairStep(deps, key, ({ book, turn, lives }) => {
    const record = book.get(key);
    const at = record === null ? null : sideOf(record, me);
    if (record === null || at === null) return { ok: true, value: null };
    if (record.ended === null) {
      for (const each of ["a", "b"] as const) {
        const to = sideLive(lives, record, each);
        if (to === null) continue;
        const ended = sendTo(turn, to, { type: "people/ended", pair: key, why: "block" });
        if (!ended.ok) return ended;
      }
    }
    book.write(key, at, { type: "pair/blocked", tick: turn.world.tick });
    return { ok: true, value: null };
  });
  if (outcome.kind === "done") return null;
  if (outcome.kind === "rejected") return { status: 200, body: outcome.rejection };
  return widen(unusual(outcome));
}

/** R-MODERATION-001: `moderation/block` names the other player by their pair or their character. */
export async function block(deps: ServerDeps, account: string, body: unknown): Promise<PairAnswer<Blocked>> {
  const me = await characterOf(deps, account);
  if (me === null) return refused(404, "no-character", "This account has no character yet.");
  const them = await targetOf(deps, me, body);
  const theirs = them === null ? null : await accountOfCharacter(deps, them);
  if (them === null || theirs === null) return refused(404, "unknown-id", "There is no such player.");
  await deps.stores.moderation.block({ from: account, to: theirs.id, at: deps.now() });
  return (await blockRecord(deps, me, them)) ?? { status: 200, body: { ok: true } };
}

/** R-MODERATION-002: the block lifted, and nothing restored: a new invite is needed. */
export async function unblock(deps: ServerDeps, account: string, body: unknown): Promise<PairAnswer<Blocked>> {
  const me = await characterOf(deps, account);
  if (me === null) return refused(404, "no-character", "This account has no character yet.");
  const them = await targetOf(deps, me, body);
  const theirs = them === null ? null : await accountOfCharacter(deps, them);
  if (them === null || theirs === null) return refused(404, "unknown-id", "There is no such player.");
  await deps.stores.moderation.unblock(account, theirs.id);
  const key = pairId(me, them);
  if ((await deps.stores.pair.get(key)) !== null) {
    const outcome = await pairStep(deps, key, ({ book }) => {
      const record = book.get(key);
      const at = record === null ? null : sideOf(record, me);
      if (at !== null) book.write(key, at, { type: "pair/unblocked" });
      return { ok: true, value: null };
    });
    if (outcome.kind === "diverged" || outcome.kind === "refused") return widen(unusual(outcome));
  }
  return { status: 200, body: { ok: true } };
}

/** Sets or clears `held` on a record, touching no life (R-PAIR-016). */
async function holdRecord(deps: ServerDeps, key: string, held: boolean): Promise<void> {
  if ((await deps.stores.pair.get(key)) === null) return;
  await pairStep(deps, key, ({ book }) => {
    const record = book.get(key);
    if (record !== null && record.held !== held) book.write(key, "a", { type: held ? "pair/held" : "pair/released" });
    return { ok: true, value: null };
  });
}

function messagesOf(body: unknown): string[] | null {
  if (typeof body !== "object" || body === null) return [];
  const messages = (body as { messages?: unknown }).messages;
  if (messages === undefined) return [];
  return Array.isArray(messages) && messages.every((each) => typeof each === "string") ? messages : null;
}

/**
 * R-PAIR-016, R-MODERATION-004, R-MODERATION-006, R-MODERATION-008: a report
 * on a pair, citing the pair or messages of its conversation, with a reason
 * from the fixed list. The record is held until a moderator decides; the
 * reporter may block in the same step. At most `REPORTS_PER_DAY` a day.
 */
export async function report(deps: ServerDeps, account: string, body: unknown): Promise<PairAnswer<Reported>> {
  const reason = field(body, "reason");
  const key = field(body, "pair");
  const messages = messagesOf(body);
  if (reason === null || !REASONS.includes(reason as ReportReason)) return refused(400, "not-legal", "Choose a reason from the list.");
  if (key === null || messages === null) return refused(400, "not-legal", "A report cites the pair, and for a conversation its message ids.");
  const now = deps.now();
  if ((await deps.stores.moderation.filedSince(account, now - time.DAY_MS)) >= REPORTS_PER_DAY) {
    return { status: 429, body: { ok: false, code: "rate-limited", detail: "Too many reports today.", retryAfter: 86_400 } };
  }
  const found = await readable(deps, account, key);
  if (found === null) return refused(404, "unknown-id", "There is no such pair.");
  const rows = await deps.stores.conversation.byIds(messages);
  if (rows.length !== messages.length || rows.some((row) => row.conversation !== key)) return refused(400, "not-legal", "Every cited message must be in this pair's conversation.");
  const subject = await accountOfCharacter(deps, found.record[found.side === "a" ? "b" : "a"]);
  const id = `report-${hex(deps.randomBytes(REPORT_BYTES))}`;
  const filed = await deps.stores.moderation.report(
    { id, reporter: account, subject: { account: subject?.id ?? "" }, reason: reason as ReportReason, cites: messages.length > 0 ? { messages } : { pair: key }, pair: key, unverified: false, at: now },
    { messages, pair: key, until: now + HOLD_DAYS * time.DAY_MS },
  );
  if (!filed.ok) throw new Error(`The report ${id} was refused: ${filed.detail}`);
  await holdRecord(deps, key, true);
  if ((body as { block?: unknown }).block === true) {
    const blocked = await block(deps, account, { pair: key });
    if (!blocked.body.ok) return { status: blocked.status, body: blocked.body };
  }
  return { status: 200, body: { ok: true, report: id } };
}

/**
 * R-MODERATION-007, R-MODERATION-008: for the moderation work's admin view.
 * Decides the report, lifts its hold, and releases the record once no other
 * open report holds it.
 */
export async function closeReport(deps: ServerDeps, id: string, outcome: "acted" | "no-action"): Promise<ReportRow | null> {
  const closed = await deps.stores.moderation.close(id, outcome, deps.now());
  if (!closed.ok) return null;
  const key = closed.value.pair;
  if (key !== null && (await deps.stores.moderation.openOn(key)).length === 0) await holdRecord(deps, key, false);
  return closed.value;
}
