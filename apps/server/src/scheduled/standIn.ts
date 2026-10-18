// The stand-in's clock (person:stand-in-after-absence, person:stand-in-acts-narrowly and person:computers-need-no-stand-in), on the daily cron. A
// player side of a pair idle for `warnDays` real days is warned to the other
// life; at `standInDays` the stand-in is on, and then it answers the absent
// side's interview and the joint step the absent side allowed. Idle runs from
// the character's last command sent by its player (`LogRow.at`); the
// player's next command turns the stand-in off (pair/carry.ts).
import type { PairRecord, Side } from "@japacity/sim";
import { flip, time } from "@japacity/sim";

import type { Live } from "../authority/load";
import type { Turn } from "../authority/transaction";
import type { ServerDeps } from "../deps";
import type { Book } from "../pair/book";
import { carry } from "../pair/carry";
import { openBond, pairStep, sendTo, sideLive } from "../pair/step";

/** How many log rows the first look back covers; each further look covers four times as many. */
const FIRST_LOOK = 64;
const WIDER = 4;

/** person:stand-in-after-absence: when the character's player last sent a command, or when its account was made if never. */
export async function lastPlayerAt(deps: ServerDeps, character: string): Promise<number | null> {
  const held = await deps.stores.player.load(character);
  if (held === null) return null;
  const v = held.character.v;
  let span = FIRST_LOOK;
  for (;;) {
    const after = Math.max(0, v - span);
    const rows = await deps.stores.player.log(character, after);
    const last = rows.filter((row) => row.sender === "player").at(-1);
    if (last !== undefined) return last.at;
    if (after === 0) break;
    span *= WIDER;
  }
  return (await deps.stores.account.get(held.character.account))?.createdAt ?? null;
}

/** person:stand-in-after-absence: the stage an idle time calls for. */
export function stageFor(idleMs: number, numbers: { warnDays: number; standInDays: number }): "warned" | "on" | null {
  if (idleMs >= numbers.standInDays * time.DAY_MS) return "on";
  if (idleMs >= numbers.warnDays * time.DAY_MS) return "warned";
  return null;
}

/**
 * person:stand-in-acts-narrowly: what the stand-in does in the absent life: answers its open
 * interview, giving on a question about plans the waiting side's answer where
 * it is in, and says yes to a joint the absent side allowed. Each is carried
 * like a player's command, sent by `stand-in`.
 */
function standInActs(book: Book, turn: Turn, lives: readonly Live[], record: PairRecord, absent: Side): { ok: false; code: "not-legal"; detail: string } | null {
  const live = sideLive(lives, record, absent);
  if (live === null) return null;
  const act = (order: Parameters<typeof sendTo>[2]) => {
    const before = live.state;
    const sent = sendTo(turn, live, order, "stand-in");
    return sent.ok ? carry({ book, turn, lives }, live, before, sent.events, "stand-in") : null;
  };
  const open = live.state.interview.open;
  if (open !== null && open.pair === record.id) {
    const waiting = record.interview?.answers[flip(absent)] ?? null;
    for (let index = open.answers.length; index < open.questions.length; index += 1) {
      const asked = open.questions[index];
      if (asked === undefined) break;
      const failed = act({ type: "interview/answer", question: asked.id, option: waiting?.[index] ?? asked.options[0] ?? "" });
      if (failed !== null) return { ok: false, code: "not-legal", detail: failed.detail };
    }
  }
  const bond = openBond(live.state, record.id);
  if (bond !== null && bond[1].pending.theirs?.step === "joint" && live.state.people.joint?.bond === bond[0] && live.state.people.joint.standInMay) {
    const failed = act({ type: "people/answer", bond: bond[0], step: "joint", yes: true });
    if (failed !== null) return { ok: false, code: "not-legal", detail: failed.detail };
  }
  return null;
}

/** person:stand-in-after-absence, person:stand-in-acts-narrowly and person:computers-need-no-stand-in: one pass over every pair two players share; answers how many records it moved. */
export async function standInJob(deps: ServerDeps): Promise<number> {
  const numbers = deps.contents.current.tuning.people;
  let moved = 0;
  for (const key of await deps.stores.invite.pairs()) {
    const row = await deps.stores.pair.get(key);
    const stored = row === null ? null : (row.record as PairRecord);
    if (stored === null || stored.ended !== null) continue;
    for (const absent of ["a", "b"] as const) {
      const character = stored[absent];
      const last = character === "" ? null : await lastPlayerAt(deps, character);
      if (last === null) continue;
      const stage = stageFor(deps.now() - last, numbers);
      // Only a change, or a stand-in on with something to answer, needs the two lives.
      if (stage === null || (stage === "warned" && stored.standIn[absent] === "warned")) continue;
      const outcome = await pairStep(deps, key, ({ book, turn, lives }) => {
        const record = book.get(key);
        if (record === null || record.ended !== null) return { ok: true, value: false };
        const changes = record.standIn[absent] !== stage;
        if (changes) {
          const waiting = sideLive(lives, record, flip(absent));
          if (waiting !== null) {
            const told = sendTo(turn, waiting, { type: "people/stand-in", pair: key, stage });
            if (!told.ok) return told;
          }
          book.write(key, absent, { type: "pair/stand-in-changed", stage });
        }
        const acted = stage === "on" ? standInActs(book, turn, lives, book.get(key) ?? record, absent) : null;
        return acted ?? { ok: true, value: changes };
      });
      if (outcome.kind === "done" && outcome.value) moved += 1;
    }
  }
  return moved;
}
