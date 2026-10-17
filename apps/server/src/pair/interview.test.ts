// The genuineness interview between two players through the test server: a
// partner-gate application with a real sponsor abroad, both lives held by the
// server, and the stand-in answering for the sponsor once absent long enough.
import type { Content, Id, State } from "@japacity/sim";
import { newState, pairId, time } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import type { TestServer } from "../authority/testing";
import { view } from "../authority/testing";
import { standInJob } from "../jobs/standIn";
import type { Linked } from "./pair.testing";
import { bondIn, call, cardOut, FRIEND, INVITER, married, must, newLife, pairServer, quickWeddings, recordOf, signUp, stateOf } from "./pair.testing";

const ROUTE: Id<"route"> = "route.uk-partner";
const APPLY: Id<"activity"> = "activity.apply-uk-partner";
const LOOK: Id<"activity"> = "activity.look-into-route";
/** A status `route.uk-partner` takes from a sponsor (R-UNDERTAKING-002). */
const SETTLED: Id<"status"> = "status.uk-settled";
const MINUTE_MS = 60_000;

/**
 * Real content where marrying waits no months, the partner route asks only
 * for what the partner gate itself judges (no window, band, floor, papers or
 * fee), and the stand-in always recalls, so a full match is a known result.
 */
function interviewContent(): Content {
  const copy = quickWeddings();
  const route = copy.route[ROUTE];
  const apply = copy.activity[APPLY];
  if (route?.partner === undefined || apply === undefined) throw new Error(`No ${ROUTE} or ${APPLY}.`);
  route.window = null;
  route.partner = { ...route.partner, bandMin: null, floorVar: null, surchargeYears: 0 };
  apply.requires = [];
  apply.cost = [];
  copy.tuning.interview.standInRecallBp = 10000;
  return copy;
}

/**
 * A sponsor already settled in the UK. No scenario starts abroad and the road
 * there is years of play, so the life's first state is placed there and every
 * replay starts from it, as a sibling's family draw does (R-PEOPLE-011).
 */
async function sponsorAbroad(server: TestServer, account: string): Promise<string> {
  await signUp(server, account);
  const current = server.deps.contents.current;
  const base = newState("scenario.tunde", "sponsor-seed", current);
  const month = base.turn.month;
  const state: State = {
    ...base,
    place: { ...base.place, where: "abroad", country: "country.uk", movedMonth: month },
    status: { ...base.status, current: { entry: SETTLED, grantedMonth: month, expiresMonth: null, clock: null, lawfulMonths: 0, monthsHeld: 0, job: null } },
  };
  const id = "character-sponsor";
  const made = await server.deps.stores.player.create({ id, account, refilledAt: server.deps.now(), content: current.version, start: { base: state }, state });
  if (!made.ok) throw new Error(made.detail);
  const pointed = await server.deps.stores.account.setCharacter(account, id);
  if (!pointed.ok) throw new Error(pointed.detail);
  return id;
}

/** The applicant at home married to the sponsor abroad, the joint agreed with the sponsor leading, and the application sent: the interview open in both lives. */
async function applied(): Promise<Linked> {
  const server = pairServer(interviewContent());
  const a = await newLife(server, INVITER, "scenario.ada");
  const b = await sponsorAbroad(server, FRIEND);
  const code = await cardOut(server);
  const taken = await call<{ ok: boolean; detail?: string }>(server, "POST", `/api/invite/${code}/accept`, FRIEND, { slot: "partner" });
  if (!taken.body.ok) throw new Error(`The link was not taken: ${JSON.stringify(taken.body)}`);
  const linked = { server, a, b, key: pairId(a, b), code };
  await married(linked);
  await must(server, INVITER, { type: "people/propose", bond: bondIn(await stateOf(server, a), linked.key), step: "joint", route: ROUTE, lead: "them" });
  await must(server, FRIEND, { type: "people/answer", bond: bondIn(await stateOf(server, b), linked.key), step: "joint", yes: true });
  // R-PEOPLE-025: heard with the month the married partner's facts show a sponsor; then looked into, then applied for.
  // R-ACTIVITY-015: looking into the route and applying are acts done at once, sent as activity/now.
  await must(server, INVITER, { type: "turn/end", slots: [] });
  await must(server, INVITER, { type: "activity/now", activity: LOOK, param: ROUTE });
  await must(server, INVITER, { type: "turn/end", slots: [] });
  await must(server, INVITER, { type: "activity/now", activity: APPLY, param: null });
  return linked;
}

/** The applicant's answers: the truth about the sponsor for each question, and the first option on the plans question. */
function truthsOf(state: State): string[] {
  const open = state.interview.open;
  const truths = state.interview.secret.truths;
  if (open === null || truths === null) throw new Error("No interview open.");
  return open.questions.map((asked, index) => truths[index] ?? asked.options[0] ?? "");
}

describe("the genuineness interview between two players", () => {
  test("[R-INTERVIEW-001] [R-PEOPLE-026] given a married pair with the sponsor settled abroad and the joint agreed with the sponsor leading, when the applicant sends the partner application, then the same questions open in the sponsor's life and the record", async () => {
    const { server, a, b, key } = await applied();
    const applicant = await stateOf(server, a);
    const sponsor = await stateOf(server, b);

    expect(applicant.route[ROUTE]?.state).toBe("applying");
    expect(applicant.interview.open).toMatchObject({ pair: key, route: ROUTE, answers: [] });
    expect(sponsor.interview.open?.questions).toEqual(applicant.interview.open?.questions);
    expect((await recordOf(server.deps, key))?.record.interview).toMatchObject({ route: ROUTE, questions: applicant.interview.open?.questions, answers: { a: null, b: null }, result: null });
  });

  test("[R-INTERVIEW-005] [R-INTERVIEW-008] [R-INTERVIEW-011] [R-INTERVIEW-012] [R-PEOPLE-044] given the applicant answered and the sponsor silent, when the daily job runs a minute short of standInDays and then at standInDays, then first the applicant waits, then the stand-in answers in the sponsor's life and the same score reaches both lives", async () => {
    const { server, a, b, key } = await applied();
    const standInMs = server.deps.contents.current.tuning.people.standInDays * time.DAY_MS;
    const asked = (await stateOf(server, a)).interview.open?.questions.length ?? 0;
    expect(asked).toBeGreaterThan(0);

    server.wait(standInMs - MINUTE_MS);
    const answers = truthsOf(await stateOf(server, a));
    for (const [index, option] of answers.entries()) {
      const question = (await stateOf(server, a)).interview.open?.questions[index]?.id ?? "";
      await must(server, INVITER, { type: "interview/answer", question, option });
    }
    await standInJob(server.deps);

    const waiting = (await view(server, INVITER)).body;
    if (!waiting.ok) throw new Error(waiting.code);
    expect(waiting.view.interview).toMatchObject({ route: ROUTE, question: null, waiting: true, result: null, matched: null });
    expect((await stateOf(server, b)).interview.open?.answers).toEqual([]);
    expect((await stateOf(server, a)).interview.last).toBeNull();

    const drawsBefore = { a: (await stateOf(server, a)).draws, b: (await stateOf(server, b)).draws };
    server.wait(MINUTE_MS);
    await standInJob(server.deps);

    const rows = await server.deps.stores.player.log(b, 0);
    const byStandIn = rows.filter((row) => row.command.type === "interview/answer");
    expect(byStandIn).toHaveLength(asked);
    expect(byStandIn.every((row) => row.sender === "stand-in")).toBe(true);
    const lastOf = async (character: string) => {
      const last = (await stateOf(server, character)).interview.last;
      if (last === null) throw new Error(`No result in ${character}.`);
      return { route: last.route, result: last.result, matched: last.matched, asked: last.asked };
    };
    expect(await lastOf(a)).toEqual({ route: ROUTE, result: "pass", matched: asked, asked });
    expect(await lastOf(b)).toEqual(await lastOf(a));
    expect((await recordOf(server.deps, key))?.record.interview).toMatchObject({ answers: { a: answers }, standIn: { a: false, b: true }, result: "pass" });

    for (const account of [INVITER, FRIEND]) {
      const shown = (await view(server, account)).body;
      if (!shown.ok) throw new Error(shown.code);
      expect(shown.view.interview).toMatchObject({ result: "pass", matched: asked, question: null });
      expect(JSON.stringify(shown.view.interview)).not.toMatch(/truth|secret|answers/);
    }
    // R-INTERVIEW-012: the stand-in's draws are made in the sponsor's life, one on people for each question, and the scoring draws nothing in either.
    expect((await stateOf(server, a)).draws).toEqual(drawsBefore.a);
    expect((await stateOf(server, b)).draws).toEqual({ ...drawsBefore.b, people: (drawsBefore.b.people ?? 0) + asked });
  });
});
