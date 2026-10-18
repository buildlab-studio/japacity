import { fc, test } from "@fast-check/vitest";
import { describe, expect } from "vitest";

import type { Id, PairRecord, Proposal } from "../engine/types";
import type { PairWrite, Side } from "./pair.events";
import { agreed, newRecord, other, pairId, pairView, side, writeEvent } from "./pair.logic";
import { SKILLED } from "../testing/ids";

const ADA = "life-ada";
const TUNDE = "life-tunde";

const RECORD_KEYS = ["a", "b", "blocked", "consent", "ended", "held", "id", "interview", "invitedBy", "joint", "moments", "pending", "role", "since", "stage", "standIn"];
const MOMENT_KEYS = ["by", "kind", "n", "spot", "tick", "what"];

/** A partner record Ada opened from Tunde's invite at tick 1. */
function linked(role: PairRecord["role"] = "partner"): PairRecord {
  return newRecord(TUNDE, ADA, role, TUNDE, 1);
}

function play(record: PairRecord, ...writes: [Side, PairWrite][]): PairRecord {
  return writes.reduce((current, [from, write]) => writeEvent(current, from, write), record);
}

const propose = (step: Proposal["step"], route: Id<"route"> | null = null, lead: Proposal["lead"] = null): PairWrite => ({ type: "pair/proposed", proposal: { step, route, lead } });
const met = (tick: number): PairWrite => ({ type: "pair/moment-added", kind: "met", spot: "beach", what: "suya", tick });

/** Courting, then partners by both proposing at tick 5. */
function partners(): PairRecord {
  return play(linked(), ["a", { type: "pair/courted", tick: 2 }], ["a", met(3)], ["a", propose("partner")], ["b", propose("partner")], ["a", { type: "pair/agreed", tick: 5 }]);
}

const QUESTIONS = [
  { id: "first-spot", options: ["beach", "church"] },
  { id: "calls", options: ["few", "many"] },
];

function interviewing(): PairRecord {
  return play(partners(), ["a", { type: "pair/interview-opened", route: SKILLED, questions: QUESTIONS }]);
}

describe("the record's id and sides", () => {
  test("[pair:one-record-per-two] given two character ids in either order, when the pair id is made, then it is the two sorted and joined by a tilde", () => {
    expect(pairId(TUNDE, ADA)).toBe(`${ADA}~${TUNDE}`);
    expect(pairId(ADA, TUNDE)).toBe(`${ADA}~${TUNDE}`);
    expect(() => pairId(ADA, ADA)).toThrow();
  });

  test.prop([fc.string({ minLength: 1, maxLength: 12 }), fc.string({ minLength: 1, maxLength: 12 })])(
    "[pair:one-record-per-two] given any two different ids, when the pair id is made both ways, then it is the same",
    (x, y) => {
      fc.pre(x !== y);
      expect(pairId(x, y)).toBe(pairId(y, x));
      expect(newRecord(x, y, "partner", x, 0).id).toBe(newRecord(y, x, "partner", y, 0).id);
    },
  );

  test("[pair:one-record-per-two] given a record, when a side asks for itself and the other, then each gets its own letter and the other's id, and a stranger gets nothing", () => {
    const record = linked();
    expect([record.a, record.b]).toEqual([ADA, TUNDE]);
    expect(side(record, ADA)).toBe("a");
    expect(side(record, TUNDE)).toBe("b");
    expect(other(record, ADA)).toBe(TUNDE);
    expect(other(record, TUNDE)).toBe(ADA);
    expect(() => side(record, "life-zainab")).toThrow();
    expect(pairView(record, "life-zainab")).toBeNull();
  });
});

describe("what the record holds", () => {
  test("[pair:record-fields] given a partner link opened at tick 1, when the record is made, then it is connected with nothing pending, agreed or ended", () => {
    const record = linked();
    expect(Object.keys(record).sort()).toEqual(RECORD_KEYS);
    expect(record).toMatchObject({
      role: "partner",
      stage: "connected",
      since: { connected: 1 },
      invitedBy: "b",
      pending: { a: null, b: null },
      consent: { a: { countFunds: false, standInMay: false }, b: { countFunds: false, standInMay: false } },
      moments: [],
      joint: null,
      interview: null,
      blocked: { a: false, b: false },
      standIn: { a: null, b: null },
      ended: null,
      held: false,
    });
  });

  test("[pair:record-fields] given a sibling pair, when either side courts or proposes, then it stays connected, and it can still end", () => {
    const sibling = linked("sibling");
    expect(play(sibling, ["a", { type: "pair/courted", tick: 2 }], ["a", propose("partner")])).toEqual(sibling);
    expect(play(sibling, ["b", { type: "pair/ended", absence: false, tick: 3 }]).stage).toBe("ended");
  });

  test("[pair:record-holds-no-personal-data] given a moment and a proposal carrying extra fields, when written, then the record keeps only the contract's fields", () => {
    const sneaky = { type: "pair/moment-added", kind: "met", spot: "beach", what: "suya", tick: 3, amount: 500_000, phone: "08000000000" } as PairWrite;
    const offer = { type: "pair/proposed", proposal: { step: "partner", route: null, lead: null, money: 1 } } as PairWrite;
    const record = play(linked(), ["a", { type: "pair/courted", tick: 2 }], ["a", sneaky], ["b", offer]);
    expect(Object.keys(record.moments[0] ?? {}).sort()).toEqual(MOMENT_KEYS);
    expect(record.pending.b).toEqual({ step: "partner", route: null, lead: null });
    expect(JSON.stringify(record)).not.toMatch(/amount|phone|money/);
  });
});

describe("writing the record", () => {
  test("[pair:only-server-writes-record] given a connected pair, when one side courts, then it is courting from that tick, and a second court changes nothing", () => {
    const courting = play(linked(), ["a", { type: "pair/courted", tick: 2 }]);
    expect(courting.stage).toBe("courting");
    expect(courting.since).toEqual({ connected: 1, courting: 2 });
    expect(play(courting, ["b", { type: "pair/courted", tick: 3 }])).toEqual(courting);
  });

  test("[pair:only-server-writes-record] given moments from both sides, when written, then they are appended in order with their side and numbered from 1", () => {
    const record = play(linked(), ["a", met(2)], ["b", { type: "pair/moment-added", kind: "call", spot: null, what: "late", tick: 3 }]);
    expect(record.moments).toEqual([
      { n: 1, by: "a", kind: "met", spot: "beach", what: "suya", tick: 2 },
      { n: 2, by: "b", kind: "call", spot: null, what: "late", tick: 3 },
    ]);
  });

  test("[pair:only-server-writes-record] given a pending proposal, when the same side proposes again, then the second replaces the first", () => {
    const record = play(partners(), ["a", propose("marry")], ["a", propose("joint", SKILLED, "me")]);
    expect(record.pending).toEqual({ a: { step: "joint", route: SKILLED, lead: "me" }, b: null });
  });

  test("[pair:only-server-writes-record] given proposals from both sides, when one withdraws, then only its own is cleared", () => {
    const record = play(partners(), ["a", propose("marry")], ["b", propose("joint", SKILLED, "me")], ["a", { type: "pair/withdrawn" }]);
    expect(record.pending).toEqual({ a: null, b: { step: "joint", route: SKILLED, lead: "me" } });
  });

  test("[pair:only-server-writes-record] given a proposal for a step the stage does not allow, when written, then nothing changes", () => {
    const courting = play(linked(), ["a", { type: "pair/courted", tick: 2 }]);
    expect(play(courting, ["a", propose("marry")])).toEqual(courting);
    expect(play(courting, ["a", propose("joint", SKILLED, "me")])).toEqual(courting);
    expect(play(linked(), ["a", propose("partner")])).toEqual(linked());
  });

  test("[pair:only-server-writes-record] given consents from one side, when written, then only that side's consents change", () => {
    const record = play(partners(), ["b", { type: "pair/consented", countFunds: true, standInMay: false }]);
    expect(record.consent).toEqual({ a: { countFunds: false, standInMay: false }, b: { countFunds: true, standInMay: false } });
  });

  test.each<Side>(["a", "b"])("[pair:only-server-writes-record] given partners with a joint and a pending proposal, when side %s ends it, then it is ended by that side and the joint parts go", (from) => {
    const joint = play(partners(), ["a", propose("joint", SKILLED, "me")], ["b", propose("joint", SKILLED, "them")], ["a", { type: "pair/agreed", tick: 6 }], ["b", propose("marry")]);
    const ended = play(joint, [from, { type: "pair/ended", absence: false, tick: 9 }]);
    expect(ended.stage).toBe("ended");
    expect(ended.since.ended).toBe(9);
    expect(ended.ended).toEqual({ by: from, tick: 9 });
    expect(ended.pending).toEqual({ a: null, b: null });
    expect(ended.joint).toBeNull();
    expect(ended.moments).toEqual(joint.moments);
    expect(play(ended, ["a", met(10)], ["b", propose("partner")], ["a", { type: "pair/ended", absence: false, tick: 11 }])).toEqual(ended);
  });

  test("[pair:only-server-writes-record] given a stand-in warned and then on, when the waiting side ends by absence, then only the stand-in being on allows it", () => {
    const warned = play(partners(), ["b", { type: "pair/stand-in-changed", stage: "warned" }]);
    expect(warned.standIn).toEqual({ a: null, b: "warned" });
    expect(play(warned, ["a", { type: "pair/ended", absence: true, tick: 7 }])).toEqual(warned);
    const on = play(warned, ["b", { type: "pair/stand-in-changed", stage: "on" }]);
    const ended = play(on, ["a", { type: "pair/ended", absence: true, tick: 8 }]);
    expect(ended.ended).toEqual({ by: "absence", tick: 8 });
    expect(ended.standIn).toEqual({ a: null, b: null });
  });

  test("[pair:only-server-writes-record] given an interview opened, when each side answers and it is scored, then the answers and result are kept, and a second answer or an early score changes nothing", () => {
    const open = interviewing();
    expect(open.interview).toEqual({ route: SKILLED, questions: QUESTIONS, answers: { a: null, b: null }, standIn: { a: false, b: false }, result: null });
    const one = play(open, ["a", { type: "pair/interview-answered", answers: ["beach", "few"], standIn: false }]);
    expect(play(one, ["a", { type: "pair/interview-answered", answers: ["church", "many"], standIn: false }])).toEqual(one);
    expect(play(one, ["b", { type: "pair/interview-answered", answers: ["beach"], standIn: false }])).toEqual(one);
    expect(play(one, ["a", { type: "pair/interview-scored", result: "pass" }])).toEqual(one);
    const both = play(one, ["b", { type: "pair/interview-answered", answers: ["beach", "many"], standIn: true }]);
    const scored = play(both, ["a", { type: "pair/interview-scored", result: "doubt" }]);
    expect(scored.interview).toMatchObject({ answers: { a: ["beach", "few"], b: ["beach", "many"] }, standIn: { a: false, b: true }, result: "doubt" });
  });

  test("[pair:only-server-writes-record] given an interview not yet scored, when the bond ends, then it closes unscored", () => {
    const ended = play(interviewing(), ["b", { type: "pair/ended", absence: false, tick: 9 }]);
    expect(ended.interview).toBeNull();
  });

  test("[pair:only-server-writes-record] given a side's account deleted, when written, then the bond ends as deleted, that side is nameless, and its moments stay", () => {
    const record = play(partners(), ["b", met(6)], ["b", { type: "pair/consented", countFunds: true, standInMay: true }]);
    const gone = play(record, ["b", { type: "pair/deleted", tick: 7 }]);
    expect(gone.b).toBe("");
    expect(gone.id).toBe(record.id);
    expect(gone.ended).toEqual({ by: "deleted", tick: 7 });
    expect(gone.consent.b).toEqual({ countFunds: false, standInMay: false });
    expect(gone.moments).toEqual(record.moments);
    const view = pairView(gone, ADA);
    expect(view?.them).toBe("");
    expect(view?.ended).toEqual({ by: "absence", tick: 7 });
    expect(view?.moments.at(-1)?.by).toBe("them");
    expect(play(gone, ["a", { type: "pair/linked", tick: 9 }])).toEqual(gone);
  });
});

describe("agreeing a step", () => {
  test("[pair:joint-steps-need-both-sides] given a proposal from one side only, when agreement is written, then nothing changes but its own pending proposal", () => {
    const courting = play(linked(), ["a", { type: "pair/courted", tick: 2 }], ["a", propose("partner")]);
    expect(agreed(courting)).toBeNull();
    expect(play(courting, ["a", { type: "pair/agreed", tick: 4 }])).toEqual(courting);
  });

  test("[pair:joint-steps-need-both-sides] given both sides proposing the same step, when agreement is written, then the stage moves and both proposals clear", () => {
    const courting = play(linked(), ["a", { type: "pair/courted", tick: 2 }], ["a", propose("partner")], ["b", propose("partner")]);
    expect(agreed(courting)).toEqual({ step: "partner", route: null, lead: null });
    const record = play(courting, ["b", { type: "pair/agreed", tick: 5 }]);
    expect(record.stage).toBe("partner");
    expect(record.since.partner).toBe(5);
    expect(record.pending).toEqual({ a: null, b: null });
    const married = play(record, ["b", propose("marry")], ["a", { type: "pair/answered", step: "marry", yes: true }], ["a", { type: "pair/agreed", tick: 20 }]);
    expect(married.stage).toBe("married");
    expect(married.since).toEqual({ connected: 1, courting: 2, partner: 5, married: 20 });
  });

  test("[pair:joint-steps-need-both-sides] given a joint proposed with a lead, when the other answers yes or proposes the same terms, then it is agreed with the lead on the right side", () => {
    const asked = play(partners(), ["b", propose("joint", SKILLED, "me")]);
    const yes = play(asked, ["a", { type: "pair/answered", step: "joint", yes: true }]);
    expect(agreed(yes)).toEqual({ step: "joint", route: SKILLED, lead: "them" });
    expect(play(yes, ["a", { type: "pair/agreed", tick: 6 }]).joint).toEqual({ route: SKILLED, lead: "b" });
    const same = play(asked, ["a", propose("joint", SKILLED, "them")]);
    expect(agreed(same)).toEqual({ step: "joint", route: SKILLED, lead: "them" });
  });

  test("[pair:joint-steps-need-both-sides] given terms that differ in lead, route or step, when checked, then nothing is agreed", () => {
    const base = play(partners(), ["b", propose("joint", SKILLED, "me")]);
    expect(agreed(play(base, ["a", propose("joint", SKILLED, "me")]))).toBeNull();
    expect(agreed(play(base, ["a", propose("joint", "route.canada-points", "them")]))).toBeNull();
    expect(agreed(play(base, ["a", propose("marry")]))).toBeNull();
  });

  test("[pair:joint-steps-need-both-sides] given a proposal, when the other answers no or answers a different step, then it is declined or left waiting", () => {
    const asked = play(partners(), ["b", propose("marry")]);
    expect(play(asked, ["a", { type: "pair/answered", step: "marry", yes: false }]).pending).toEqual({ a: null, b: null });
    expect(play(asked, ["a", { type: "pair/answered", step: "joint", yes: true }])).toEqual(asked);
  });
});

describe("what each side may read", () => {
  test("[pair:who-may-read-a-record] given a record with moments and proposals, when each side reads it, then each sees its own side as me and the other's proposal in its own terms", () => {
    const record = play(partners(), ["b", met(6)], ["b", propose("joint", SKILLED, "me")]);
    const ada = pairView(record, ADA);
    const tunde = pairView(record, TUNDE);
    expect(ada?.moments.map((moment) => moment.by)).toEqual(["me", "them"]);
    expect(tunde?.moments.map((moment) => moment.by)).toEqual(["them", "me"]);
    expect(ada?.pending).toEqual({ mine: null, theirs: { step: "joint", route: SKILLED, lead: "them" } });
    expect(tunde?.pending).toEqual({ mine: { step: "joint", route: SKILLED, lead: "me" }, theirs: null });
    expect(ada?.invitedBy).toBe("them");
    expect(tunde?.invitedBy).toBe("me");
  });

  test("[pair:who-may-read-a-record] given one side's consents, when the other side reads the record, then it sees only its own", () => {
    const record = play(partners(), ["b", { type: "pair/consented", countFunds: true, standInMay: true }]);
    expect(pairView(record, ADA)?.consent).toEqual({ countFunds: false, standInMay: false });
    expect(pairView(record, TUNDE)?.consent).toEqual({ countFunds: true, standInMay: true });
  });

  test("[pair:who-may-read-a-record] given an interview, when read before both answer, after both answer and after scoring, then the other's answers show only after scoring", () => {
    const one = play(interviewing(), ["b", { type: "pair/interview-answered", answers: ["church", "few"], standIn: false }]);
    expect(pairView(one, ADA)?.interview).toMatchObject({ mine: null, theirs: null, waiting: false });
    expect(pairView(one, TUNDE)?.interview).toMatchObject({ mine: ["church", "few"], theirs: null, waiting: true });
    const both = play(one, ["a", { type: "pair/interview-answered", answers: ["beach", "few"], standIn: false }]);
    expect(pairView(both, ADA)?.interview?.theirs).toBeNull();
    expect(pairView(both, TUNDE)?.interview?.theirs).toBeNull();
    const scored = play(both, ["a", { type: "pair/interview-scored", result: "doubt" }]);
    expect(pairView(scored, ADA)?.interview?.theirs).toEqual(["church", "few"]);
    expect(pairView(scored, TUNDE)?.interview?.theirs).toEqual(["beach", "few"]);
  });

  test("[pair:who-may-read-a-record] given a record held under a report, when either side reads it, then the view is the same as unheld", () => {
    const record = partners();
    const held = play(record, ["a", { type: "pair/held" }]);
    expect(pairView(held, TUNDE)).toEqual(pairView(record, TUNDE));
    expect(pairView(held, ADA)).toEqual(pairView(record, ADA));
    expect(Object.keys(pairView(held, ADA) ?? {})).not.toContain("held");
  });

  test("[pair:who-may-read-a-record] given an ended record, when both sides read it, then both still can", () => {
    const ended = play(partners(), ["a", { type: "pair/ended", absence: false, tick: 9 }]);
    expect(pairView(ended, ADA)?.ended).toEqual({ by: "me", tick: 9 });
    expect(pairView(ended, TUNDE)?.ended).toEqual({ by: "them", tick: 9 });
  });
});

describe("block and report", () => {
  test("[pair:block-and-report-one-tap] given a pair view, when it is read, then it carries block and report", () => {
    expect(pairView(partners(), ADA)?.controls).toEqual(["block", "report"]);
    expect(pairView(partners(), TUNDE)?.controls).toEqual(["block", "report"]);
  });

  test("[pair:block-ends-every-bond] given partners, when one side blocks, then the bond ends as a block, the blocker sees why and the blocked side only that it ended", () => {
    const blocked = play(partners(), ["a", propose("marry")], ["b", { type: "pair/blocked", tick: 8 }]);
    expect(blocked.stage).toBe("ended");
    expect(blocked.ended).toEqual({ by: "block", tick: 8 });
    expect(blocked.blocked).toEqual({ a: false, b: true });
    expect(blocked.pending).toEqual({ a: null, b: null });
    expect(pairView(blocked, TUNDE)).toMatchObject({ blocked: true, ended: { by: "block", tick: 8 } });
    expect(pairView(blocked, ADA)).toMatchObject({ blocked: false, ended: { by: null, tick: 8 } });
    expect(JSON.stringify(pairView(blocked, ADA))).not.toContain('"by":"block"');
  });

  test("[pair:block-ends-every-bond] given a block, when the blocked side proposes, adds a moment or relinks, then nothing changes", () => {
    const blocked = play(partners(), ["b", { type: "pair/blocked", tick: 8 }]);
    expect(play(blocked, ["a", propose("marry")], ["a", met(9)], ["a", { type: "pair/linked", tick: 9 }], ["b", { type: "pair/linked", tick: 9 }])).toEqual(blocked);
  });

  test("[pair:block-ends-every-bond] given a block on an ended record, when written, then the block holds and the first end stays", () => {
    const ended = play(partners(), ["a", { type: "pair/ended", absence: false, tick: 9 }]);
    const blocked = play(ended, ["b", { type: "pair/blocked", tick: 10 }]);
    expect(blocked.ended).toEqual({ by: "a", tick: 9 });
    expect(blocked.blocked.b).toBe(true);
  });

  test("[pair:block-ends-every-bond] given a block lifted, when nothing else happens, then nothing is restored, and only a new link reconnects", () => {
    const lifted = play(partners(), ["b", { type: "pair/blocked", tick: 8 }], ["b", { type: "pair/unblocked" }]);
    expect(lifted.stage).toBe("ended");
    expect(lifted.blocked).toEqual({ a: false, b: false });
    const relinked = play(lifted, ["a", { type: "pair/linked", tick: 12 }]);
    expect(relinked.stage).toBe("connected");
    expect(relinked.since).toEqual({ connected: 12 });
    expect(relinked.invitedBy).toBe("a");
    expect(relinked.ended).toBeNull();
    expect(relinked.moments).toEqual(lifted.moments);
  });

  test("[pair:report-holds-conversation] given a report, when the record is held and released, then only the held mark changes and nothing is deleted", () => {
    const record = play(partners(), ["b", met(6)]);
    const held = play(record, ["a", { type: "pair/held" }]);
    expect(held).toEqual({ ...record, held: true });
    expect(play(held, ["a", { type: "pair/released" }])).toEqual(record);
    const blockedToo = play(held, ["a", { type: "pair/blocked", tick: 7 }]);
    expect(blockedToo.held).toBe(true);
    expect(blockedToo.moments).toEqual(record.moments);
  });
});

const sides = fc.constantFrom<Side>("a", "b");
const ticks = fc.nat({ max: 50 });
const steps = fc.constantFrom<Proposal["step"]>("partner", "marry", "joint", "landed");
const leads = fc.constantFrom<Proposal["lead"]>("me", "them", null);
const routes = fc.constantFrom<Id<"route"> | null>(SKILLED, "route.canada-points", null);
const answers = fc.array(fc.constantFrom("beach", "church", "few", "many"), { minLength: 1, maxLength: 3 });

const writes: fc.Arbitrary<PairWrite> = fc.oneof(
  ticks.map((tick): PairWrite => ({ type: "pair/linked", tick })),
  ticks.map((tick): PairWrite => ({ type: "pair/courted", tick })),
  fc.record({ kind: fc.constantFrom("met", "call", "said", "wedding" as const), spot: fc.constantFrom("beach", null), tick: ticks }).map((moment): PairWrite => ({ type: "pair/moment-added", what: "suya", ...moment })),
  fc.record({ step: steps, route: routes, lead: leads }).map((proposal): PairWrite => ({ type: "pair/proposed", proposal })),
  fc.record({ step: steps, yes: fc.boolean() }).map((answer): PairWrite => ({ type: "pair/answered", ...answer })),
  ticks.map((tick): PairWrite => ({ type: "pair/agreed", tick })),
  fc.constant<PairWrite>({ type: "pair/withdrawn" }),
  fc.record({ countFunds: fc.boolean(), standInMay: fc.boolean() }).map((consent): PairWrite => ({ type: "pair/consented", ...consent })),
  fc.record({ absence: fc.boolean(), tick: ticks }).map((end): PairWrite => ({ type: "pair/ended", ...end })),
  ticks.map((tick): PairWrite => ({ type: "pair/blocked", tick })),
  fc.constant<PairWrite>({ type: "pair/unblocked" }),
  fc.constantFrom("warned", "on", null).map((stage): PairWrite => ({ type: "pair/stand-in-changed", stage })),
  fc.constant<PairWrite>({ type: "pair/interview-opened", route: SKILLED, questions: QUESTIONS }),
  fc.record({ answers, standIn: fc.boolean() }).map((answer): PairWrite => ({ type: "pair/interview-answered", ...answer })),
  fc.constantFrom("pass", "doubt", "fail", "caught" as const).map((result): PairWrite => ({ type: "pair/interview-scored", result })),
  ticks.map((tick): PairWrite => ({ type: "pair/deleted", tick })),
  fc.constant<PairWrite>({ type: "pair/held" }),
  fc.constant<PairWrite>({ type: "pair/released" }),
);

describe("any sequence of writes", () => {
  test.prop([fc.constantFrom<PairRecord["role"]>("partner", "sibling"), fc.array(fc.tuple(sides, writes), { maxLength: 40 })])(
    "[pair:who-may-read-a-record] given any writes from either side, when each remaining side reads the record, then it can, and never sees the other's answers before scoring",
    (role, sequence) => {
      const record = play(linked(role), ...sequence);
      for (const [mine, theirs] of [["a", "b"], ["b", "a"]] as const) {
        const me = record[mine];
        if (me === "") continue;
        const view = pairView(record, me);
        expect(view).not.toBeNull();
        expect(view?.id).toBe(record.id);
        expect(view?.stage).toBe(record.stage);
        expect(view?.moments.length).toBe(record.moments.length);
        if (record.interview !== null && record.interview.result === null) expect(view?.interview?.theirs).toBeNull();
        if (record.ended?.by === "block" && !record.blocked[mine]) expect(view?.ended?.by).toBeNull();
        expect(view?.them).toBe(record[theirs]);
      }
      if (role === "sibling") expect(["connected", "ended"]).toContain(record.stage);
    },
  );

  test.prop([fc.array(fc.tuple(sides, writes), { maxLength: 40 })])(
    "[pair:record-holds-no-personal-data] given any writes, when the record is read back, then it holds the contract's fields and nothing else",
    (sequence) => {
      const record = play(linked(), ...sequence);
      expect(Object.keys(record).sort()).toEqual(RECORD_KEYS);
      for (const moment of record.moments) expect(Object.keys(moment).sort()).toEqual(MOMENT_KEYS);
      expect(record.moments.map((moment) => moment.n)).toEqual(record.moments.map((_, index) => index + 1));
    },
  );
});
