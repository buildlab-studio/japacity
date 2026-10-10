import { content } from "@japacity/content";
import { factsOf, stableJson } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { pairStep } from "./step";
import { act, bondIn, courting, FRIEND, INVITER, lastBondIn, linkedPair, married, must, pairServer, partners, quickWeddings, recordOf, sayFrom, stateOf } from "./pair.testing";

const STANDING = "quality.standing";
const WELLBEING = "quality.wellbeing";

describe("the pair transaction", () => {
  test("[R-PAIR-001] [R-PEOPLE-003] given two pair steps asking for the two characters in opposite orders at once, when both run, then both commit in turn and the record holds both writes at version 3", async () => {
    const { server, a, b, key } = await linkedPair();

    const [first, second] = await Promise.all([
      pairStep(server.deps, key, ({ book }) => (book.write(key, "a", { type: "pair/moment-added", kind: "said", spot: null, what: "phrase.hello", tick: 0 }), { ok: true, value: "a first" }), { ids: [b, a] }),
      pairStep(server.deps, key, ({ book }) => (book.write(key, "b", { type: "pair/moment-added", kind: "said", spot: null, what: "phrase.thanks", tick: 0 }), { ok: true, value: "b second" }), { ids: [a, b] }),
    ]);

    expect([first.kind, second.kind]).toEqual(["done", "done"]);
    const stored = await recordOf(server.deps, key);
    expect(stored?.v).toBe(3);
    expect(stored?.record.moments.map((moment) => [moment.n, moment.by, moment.what])).toEqual([
      [1, "a", "phrase.hello"],
      [2, "b", "phrase.thanks"],
    ]);
  });

  test("[R-PAIR-001] given both players saying a phrase at the same moment, when the two requests run together, then both are stored and each life holds both moments, whichever locked first", async () => {
    const { server, a, b, key } = await linkedPair();

    const said = await Promise.all([sayFrom(server, FRIEND, key, "phrase.thanks"), sayFrom(server, INVITER, key, "phrase.hello")]);

    expect(said.map((each) => each.ok)).toEqual([true, true]);
    const record = (await recordOf(server.deps, key))?.record;
    expect(record?.moments.map((moment) => moment.what).sort()).toEqual(["phrase.hello", "phrase.thanks"]);
    for (const character of [a, b]) {
      const state = await stateOf(server, character);
      expect(state.people.bonds[bondIn(state, key)]?.moments.map((moment) => moment.what).sort()).toEqual(["phrase.hello", "phrase.thanks"]);
    }
  });

  test("[R-PAIR-005] [R-PEOPLE-016] given a proposal from one side alone, when it is sent, then the other life holds it as theirs in its own terms and nothing else changes in either life or the record", async () => {
    const linked = await linkedPair();
    const { server, a, b, key } = linked;
    await courting(linked);

    await must(server, INVITER, { type: "people/propose", bond: bondIn(await stateOf(server, a), key), step: "partner" });

    const friend = await stateOf(server, b);
    expect(friend.people.bonds[bondIn(friend, key)]).toMatchObject({ stage: "courting", pending: { mine: null, theirs: { step: "partner", route: null, lead: null } } });
    const record = (await recordOf(server.deps, key))?.record;
    expect(record).toMatchObject({ stage: "courting" });
    expect(record?.pending[record.a === a ? "a" : "b"]).toEqual({ step: "partner", route: null, lead: null });
  });

  test("[R-PAIR-005] [R-PEOPLE-003] [R-PEOPLE-016] given a proposal, when the other side says yes, then both lives get fresh facts and then people/agreed in the same transaction, both bonds are partners, and the record clears both proposals", async () => {
    const linked = await linkedPair();
    const { server, a, b, key } = linked;

    await partners(linked);

    const record = (await recordOf(server.deps, key))?.record;
    expect(record).toMatchObject({ stage: "partner", pending: { a: null, b: null } });
    for (const character of [a, b]) {
      const state = await stateOf(server, character);
      expect(state.people.bonds[bondIn(state, key)]).toMatchObject({ stage: "partner", pending: { mine: null, theirs: null } });
      expect(state.people.slots.partner).toMatchObject({ state: "player" });
      const types = (await server.deps.stores.player.log(character, 0)).map((row) => row.command.type);
      const agreedAt = types.lastIndexOf("people/agreed");
      expect(types[agreedAt - 1]).toBe("people/facts");
    }
  });

  test("[R-PAIR-005] given both sides proposing the same step, when the second proposal arrives, then the step is agreed in both lives without an answer", async () => {
    const linked = await linkedPair();
    const { server, a, b, key } = linked;
    await courting(linked);

    await must(server, INVITER, { type: "people/propose", bond: bondIn(await stateOf(server, a), key), step: "partner" });
    await must(server, FRIEND, { type: "people/propose", bond: bondIn(await stateOf(server, b), key), step: "partner" });

    expect((await recordOf(server.deps, key))?.record.stage).toBe("partner");
    const friend = await stateOf(server, b);
    expect(friend.people.bonds[bondIn(friend, key)]?.stage).toBe("partner");
  });

  test("[R-PEOPLE-016] given a proposal, when the other side says no, then the record and the answering life clear it and no stage moves", async () => {
    const linked = await linkedPair();
    const { server, a, b, key } = linked;
    await courting(linked);
    await must(server, INVITER, { type: "people/propose", bond: bondIn(await stateOf(server, a), key), step: "partner" });

    await must(server, FRIEND, { type: "people/answer", bond: bondIn(await stateOf(server, b), key), step: "partner", yes: false });

    const record = (await recordOf(server.deps, key))?.record;
    expect(record).toMatchObject({ stage: "courting", pending: { a: null, b: null } });
    const friend = await stateOf(server, b);
    expect(friend.people.bonds[bondIn(friend, key)]?.pending.theirs).toBeNull();
  });

  test("[R-PEOPLE-016] [R-PEOPLE-034] given a proposal, when the other side says no, then the proposer's life holds no waiting proposal and its log holds people/declined from the authority", async () => {
    const linked = await linkedPair();
    const { server, a, b, key } = linked;
    await courting(linked);
    await must(server, INVITER, { type: "people/propose", bond: bondIn(await stateOf(server, a), key), step: "partner" });
    expect((await stateOf(server, a)).people.bonds[bondIn(await stateOf(server, a), key)]?.pending.mine).not.toBeNull();

    await must(server, FRIEND, { type: "people/answer", bond: bondIn(await stateOf(server, b), key), step: "partner", yes: false });

    const proposer = await stateOf(server, a);
    expect(proposer.people.bonds[bondIn(proposer, key)]?.pending.mine).toBeNull();
    const declined = (await server.deps.stores.player.log(a, 0)).filter((row) => row.command.type === "people/declined");
    expect(declined).toMatchObject([{ sender: "authority", command: { type: "people/declined", pair: key, step: "partner" } }]);
  });

  test("[R-PEOPLE-016] [R-PEOPLE-034] given a proposal waiting, when the proposer withdraws it, then the other life no longer holds it and its log holds people/withdrawn from the authority; a withdraw with nothing waiting sends nothing", async () => {
    const linked = await linkedPair();
    const { server, a, b, key } = linked;
    await courting(linked);
    await must(server, INVITER, { type: "people/propose", bond: bondIn(await stateOf(server, a), key), step: "partner" });
    expect((await stateOf(server, b)).people.bonds[bondIn(await stateOf(server, b), key)]?.pending.theirs).not.toBeNull();

    await must(server, INVITER, { type: "people/withdraw", bond: bondIn(await stateOf(server, a), key) });

    const other = await stateOf(server, b);
    expect(other.people.bonds[bondIn(other, key)]?.pending.theirs).toBeNull();
    expect((await recordOf(server.deps, key))?.record).toMatchObject({ pending: { a: null, b: null } });
    const withdrawn = (await server.deps.stores.player.log(b, 0)).filter((row) => row.command.type === "people/withdrawn");
    expect(withdrawn).toMatchObject([{ sender: "authority", command: { type: "people/withdrawn", pair: key, step: "partner" } }]);
  });

  test("[R-PEOPLE-017] [R-PAIR-004] given partners, when they marry, then both lives are married, each paid its own share, and the record holds one wedding moment", async () => {
    const linked = await linkedPair(pairServer(quickWeddings()));
    const { server, a, b, key } = linked;

    await married(linked);

    const record = (await recordOf(server.deps, key))?.record;
    expect(record?.stage).toBe("married");
    expect(record?.moments.filter((moment) => moment.kind === "wedding")).toHaveLength(1);
    for (const character of [a, b]) {
      const state = await stateOf(server, character);
      expect(state.people.bonds[bondIn(state, key)]?.stage).toBe("married");
    }
  });

  test("[R-PEOPLE-037] [R-PAIR-004] given partners, when one ends it, then the record ends by that side, the one who ended pays standing, and the other life is left with the left wellbeing and no standing cost", async () => {
    const linked = await linkedPair();
    const { server, a, b, key } = linked;
    await partners(linked);
    const before = { a: await stateOf(server, a), b: await stateOf(server, b) };

    await must(server, INVITER, { type: "people/end", bond: bondIn(before.a, key) });

    const record = (await recordOf(server.deps, key))?.record;
    expect(record?.ended).toEqual({ by: record?.a === a ? "a" : "b", tick: expect.any(Number) as number });
    const after = { a: await stateOf(server, a), b: await stateOf(server, b) };
    const numbers = content.tuning.people;
    expect(after.a.quality[STANDING]).toBe((before.a.quality[STANDING] ?? 0) + numbers.endStanding.partner);
    expect(after.b.quality[STANDING]).toBe(before.b.quality[STANDING]);
    expect(after.b.quality[WELLBEING]).toBe(Math.max(0, (before.b.quality[WELLBEING] ?? 0) + numbers.leftWellbeing));
    expect(after.b.people.bonds[lastBondIn(after.b, key)]?.ended?.by).toBe("them");
  });

  test("[R-PAIR-015] given a pair that ended, when one side courts it again, then it is refused, because only a new invite relinks the two", async () => {
    const linked = await linkedPair(pairServer());
    const { server, a, key } = linked;
    await must(server, INVITER, { type: "people/court", with: key });
    await must(server, INVITER, { type: "people/end", bond: bondIn(await stateOf(server, a), key) });
    server.wait(200 * 86_400_000);
    for (let month = 0; month < content.tuning.people.recourtMonths; month += 1) await act(server, INVITER, { type: "turn/end", slots: [] });

    const again = await act(server, INVITER, { type: "people/court", with: key });

    expect(again).toMatchObject({ ok: false, code: "not-legal" });
  });

  test("[R-PEOPLE-003] given a bonded pair, when one life's facts change with a month, then the other life is sent them in the same transaction and holds them", async () => {
    const { server, a, b, key } = await linkedPair();
    const linkedFacts = (await stateOf(server, b)).people.bonds[bondIn(await stateOf(server, b), key)]?.facts;
    server.wait(4 * 3_600_000);

    await must(server, INVITER, { type: "turn/end", slots: [] });

    const inviter = await stateOf(server, a);
    const friend = await stateOf(server, b);
    const world = (await server.deps.stores.world.latest())?.world;
    if (world === undefined) throw new Error("No world.");
    const held = friend.people.bonds[bondIn(friend, key)]?.facts;
    expect(stableJson(held)).not.toBe(stableJson(linkedFacts));
    expect(stableJson(held)).toBe(stableJson(factsOf(inviter, server.deps.contents.current, world)));
  });

  test("[R-PEOPLE-014] given a courting pair at home, when one player spends a slot seeing the other, then the moment is copied into the record and into the other life as theirs", async () => {
    const { server, a, b, key } = await linkedPair();
    await must(server, INVITER, { type: "people/court", with: key });
    await must(server, FRIEND, { type: "people/court", with: key });
    server.wait(4 * 3_600_000);

    // seeing someone is an act done at once, sent as activity/now.
    await must(server, INVITER, { type: "activity/now", activity: "activity.see-someone", param: null });

    const mine = await stateOf(server, a);
    const theirs = await stateOf(server, b);
    const met = mine.people.bonds[bondIn(mine, key)]?.moments.find((moment) => moment.kind === "met");
    if (met === undefined) throw new Error("No moment was made.");
    expect(theirs.people.bonds[bondIn(theirs, key)]?.moments).toContainEqual({ ...met, by: "them" });
    const record = (await recordOf(server.deps, key))?.record;
    expect(record?.moments).toContainEqual({ n: 1, by: record?.a === a ? "a" : "b", kind: "met", spot: met.spot, what: met.what, tick: met.tick });
  });
});
