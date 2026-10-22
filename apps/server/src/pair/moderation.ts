// Block and report (pair:block-and-report-one-tap, pair:block-ends-every-bond and pair:report-holds-conversation; moderation:block-refuses-both-ways, moderation:block-ends-pair-records, moderation:report-carries-subject-and-reason, moderation:report-offers-block, moderation:reporter-told-outcome-only, moderation:reports-hold-cited-records and moderation:open-report-pauses-conversation; moderation:blocked-list-in-settings). A block ends every bond between the two as a block
// end in both lives and is never shown to the blocked side as a block; a
// report holds what it cites and changes nothing in either life.
import { type Blocked, type BlockedList, REPORT_REASONS, type ReportCite, type Reported, type ReportSubject } from "@japacity/api";
import type { Id, PairRecord } from "@japacity/sim";
import { pairId, time, toHex } from "@japacity/sim";
import type { ReportReason, ReportRow } from "@japacity/store";

import { characterOf } from "../authority/command";
import type { ServerDeps } from "../dependencies";
import type { PairAnswer } from "./codes";
import { refused, widen } from "./codes";
import type { ReportInput } from "../moderation/reports";
import { readReport } from "../moderation/reports";
import { readable } from "./conversation";
import { field } from "./invite";
import { accountOfCharacter } from "./account";
import { pairStep, sendTo, sideLive, sideOf, unusual } from "./step";

const REPORT_BYTES = 12;

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
 * pair:block-ends-every-bond, moderation:block-ends-pair-records: writes the block into the record the two
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

/** moderation:block-refuses-both-ways: `moderation/block` names the other player by their pair or their character. */
export async function block(deps: ServerDeps, account: string, body: unknown): Promise<PairAnswer<Blocked>> {
  // moderation:blocked-list-in-settings: an account is a line of the blocked list, for an unblock; a block names where the two met.
  if (field(body, "account") !== null) return refused(400, "not-legal", "A block names a pair or a character.");
  const me = await characterOf(deps, account);
  if (me === null) return refused(404, "no-character", "This account has no character yet.");
  const them = await targetOf(deps, me, body);
  const theirs = them === null ? null : await accountOfCharacter(deps, them);
  if (them === null || theirs === null) return refused(404, "unknown-id", "There is no such player.");
  await deps.stores.moderation.block({ from: account, to: theirs.id, at: deps.now() });
  return (await blockRecord(deps, me, them)) ?? { status: 200, body: { ok: true } };
}

/** moderation:block-ends-pair-records: the block written off the record the two characters share, if they share one. */
async function unblockRecord(deps: ServerDeps, me: string, them: string): Promise<PairAnswer<Blocked> | null> {
  const key = pairId(me, them);
  if ((await deps.stores.pair.get(key)) === null) return null;
  const outcome = await pairStep(deps, key, ({ book }) => {
    const record = book.get(key);
    const at = record === null ? null : sideOf(record, me);
    if (at !== null) book.write(key, at, { type: "pair/unblocked" });
    return { ok: true, value: null };
  });
  return outcome.kind === "diverged" || outcome.kind === "refused" ? widen(unusual(outcome)) : null;
}

/**
 * moderation:blocked-list-in-settings: an unblock naming a line of the blocked list by its account. An account the
 * player has not blocked, or that does not exist, answers as a lifted block does and changes nothing, so the answer
 * never says whether it exists.
 */
async function unblockAccount(deps: ServerDeps, account: string, other: string): Promise<PairAnswer<Blocked>> {
  if (other === account || !(await deps.stores.moderation.unblock(account, other))) return { status: 200, body: { ok: true } };
  const me = await characterOf(deps, account);
  const them = await characterOf(deps, other);
  const answer = me === null || them === null || me === them ? null : await unblockRecord(deps, me, them);
  return answer ?? { status: 200, body: { ok: true } };
}

/** moderation:block-ends-pair-records, moderation:blocked-list-in-settings: the block lifted, and nothing restored: a new invite is needed. */
export async function unblock(deps: ServerDeps, account: string, body: unknown): Promise<PairAnswer<Blocked>> {
  const other = field(body, "account");
  if (other !== null) return unblockAccount(deps, account, other);
  const me = await characterOf(deps, account);
  if (me === null) return refused(404, "no-character", "This account has no character yet.");
  const them = await targetOf(deps, me, body);
  const theirs = them === null ? null : await accountOfCharacter(deps, them);
  if (them === null || theirs === null) return refused(404, "unknown-id", "There is no such player.");
  await deps.stores.moderation.unblock(account, theirs.id);
  return (await unblockRecord(deps, me, them)) ?? { status: 200, body: { ok: true } };
}

/** moderation:blocked-list-in-settings: every account the player has blocked, newest first, each named in one read of the accounts. */
export async function blockedList(deps: ServerDeps, account: string): Promise<BlockedList> {
  const rows = await deps.stores.moderation.blocksBy(account);
  const usernames = await deps.stores.account.usernames(rows.map((row) => row.to));
  return { ok: true, blocked: rows.map((row) => ({ account: row.to, username: usernames.get(row.to) ?? null, at: row.at })) };
}

/** Sets or clears `held` on a record, touching no life (pair:report-holds-conversation). */
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

/** moderation:report-offers-block: the refusal when the account has filed `reportsPerDay` reports in the last day, else null. */
async function overLimit(deps: ServerDeps, account: string): Promise<PairAnswer<Reported> | null> {
  // A report exactly a day old no longer counts, as a phrase exactly an hour old does not (pair:phrase-checks-before-send).
  if ((await deps.stores.moderation.filedSince(account, deps.now() - time.DAY_MS + 1)) < deps.config.moderation.reportsPerDay) return null;
  return { status: 429, body: { ok: false, code: "rate-limited", detail: "Too many reports today.", retryAfter: time.DAY_S } };
}

function reportId(deps: ServerDeps): string {
  return `report-${toHex(deps.randomBytes(REPORT_BYTES))}`;
}

/**
 * pair:report-holds-conversation, moderation:report-carries-subject-and-reason, moderation:report-offers-block, moderation:reports-hold-cited-records: a report
 * on a pair, citing the pair or messages of its conversation. The record is
 * held until a moderator decides; the reporter may block in the same step.
 */
async function pairReport(deps: ServerDeps, account: string, reason: ReportReason, key: string, messages: string[], alsoBlock: boolean): Promise<PairAnswer<Reported>> {
  const found = await readable(deps, account, key);
  if (found === null) return refused(404, "unknown-id", "There is no such pair.");
  const rows = await deps.stores.conversation.byIds(messages);
  if (rows.length !== messages.length || rows.some((row) => row.conversation !== key)) return refused(400, "not-legal", "Every cited message must be in this pair's conversation.");
  const subject = await accountOfCharacter(deps, found.record[found.side === "a" ? "b" : "a"]);
  const now = deps.now();
  const id = reportId(deps);
  const filed = await deps.stores.moderation.report(
    { id, reporter: account, subject: { account: subject?.id ?? "" }, reason, cites: messages.length > 0 ? { messages } : { pair: key }, pair: key, unverified: false, at: now },
    { messages, pair: key, until: now + deps.config.moderation.holdDays * time.DAY_MS },
  );
  if (!filed.ok) throw new Error(`The report ${id} was refused: ${filed.detail}`);
  await holdRecord(deps, key, true);
  if (alsoBlock) {
    const blocked = await block(deps, account, { pair: key });
    if (!blocked.body.ok) return { status: blocked.status, body: blocked.body };
  }
  return { status: 200, body: { ok: true, report: id } };
}

/** The account a report names, found from what it cites where the client cannot know it, or why it is refused. */
type Found = { ok: true; subject: ReportSubject } | { ok: false; answer: PairAnswer<Reported> };

/**
 * moderation:report-from-every-surface, moderation:report-carries-subject-and-reason: the subject of a report that cites no
 * pair. A card names its inviter, looked up from the code; an advert names its
 * campaign, which must run in the slot cited; a phrase heard in a place names
 * a place and a phrase of the content.
 */
async function subjectOf(deps: ServerDeps, account: string, input: ReportInput, cite: Exclude<ReportCite, { messages: string[] } | { pair: string }>): Promise<Found> {
  const current = deps.contents.current;
  if ("card" in cite) {
    const invite = await deps.stores.invite.get(cite.card);
    if (invite === null) return { ok: false, answer: refused(404, "unknown-id", "There is no such card.") };
    if (invite.account === account) return { ok: false, answer: refused(400, "not-legal", "A card cannot be reported by the one who made it.") };
    return { ok: true, subject: { account: invite.account } };
  }
  if ("campaign" in cite) {
    if (input.subject !== null && !("campaign" in input.subject && input.subject.campaign === cite.campaign)) return { ok: false, answer: refused(400, "not-legal", "An advert's report names the campaign it cites.") };
    const campaign = await deps.stores.adverts.campaign(cite.campaign);
    if (campaign === null || !Object.hasOwn(current.advert, cite.slot) || !(campaign.slots as readonly string[]).includes(cite.slot)) return { ok: false, answer: refused(404, "unknown-id", "There is no such advert in that slot.") };
    return { ok: true, subject: { campaign: campaign.id } };
  }
  // pair:place-phrases-not-stored: only a phrase marked for places can be said in one.
  const phrase = Object.hasOwn(current.phrase, cite.phrase) ? current.phrase[cite.phrase as Id<"phrase">] : undefined;
  if (!Object.hasOwn(current.place, cite.place) || phrase === undefined || phrase.where === "conversation") return { ok: false, answer: refused(404, "unknown-id", "There is no such phrase said in that place.") };
  if (cite.at > deps.now()) return { ok: false, answer: refused(400, "not-legal", "A phrase cannot be heard after the report.") };
  // Presence carries no account (city:players-shown-present-not-tracked), so the client cannot know the speaker's: an account the body
  // names is never taken, or a report could name anyone it never met. The subject is blank for the moderator to find.
  return { ok: true, subject: { account: "" } };
}

/** The cite form `{ subject?, reason, cites }` (moderation:report-carries-subject-and-reason): a card, an advert, a phrase heard in a place, or a pair or its messages. */
async function citeReport(deps: ServerDeps, account: string, body: unknown): Promise<PairAnswer<Reported>> {
  const read = readReport(body);
  if (!read.ok) return refused(400, "not-legal", read.detail);
  const input = read.report;
  const cite = input.cites;
  const limited = await overLimit(deps, account);
  if (limited !== null) return limited;
  if ("pair" in cite) return pairReport(deps, account, input.reason, cite.pair, [], false);
  if ("messages" in cite) {
    const rows = await deps.stores.conversation.byIds(cite.messages);
    const key = rows[0]?.conversation;
    if (key === undefined) return refused(404, "unknown-id", "There is no such message.");
    return pairReport(deps, account, input.reason, key, cite.messages, false);
  }
  const found = await subjectOf(deps, account, input, cite);
  if (!found.ok) return found.answer;
  const now = deps.now();
  const id = reportId(deps);
  const filed = await deps.stores.moderation.report(
    { id, reporter: account, subject: found.subject, reason: input.reason, cites: cite, pair: null, unverified: input.unverified, at: now },
    { messages: [], pair: null, until: now + deps.config.moderation.holdDays * time.DAY_MS },
  );
  if (!filed.ok) throw new Error(`The report ${id} was refused: ${filed.detail}`);
  return { status: 200, body: { ok: true, report: id } };
}

/**
 * `POST /api/moderation/report` (moderation:report-from-every-surface, moderation:report-carries-subject-and-reason, moderation:report-offers-block): the pair form
 * `{ pair, reason, messages?, block? }`, or the cite form `{ subject?, reason,
 * cites }` read by `readReport`, told apart by `cites`. Either way at most
 * `config.moderation.reportsPerDay` a day, each held at most `holdDays`.
 */
export async function report(deps: ServerDeps, account: string, body: unknown): Promise<PairAnswer<Reported>> {
  if (typeof body === "object" && body !== null && "cites" in body) return citeReport(deps, account, body);
  const reason = field(body, "reason");
  const key = field(body, "pair");
  const messages = messagesOf(body);
  if (reason === null || !REPORT_REASONS.includes(reason as ReportReason)) return refused(400, "not-legal", "Choose a reason from the list.");
  if (key === null || messages === null) return refused(400, "not-legal", "A report cites the pair, and for a conversation its message ids.");
  const limited = await overLimit(deps, account);
  if (limited !== null) return limited;
  return pairReport(deps, account, reason as ReportReason, key, messages, (body as { block?: unknown }).block === true);
}

/**
 * moderation:reporter-told-outcome-only, moderation:reports-hold-cited-records: for the moderation admin view.
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
