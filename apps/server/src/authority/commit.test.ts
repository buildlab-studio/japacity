import { time } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { activeOn } from "../ops/active";
import { listAlarms } from "../ops/alarm";
import { utcDay } from "../ops/day";
import { moneyJob } from "../jobs/money";
import type { ServerReply } from "../types";
import { held, newLife, restMonth, send, testServer, view } from "./authority.testing";

function accepted(reply: ServerReply): Extract<ServerReply, { ok: true }> {
  if (!reply.ok) throw new Error(`Rejected with ${reply.code}: ${reply.detail}`);
  return reply;
}

describe("what follows a commit", () => {
  test("[R-SERVER-011] [R-SERVER-002] given a character that plays a month on one day and another on the next, when each commits, then the mark sits on the commit's day and the first day's month is closed into the first day's totals by the second day's first commit, the second day's own month waiting for its close", async () => {
    const server = testServer();
    const character = await newLife(server, "acc-1");
    const first = utcDay(server.deps.now());
    // Under decision 0013 a month at home charges no living as it turns, so a month rested with no job moves no money and
    // the day's totals would not change; the first day's month eats a meal, paid at once, so money moves that day. The
    // family house's pot is free, so the meal is one of your own, bought.
    accepted((await send(server, "acc-1", { type: "activity/now", activity: "activity.cook-own", param: null, basedOn: 0 })).body);
    accepted((await send(server, "acc-1", restMonth({ v: 1 }))).body);
    const marked = await server.deps.stores.ledger.mark(character);
    expect(marked?.day).toBe(first);
    expect(activeOn(server.deps, first)).toEqual([character]);
    // The first mark brings what the character held when it was loaded into the day.
    const open = await server.deps.stores.ledger.day(first);

    server.wait(time.DAY_MS);
    const { v } = (await held(server, character)).character;
    accepted((await send(server, "acc-1", restMonth({ v }))).body);

    expect((await server.deps.stores.ledger.mark(character))?.day).toBe(first + 1);
    expect(await server.deps.stores.ledger.day(first)).not.toEqual(open);
    const second = await server.deps.stores.ledger.day(first + 1);
    expect(Object.keys(second.created).length + Object.keys(second.destroyed).length).toBe(0);
  });

  test("[R-SERVER-011] given a day log that names the day's characters, when the money job runs in an isolate that never saw them commit, then it closes their day from the log", async () => {
    const played = testServer();
    const character = await newLife(played, "acc-1");
    accepted((await send(played, "acc-1", restMonth({ v: 0 }))).body);
    const day = utcDay(played.deps.now());
    played.wait(time.DAY_MS);
    // A fresh ledger store stands for another isolate: its in-memory list is empty.
    const elsewhere = { ...played.deps, stores: { ...played.deps.stores, ledger: { ...played.deps.stores.ledger } } };
    expect(activeOn(elsewhere, day)).toEqual([]);
    const asked: [number, number][] = [];
    const report = await moneyJob(elsewhere, {
      active: (start, end) => {
        asked.push([start, end]);
        return Promise.resolve([character]);
      },
    });
    expect(asked).toEqual([[day * time.DAY_MS, (day + 1) * time.DAY_MS]]);
    expect(report.characters).toEqual([character]);
    expect(report.closed).toEqual([character]);
    expect((await played.deps.stores.ledger.mark(character))?.day).toBe(day + 1);
  });

  test("[R-SERVER-003] [R-SERVER-012] given a character whose log no longer replays, when it is loaded twice, then the diverged alarm is raised once for its version", async () => {
    const server = testServer();
    const broken = await newLife(server, "acc-1");
    accepted((await send(server, "acc-1", restMonth({ v: 0 }))).body);
    const [row] = (await held(server, broken)).tail;
    if (row === undefined) throw new Error("No row.");
    await server.deps.stores.player.transact([broken], () => ({ writes: { characters: [{ id: broken, append: [{ ...row, v: 2, command: restMonth({ v: 1 }), hash: "0000000000000000" }] }] }, result: null }));

    for (let attempt = 0; attempt < 2; attempt += 1) expect((await view(server, "acc-1")).body).toMatchObject({ ok: false, code: "diverged" });

    expect(await listAlarms(server.deps)).toEqual([{ kind: "diverged", day: utcDay(server.deps.now()), character: broken, v: 2 }]);
  });
});
