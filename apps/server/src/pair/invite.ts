// Invite links (pair.md R-PAIR-007, R-PAIR-008, R-PAIR-018; people.md
// R-PEOPLE-010, R-PEOPLE-011): a single-use code for the slot a card names,
// the card read by anyone with the link, and the accept that makes the record.
import type { Id, InviteCard, PairRecord, PairView, ReadCtx, State } from "@japacity/sim";
import { factsOf, inviteCard, inviteExpires, mayOpenInvite, mayPair, newRecord, pairId, pairView, useInvite } from "@japacity/sim";
import type { InviteMilestone, InviteRow } from "@japacity/store";

import { newCharacter } from "../authority/character";
import { characterOf } from "../authority/command";
import { transact } from "../authority/transaction";
import type { ServerDeps } from "../deps";
import type { PairAnswer, PairRejection } from "./codes";
import { asRefusal, NOT_POSSIBLE, refused, widen } from "./codes";
import { interactionOf } from "./region";
import { silenced } from "./restricted";
import { milestonesOf } from "./rewards";
import { pairStep, sendTo, unusual } from "./step";

const CODE_BYTES = 12;
/** R-PEOPLE-008: a partner is an adult with the prologue behind them. */
const ADULT_MONTHS = 216;
const AGE: Id<"quality"> = "quality.age-months";
const PROLOGUE: Id<"scenario"> = "scenario.prologue";

/** `POST /api/invite`: the link made for a card. */
export interface InviteMade {
  ok: true;
  code: string;
  slot: string;
  expires: number;
  card: InviteCard;
}

/** `GET /api/invite/:code`: what the link shows, before sign-up. */
export interface InviteShown {
  ok: true;
  slot: string;
  looking: "partner" | "sibling";
  expires: number;
  card: InviteCard;
}

/** `POST /api/invite/:code/accept`: the pair made, as the friend sees it. */
export interface InviteAccepted {
  ok: true;
  pair: string;
  character: string;
  view: PairView | null;
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isLooking(looking: string | undefined): looking is "partner" | "sibling" {
  return looking === "partner" || looking === "sibling";
}

/** A body's string field, or null. */
export function field(body: unknown, name: string): string | null {
  if (typeof body !== "object" || body === null) return null;
  const value = (body as Record<string, unknown>)[name];
  return typeof value === "string" && value !== "" ? value : null;
}

/** The character's state as it stands now, after the same load and grant a view makes. */
async function stateOf(deps: ServerDeps, character: string): Promise<ReadCtx | null> {
  const outcome = await transact(deps, [character], (lives) => {
    const live = lives[0];
    return live === undefined ? { ok: false, code: "unknown-id", detail: character } : { ok: true, value: { state: live.state, content: live.content } };
  });
  return outcome.kind === "done" ? { ...outcome.value, world: outcome.world } : null;
}

/**
 * R-PAIR-007, R-PAIR-008: a link for the card the character's `people/invite`
 * put out on `slot`. The card's link already out is answered again; a new one
 * needs fewer than `maxOpenInvites` open, and an account whose region allows
 * no contact gets none (R-REGION-002).
 */
export async function makeInvite(deps: ServerDeps, account: string, body: unknown): Promise<PairAnswer<InviteMade>> {
  const slot = field(body, "slot");
  if (slot === null) return refused(400, "not-legal", "Name the slot the card is for.");
  const paused = await silenced(deps, account);
  if (paused !== null) return paused;
  const row = await deps.stores.account.get(account);
  if (row?.character === null || row === null) return refused(404, "no-character", "This account has no character yet.");
  if (interactionOf(deps, row) === "none") return refused(200, "region", "Players here meet computer characters only.");
  const read = await stateOf(deps, row.character);
  if (read === null) return refused(409, "diverged", "This character is being checked.");
  const held = read.state.people.slots[slot];
  if (held?.state !== "invited" || held.invite === null || !isLooking(held.invite.looking)) return refused(200, "not-legal", `No card is out for ${slot}. Send people/invite first.`);
  const now = deps.now();
  const open = await deps.stores.invite.open(row.character, now);
  const out = open.find((each) => each.slot === slot);
  if (out !== undefined) return { status: 200, body: { ok: true, code: out.code, slot, expires: out.expires, card: out.card as InviteCard } };
  const tuning = read.content.tuning.pair;
  if (!mayOpenInvite(open.length, tuning)) return refused(200, "too-many", `At most ${String(tuning.maxOpenInvites)} cards may be out at once.`);
  const card = inviteCard(read, slot);
  if (card === null) return refused(200, "not-legal", `The card on ${slot} is off the fixed lists.`);
  const code = hex(deps.randomBytes(CODE_BYTES));
  const expires = inviteExpires(now, tuning);
  const made = await deps.stores.invite.create({ code, from: row.character, account, slot, looking: held.invite.looking, fill: held.invite.fill, card, madeAt: now, expires });
  if (!made.ok) throw new Error(`A new link code was refused: ${made.detail}`);
  return { status: 200, body: { ok: true, code, slot, expires, card } };
}

/** R-PAIR-007: what anyone holding the link sees: the card, never a photo, a sum or a contact. */
export async function showInvite(deps: ServerDeps, code: string): Promise<PairAnswer<InviteShown>> {
  const row = await deps.stores.invite.get(code);
  if (row === null) return refused(404, "bad-code", "There is no such link.");
  const usable = useInvite(row, row.slot, deps.now());
  if (!usable.ok) return refused(200, usable.failed, usable.failed === "used" ? "This link has been used." : "This link has run out.");
  return { status: 200, body: { ok: true, slot: row.slot, looking: row.looking, expires: row.expires, card: row.card as InviteCard } };
}

/** R-PEOPLE-008: a partner must be an adult whose prologue is over. */
function adult(state: State): boolean {
  return !state.prologue.open && (state.quality[AGE] ?? 0) >= ADULT_MONTHS;
}

/** The friend's character for the link: a sibling is always a new life (R-PEOPLE-011); a partner is the friend's own, or a new one in `scenario`. */
async function friendFor(deps: ServerDeps, account: string, invite: InviteRow, scenario: string | null): Promise<{ ok: true; character: string } | PairAnswer<never>> {
  const existing = await characterOf(deps, account);
  if (invite.looking === "sibling") {
    if (existing !== null) return refused(409, "one-character", "An existing character never becomes anyone's sibling. A sibling link starts a new life.");
    // R-PEOPLE-011, decision 0009: the new life takes the inviter's family draw.
    // an inviter from a fixed scenario, or before its prologue's family step, has no draw; the new life then draws its own and no sibling slot waits for the link.
    const draw = (await stateOf(deps, invite.from))?.state.prologue.draw ?? null;
    const made = await newCharacter(deps, account, PROLOGUE, draw === null ? undefined : { from: invite.from, draw });
    if (!made.body.ok) return asRefusal(made);
  } else if (existing === null) {
    if (scenario === null) return refused(400, "not-legal", "Name the scenario of the new character, or make one first.");
    const made = await newCharacter(deps, account, scenario as Id<"scenario">);
    if (!made.body.ok) return asRefusal(made);
  }
  const character = await characterOf(deps, account);
  if (character === null) throw new Error(`${account} has no character after it was made.`);
  return { ok: true, character };
}

/** The checks on the two accounts before any life is touched (R-PAIR-008, R-PAIR-015, R-PAIR-018). */
async function mayAccept(deps: ServerDeps, account: string, invite: InviteRow): Promise<PairRejection | null> {
  const friend = await deps.stores.account.get(account);
  if (friend === null) return { ok: false, code: "signed-out", detail: "Sign in again to accept." };
  if (!friend.age.passed) return { ok: false, code: "under-age", detail: "This account has not passed the age screen." };
  if (friend.id === invite.account) return { ok: false, code: "not-legal", detail: "A card cannot be taken by the one who sent it." };
  const inviter = await deps.stores.account.get(invite.account);
  const tuning = deps.contents.current.tuning;
  if (!mayPair("invited", { a: interactionOf(deps, inviter), b: interactionOf(deps, friend) }, tuning)) {
    return { ok: false, code: "region", detail: "Players here may not be paired." };
  }
  if (await deps.stores.moderation.blocked(invite.account, account)) return { ok: false, code: "not-possible", detail: NOT_POSSIBLE };
  return null;
}

/**
 * R-PAIR-008, R-PEOPLE-010, R-PEOPLE-011: takes the link for the slot it was
 * made for, after sign-up and the age screen. Both lives are locked in one
 * transaction: the record made at `connected` (or an ended one relinked), the
 * friend's partner slot opened and linked, and `people/link` sent to the
 * inviter's life. The link is used only once the pair is made.
 */
export async function acceptInvite(deps: ServerDeps, account: string, code: string, body: unknown): Promise<PairAnswer<InviteAccepted>> {
  const slot = field(body, "slot");
  if (slot === null) return refused(400, "not-legal", "Name the slot the card offers.");
  const paused = await silenced(deps, account);
  if (paused !== null) return paused;
  const invite = await deps.stores.invite.get(code);
  if (invite === null) return refused(404, "bad-code", "There is no such link.");
  const usable = useInvite(invite, slot, deps.now());
  if (!usable.ok) return refused(200, usable.failed, `The link cannot be used: ${usable.failed}.`);
  const refusedEarly = await mayAccept(deps, account, invite);
  if (refusedEarly !== null) return { status: refusedEarly.code === "signed-out" ? 401 : 200, body: refusedEarly };
  const friend = await friendFor(deps, account, invite, field(body, "scenario"));
  if (!("character" in friend)) return friend;
  if (friend.character === invite.from) return refused(200, "not-legal", "A character cannot pair with itself.");
  const key = pairId(invite.from, friend.character);

  const outcome = await pairStep<{ record: PairRecord; before: InviteMilestone[] }>(
    deps,
    key,
    ({ live, book, turn }) => {
      const inviter = live(invite.from);
      const joining = live(friend.character);
      if (inviter === null || joining === null) return { ok: false, code: "unknown-id", detail: "A character of the pair is missing." };
      const held = inviter.state.people.slots[invite.slot];
      if (held?.state !== "invited" || held.invite?.looking !== invite.looking) return { ok: false, code: "wrong-slot", detail: "The card is no longer out for this slot." };
      if (invite.looking === "partner" && !adult(joining.state)) return { ok: false, code: "not-adult", detail: "A partner link needs an adult character past the prologue." };
      const stored = book.get(key);
      const tick = turn.world.tick;
      if (stored === null) book.put(newRecord(invite.from, friend.character, invite.looking, invite.from, tick));
      else if (stored.ended === null) return { ok: false, code: "not-legal", detail: "These two are linked already." };
      else if (book.write(key, stored.a === invite.from ? "a" : "b", { type: "pair/linked", tick }).ended !== null) return { ok: false, code: "not-possible", detail: NOT_POSSIBLE };
      const before = milestonesOf(joining.state, joining.content);
      if (invite.looking === "partner") {
        // no command opens a slot in the friend's life for a link they took, so the friend's acceptance is sent as their own people/invite.
        const opened = sendTo(turn, joining, { type: "people/invite", slot: "partner", looking: "partner" }, "player");
        if (!opened.ok) return opened;
        const linked = sendTo(turn, joining, { type: "people/link", slot: "partner", pair: key, facts: factsOf(inviter.state, inviter.content, turn.world) });
        if (!linked.ok) return linked;
      }
      // R-PEOPLE-011: a sibling's new life is in its prologue, which refuses the link; carry.ts sends it when the prologue closes.
      const link = sendTo(turn, inviter, { type: "people/link", slot: invite.slot, pair: key, facts: factsOf(joining.state, joining.content, turn.world) });
      if (!link.ok) return link;
      const record = book.get(key);
      if (record === null) throw new Error(`The record ${key} was not made.`);
      return { ok: true, value: { record, before } };
    },
    { ids: [invite.from, friend.character] },
  );
  switch (outcome.kind) {
    case "done": {
      const used = await deps.stores.invite.use(code, { by: friend.character, pair: key, at: outcome.at, before: outcome.value.before });
      if (!used.ok) throw new Error(`The link ${code} made the pair ${key} and was then refused: ${used.detail}`);
      return { status: 200, body: { ok: true, pair: key, character: friend.character, view: pairView(outcome.value.record, friend.character) } };
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

/** `GET /api/invite`: the character's open links and the rewards its friends have earned it (R-PAIR-009). */
export interface InvitesListed {
  ok: true;
  open: { code: string; slot: string; expires: number }[];
  rewards: { reached: InviteMilestone; frame: string; line: string; at: number }[];
}

export async function listInvites(deps: ServerDeps, account: string): Promise<PairAnswer<InvitesListed>> {
  const character = await characterOf(deps, account);
  if (character === null) return refused(404, "no-character", "This account has no character yet.");
  const open = await deps.stores.invite.open(character, deps.now());
  const rewards = await deps.stores.invite.rewards(character);
  return {
    status: 200,
    body: {
      ok: true,
      open: open.map((row) => ({ code: row.code, slot: row.slot, expires: row.expires })),
      // The friend is never named: a reward is a frame and a line (R-PAIR-009).
      rewards: rewards.map((row) => ({ reached: row.reached, frame: row.frame, line: row.line, at: row.at })),
    },
  };
}
