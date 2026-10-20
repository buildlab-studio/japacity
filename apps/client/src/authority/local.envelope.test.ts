import type { Command, Id, PlayerView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { nextGameMorning } from "@japacity/sim";

import { localAuthority } from "./local";
import { MORNING_KEY, SAVE_KEY } from "../shared/kept/storage";
import { removableStorage } from "../shared/testing/storage";

const ENGLISH: Id<"document"> = "document.english-test";

/** A moment in Lagos (UTC+1) on a day of October 2026. */
const lagos = (day: number, hour: number, minute = 0) => Date.UTC(2026, 9, day, hour - 1, minute);

const seeds = () => {
  let n = 0;
  return () => `seed-${String((n += 1))}`;
};

const english = (view: PlayerView) => view.documents.find((entry) => entry.id === ENGLISH);

type Loose = Command extends infer C ? (C extends unknown ? Omit<C, "basedOn"> : never) : never;

async function send(authority: ReturnType<typeof localAuthority>, command: Loose) {
  const view = await authority.view();
  const reply = await authority.send({ ...command, basedOn: view.v });
  if (!reply.ok) throw new Error(`${command.type} was rejected: ${reply.code} ${reply.detail}`);
  return reply;
}

/** The nurse, who holds a passport, sits the English test and ends the month at nine in the evening. */
async function testSat(storage: ReturnType<typeof removableStorage>, at: { now: number }) {
  const authority = localAuthority({ fastClock: true, storage, makeSeed: seeds(), now: () => at.now, scenario: "scenario.nurse" });
  await authority.newLife("scenario.nurse");
  await send(authority, { type: "activity/now", activity: "activity.sit-english-test", param: null });
  expect(english(await authority.view())?.state).toBe("pending");
  const turned = await send(authority, { type: "turn/end", slots: [] });
  return { authority, turned };
}

describe("envelopes in the local authority", () => {
  test("[clock:envelopes-show-real-waits] given the English test sat and the month ended in the evening, when the view and the lines are read, then the result is sealed until seven the next morning and a reload keeps it sealed", async () => {
    const storage = removableStorage();
    const at = { now: lagos(11, 21) };
    const { authority, turned } = await testSat(storage, at);
    expect(english(turned.view)).toMatchObject({ state: "pending", readyMonth: turned.view.month });
    expect(turned.lines.some((line) => line.key.startsWith("line.document.issued") && line.params.document === ENGLISH)).toBe(false);
    // Decision 0011: the morning is the world's own, the next six o'clock of the game's day.
    expect(authority.clock().morningAt).toBe(nextGameMorning(at.now));
    expect(authority.morning()).toEqual([]);

    const again = localAuthority({ fastClock: true, storage, makeSeed: seeds(), now: () => at.now });
    expect(again.start).toEqual({ kind: "loaded" });
    expect(english(await again.view())?.state).toBe("pending");
    expect((JSON.parse(storage.items.get(SAVE_KEY)!) as { envelopes: unknown[] }).envelopes).toHaveLength(1);
  });

  test("[clock:envelopes-show-real-waits] given the morning has come, when the view is read, then the result stands, the morning gives the envelope and its line once, and the save lets it go", async () => {
    const storage = removableStorage();
    const at = { now: lagos(11, 21) };
    await testSat(storage, at);
    const morningAt = nextGameMorning(lagos(11, 21));
    at.now = morningAt + 60_000;
    const morning = localAuthority({ fastClock: true, storage, makeSeed: seeds(), now: () => at.now });
    expect(english(await morning.view())).toMatchObject({ state: "held" });
    const opened = morning.morning();
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatchObject({ kind: "document", id: ENGLISH, opensAt: morningAt });
    expect(opened[0]?.held.some((line) => line.key.startsWith("line.document.issued"))).toBe(true);
    expect(morning.morning()).toEqual([]);
    expect((JSON.parse(storage.items.get(SAVE_KEY)!) as { envelopes: unknown[] }).envelopes).toEqual([]);
  });

  test("[clock:envelopes-show-real-waits] given the dev switch, when the envelopes are read in the evening, then they open at once", async () => {
    const storage = removableStorage();
    const at = { now: lagos(11, 21) };
    const { authority } = await testSat(storage, at);
    storage.setItem(MORNING_KEY, "now");
    expect(english(await authority.view())).toMatchObject({ state: "held" });
    expect(authority.morning()).toHaveLength(1);
  });
});
