import { content } from "@japacity/content";
import { time } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { bondIn, FRIEND, INVITER, linkedPair, must, partners, recordOf, stateOf } from "../pair/pair.testing";
import { lastPlayerAt, stageFor, standInJob } from "./standIn";

const numbers = content.tuning.people;

describe("the stand-in's clock", () => {
  test("[R-PEOPLE-043] given idle times at the edges, when the stage is worked out, then a minute short of warnDays is nothing, warnDays is warned, a minute short of standInDays is warned and standInDays is on", () => {
    const day = time.DAY_MS;
    expect(stageFor(numbers.warnDays * day - time.MINUTE_MS, numbers)).toBeNull();
    expect(stageFor(numbers.warnDays * day, numbers)).toBe("warned");
    expect(stageFor(numbers.standInDays * day - time.MINUTE_MS, numbers)).toBe("warned");
    expect(stageFor(numbers.standInDays * day, numbers)).toBe("on");
  });

  test("[R-PEOPLE-043] given partners where only the friend went quiet, when the daily job runs a minute before warnDays, at warnDays and at standInDays, then nothing changes, then the inviter's life is warned, then the stand-in is on and the slot shows it", async () => {
    const linked = await linkedPair();
    const { server, a, b, key } = linked;
    await partners(linked);
    const quiet = await lastPlayerAt(server.deps, b);
    if (quiet === null) throw new Error("No last command.");
    server.setNow(quiet + time.DAY_MS);
    await must(server, INVITER, { type: "turn/end", slots: [] });
    const friendSide = (await recordOf(server.deps, key))?.record.a === b ? "a" : "b";

    server.setNow(quiet + numbers.warnDays * time.DAY_MS - time.MINUTE_MS);
    expect(await standInJob(server.deps)).toBe(0);
    expect((await recordOf(server.deps, key))?.record.standIn[friendSide]).toBeNull();

    server.setNow(quiet + numbers.warnDays * time.DAY_MS);
    expect(await standInJob(server.deps)).toBe(1);
    let inviter = await stateOf(server, a);
    expect(inviter.people.bonds[bondIn(inviter, key)]?.standIn).toBe("warned");
    expect((await recordOf(server.deps, key))?.record.standIn[friendSide]).toBe("warned");
    expect(await standInJob(server.deps)).toBe(0);

    server.setNow(quiet + numbers.standInDays * time.DAY_MS);
    await standInJob(server.deps);
    inviter = await stateOf(server, a);
    expect(inviter.people.bonds[bondIn(inviter, key)]?.standIn).toBe("on");
    expect(inviter.people.slots.partner).toMatchObject({ state: "stand-in" });
    expect((await recordOf(server.deps, key))?.record.standIn[friendSide]).toBe("on");
  });

  test("[R-PEOPLE-043] given the stand-in on, when the absent player sends any command, then it is off in the record and the other life is told", async () => {
    const linked = await linkedPair();
    const { server, a, b, key } = linked;
    const quiet = await lastPlayerAt(server.deps, b);
    if (quiet === null) throw new Error("No last command.");
    server.setNow(quiet + numbers.standInDays * time.DAY_MS);
    await standInJob(server.deps);
    expect((await stateOf(server, a)).people.bonds[bondIn(await stateOf(server, a), key)]?.standIn).toBe("on");

    await must(server, FRIEND, { type: "people/court", with: key });

    const inviter = await stateOf(server, a);
    expect(inviter.people.bonds[bondIn(inviter, key)]?.standIn).toBeNull();
    const record = (await recordOf(server.deps, key))?.record;
    expect(record?.standIn[record.a === b ? "a" : "b"]).toBeNull();
  });

  test("[R-PEOPLE-043] given a player who only reads and is sent commands by the server, when idle is measured, then it runs from the last command the player sent", async () => {
    const { server, b, key } = await linkedPair();
    const quiet = await lastPlayerAt(server.deps, b);
    server.wait(time.DAY_MS);
    await must(server, INVITER, { type: "people/court", with: key });
    await must(server, INVITER, { type: "turn/end", slots: [] });

    expect(await lastPlayerAt(server.deps, b)).toBe(quiet);
  });

  test("[R-PEOPLE-044] [R-PEOPLE-037] given the stand-in on, when the waiting player ends the bond, then it is an absence end that costs nobody standing", async () => {
    const linked = await linkedPair();
    const { server, a, b, key } = linked;
    await partners(linked);
    const quiet = await lastPlayerAt(server.deps, b);
    if (quiet === null) throw new Error("No last command.");
    server.setNow(quiet + numbers.standInDays * time.DAY_MS);
    await standInJob(server.deps);
    const before = { a: await stateOf(server, a), b: await stateOf(server, b) };

    await must(server, INVITER, { type: "people/end", bond: bondIn(before.a, key) });

    const record = (await recordOf(server.deps, key))?.record;
    expect(record?.ended?.by).toBe("absence");
    const after = { a: await stateOf(server, a), b: await stateOf(server, b) };
    expect(after.a.quality["quality.standing"]).toBe(before.a.quality["quality.standing"]);
    expect(after.b.quality["quality.standing"]).toBe(before.b.quality["quality.standing"]);
  });
});
