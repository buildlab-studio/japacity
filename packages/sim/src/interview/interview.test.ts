import { content, text } from "@japacity/content";
import { fc, test } from "@fast-check/vitest";
import { describe, expect } from "vitest";

import { mulDiv } from "../engine/int";
import type { Registry } from "../engine/kind";
import type { Accepted, ActivityEntry, Bond, Content, Ctx, Id, InterviewResult, Moment, PersonEntry, PersonFacts, RouteEntry, State } from "../engine/types";
import { viewFor } from "../engine/view";
import { checkInvariants } from "../engine/invariants";
import { registry } from "../kinds";
import { draw, drawnQuestions, seedWhere } from "../testing/route.journey";
import { computerFacts } from "../person/person.facts";
import { legalCommands } from "../testing/legal";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { GENUINENESS, NO_JOB, interviewKind, isThin, listOf, needsMet, resultOf, truthOf } from "./interview.logic";
import { ADA } from "../testing/ids";

// A bond reaches the state by hand here, so a test need not play a courtship
// first. The application goes in through the partner or dependant gate, which
// opens the interview, and every interview command is played through `step`.

const PAIR = "pair-1";
const BOND = "bond-1";
const COMPUTER_BOND = "bond-2";
const PARTNER_ROUTE: Id<"route"> = "route.test-partner";
const DEPENDANT_ROUTE: Id<"route"> = "route.test-dependant";
const PERSON: Id<"person"> = "person.test-partner";
/** The status the test sponsor holds abroad: one that sponsors a partner and lets a dependant join. */
const SPONSOR_STATUS: Id<"status"> = "status.uk-talent";
const APPLY: Record<string, Id<"activity">> = { [PARTNER_ROUTE]: "activity.test-apply-partner", [DEPENDANT_ROUTE]: "activity.test-apply-dependant" };
const entry = content.interview[GENUINENESS]!;
const numbers = content.tuning.interview;
const ALL = entry.questions.map((question) => question.id);

const SPOTS = ["beach", "suya-spot", "church", "cinema", "mall", "friends-wedding", "campus", "bus-stop"];
const WHATS = ["talked", "ate", "walked", "watched-film", "met-family", "argued-made-up", "prayed", "danced"];
const CALLS = ["video-call", "voice-note", "long-call"];

function person(behaviour: Partial<PersonEntry["behaviour"]> = {}): PersonEntry {
  return {
    id: PERSON,
    role: "partner",
    weight: 0,
    when: [],
    profile: {
      ageGapMonths: [0, 0],
      eduLevel: 3,
      englishBand: 60,
      care: 0,
      tech: 0,
      home: "town",
      job: "activity.job-teacher",
      pay: null,
      country: "country.uk",
      status: SPONSOR_STATUS,
      abroadFromMonth: 0,
      settledStatus: null,
      settledFromMonth: null,
    },
    behaviour: { courtMonths: 4, agreeBp: 6000, marryAfterMonths: 8, marryInDecember: false, patienceMonths: 3, jealousBp: 5000, recallBp: 8500, plan: "uk", papers: false, ...behaviour },
    spots: SPOTS,
    whats: WHATS,
    calls: CALLS,
  };
}

/** An activity that sends the application on `route` and asks for nothing, so the gate alone judges it. */
function applying(route: Id<"route">): ActivityEntry {
  return { id: APPLY[route]!, slot: "free", where: "home", requires: [], param: null, cost: [], pay: null, hireBp: null, effects: [{ type: "route/apply", route }], counts: [] };
}

/** Real content with a route on each people gate, free to apply for, and one computer partner. */
function testContent(behaviour: Partial<PersonEntry["behaviour"]> = {}, tuning: Partial<Content["tuning"]["interview"]> = {}): Content {
  const base = content.route["route.uk-skilled"]!;
  const partner: RouteEntry["partner"] = { sponsorStatuses: [SPONSOR_STATUS], bandMin: null, feeVar: "var.uk-partner-fee", surchargeYears: 0, decisionMonths: 100, livingTogetherMonths: null, floorVar: null };
  const dependant: RouteEntry["dependant"] = { maintenanceVar: null, leadMonthsExempt: null, feeVar: null, feeFromLead: false, decisionMonths: 100 };
  return {
    ...content,
    route: {
      ...content.route,
      [PARTNER_ROUTE]: { ...base, id: PARTNER_ROUTE, gate: "partner", interview: null, dependants: DEPENDANT_ROUTE, window: null, partner },
      [DEPENDANT_ROUTE]: { ...base, id: DEPENDANT_ROUTE, gate: "dependant", interview: null, dependants: null, window: null, dependant },
    },
    activity: { ...content.activity, [APPLY[PARTNER_ROUTE]!]: applying(PARTNER_ROUTE), [APPLY[DEPENDANT_ROUTE]!]: applying(DEPENDANT_ROUTE) },
    person: { ...content.person, [PERSON]: person(behaviour) },
    people: { spots: SPOTS },
    tuning: { ...content.tuning, interview: { ...numbers, ...tuning } },
  };
}

const FACTS: PersonFacts = {
  label: "player",
  ageMonths: 300,
  where: "abroad",
  country: "country.uk",
  status: SPONSOR_STATUS,
  statusMonthsLeft: null,
  monthsInCountry: 0,
  job: "activity.job-nurse",
  meetsFloor: {},
  eduLevel: 3,
  englishBand: 60,
  home: "town",
  joint: null,
  funds: null,
  assistanceTaken: 0,
  sponsorReady: null,
};

function moment(by: Moment["by"], kind: Moment["kind"], spot: string | null, what: string): Omit<Moment, "n" | "tick"> {
  return { by, kind, spot, what };
}

/** A deep record: ten meetings, three calls, words from each side, a wedding. */
function richMoments(): Moment[] {
  const list: Omit<Moment, "n" | "tick">[] = [
    moment("me", "met", "beach", "talked"),
    moment("them", "met", "mall", "ate"),
    moment("me", "met", "cinema", "watched-film"),
    moment("me", "met", "church", "prayed"),
    moment("them", "met", "campus", "walked"),
    moment("me", "met", "mall", "ate"),
    moment("them", "met", "beach", "danced"),
    moment("me", "met", "suya-spot", "ate"),
    moment("them", "met", "bus-stop", "talked"),
    moment("me", "met", "campus", "met-family"),
    moment("me", "call", null, "video-call"),
    moment("them", "call", null, "voice-note"),
    moment("me", "call", null, "video-call"),
    moment("me", "said", null, "phrase.miss-you"),
    moment("them", "said", null, "phrase.on-my-way"),
    moment("them", "wedding", "registry", "wedding"),
  ];
  return list.map((item, index) => ({ ...item, n: index + 1, tick: index + 1 }));
}

function bondWith(state: State, over: Partial<Bond> = {}): Bond {
  const month = state.turn.month;
  return {
    with: { kind: "player", pair: PAIR },
    role: "partner",
    stage: "married",
    firstMonth: month - 30,
    partnerMonth: month - numbers.thinMonths,
    marriedMonth: month - 2,
    lastMomentMonth: month,
    moments: richMoments(),
    facts: FACTS,
    pending: { mine: null, theirs: null },
    standIn: null,
    ended: null,
    cooldownUntil: null,
    consent: null,
    ...over,
  };
}

/** Puts the bond into the life's people slice, in the partner slot and the joint. */
function setBond(game: Game, id: string, bond: Bond): void {
  const people = game.state.people;
  game.state = {
    ...game.state,
    people: {
      ...people,
      bonds: { ...people.bonds, [id]: bond },
      slots: { ...people.slots, partner: { state: bond.with.kind === "computer" ? "computer" : "player", bond: id, person: bond.with.kind === "computer" ? bond.with.entry : null, invite: null } },
      joint: { bond: id, route: PARTNER_ROUTE, lead: "them", countFunds: false, standInMay: false },
    },
  };
}

function life(options: { seed?: string; content?: Content; kinds?: Registry } = {}): Game {
  return start({ scenario: ADA, content: options.content ?? testContent(), seed: options.seed ?? "seed-1", ...(options.kinds === undefined ? {} : { kinds: options.kinds }) });
}

type Over = Partial<Bond> | ((month: number) => Partial<Bond>);

/** A sponsor's life with a real partner and the deep record. `over` may read the life's month now. */
function sponsorLife(over: Over = {}, options: { seed?: string; content?: Content; kinds?: Registry } = {}): Game {
  const game = life(options);
  setBond(game, BOND, bondWith(game.state, typeof over === "function" ? over(game.state.turn.month) : over));
  return game;
}

/** The questions as the authority sends them, by default every one the record meets: each option list holds both truths and a decoy. */
function questionsFor(game: Game, only?: readonly string[]): { id: string; options: string[] }[] {
  const read = { state: game.state, world: game.world(), content: game.content };
  const bond = game.state.people.bonds[BOND]!;
  const ids = only ?? entry.questions.filter((question) => needsMet(question, bond)).map((question) => question.id);
  return ids.map((id) => {
    const question = entry.questions.find((candidate) => candidate.id === id)!;
    if (question.truth === null) return { id, options: listOf(game.content, bond, question) };
    const right = [truthOf(read, bond, question.truth, "them"), truthOf(read, bond, question.truth, "me")].filter((option): option is string => option !== null);
    return { id, options: [...new Set([...right, "decoy"])] };
  });
}

/** What each side should give: this side's truth, and the other's (the truth about this side for an `other` question). */
function rightAnswers(game: Game): { mine: string[]; theirs: string[] } {
  const read = { state: game.state, world: game.world(), content: game.content };
  const open = game.state.interview.open!;
  const bond = game.state.people.bonds[BOND]!;
  const mine: string[] = [];
  const theirs: string[] = [];
  for (const asked of open.questions) {
    const question = entry.questions.find((candidate) => candidate.id === asked.id)!;
    if (question.truth === null) {
      mine.push(asked.options[0]!);
      theirs.push(asked.options[0]!);
      continue;
    }
    mine.push(truthOf(read, bond, question.truth, "them")!);
    theirs.push(truthOf(read, bond, question.truth, question.about === "other" ? "me" : "them")!);
  }
  return { mine, theirs };
}

function answerAll(game: Game, answers: readonly string[]): void {
  answers.forEach((option, index) => {
    game.accept({ type: "interview/answer", question: game.state.interview.open!.questions[index]!.id, option });
  });
}

/** Opens all ten questions in a sponsor's life, answers them rightly, and scores with the first `right` of theirs right. */
function scoreWith(game: Game, right: number): InterviewResult {
  game.accept({ type: "interview/open", pair: PAIR, route: PARTNER_ROUTE, questions: questionsFor(game) }, "authority");
  const { mine, theirs } = rightAnswers(game);
  answerAll(game, mine);
  const sent = theirs.map((option, index) => (index < right ? option : game.state.interview.open!.questions[index]!.options.find((other) => other !== option)!));
  game.accept({ type: "interview/scored", pair: PAIR, theirs: sent }, "authority");
  return game.state.interview.last!.result;
}

/** The route each life is about to apply on. */
const PENDING = new WeakMap<Game, Id<"route">>();

/** The route known, as if looked into, so the next turn's slot can send the application. */
function applyNextMonth(game: Game, route: Id<"route">): void {
  game.state = { ...game.state, route: { ...game.state.route, [route]: { ...game.state.route[route]!, state: "known" } } };
  PENDING.set(game, route);
}

/** The turn that sends the application through the gate, which opens the interview (R-INTERVIEW-001, 002). */
function send(game: Game): void {
  const route = PENDING.get(game)!;
  game.endTurn([{ activity: APPLY[route]!, param: null }]);
  expect(game.state.route[route]?.state).toBe("applying");
}

/** A bond with the test's computer partner, its facts built from its entry as the people kind builds them. */
function computerBond(game: Game, over: Partial<Bond> = {}): Bond {
  const read = { state: game.state, world: game.world(), content: game.content };
  const facts = computerFacts(read, game.content.person[PERSON]!, 300, game.state.turn.month);
  return bondWith(game.state, { with: { kind: "computer", entry: PERSON }, facts, ...over });
}

/** An applicant with a computer partner whose application on the partner gate goes in with the next turn. */
function applicantWithComputer(options: { seed?: string; content?: Content; bond?: Partial<Bond> } = {}): Game {
  const game = life(options);
  setBond(game, COMPUTER_BOND, computerBond(game, options.bond));
  applyNextMonth(game, PARTNER_ROUTE);
  return game;
}

function pickRight(game: Game): string[] {
  const read = { state: game.state, world: game.world(), content: game.content };
  const bond = Object.values(game.state.people.bonds)[0]!;
  return game.state.interview.open!.questions.map((asked) => {
    const question = entry.questions.find((candidate) => candidate.id === asked.id)!;
    return question.truth === null ? asked.options[0]! : truthOf(read, bond, question.truth, "them")!;
  });
}

/** Hands the interview kind the sender, as the engine will once its Ctx carries it. */
function standInKinds(): Registry {
  return registry().map((kind) => {
    if (kind.kind !== "interview") return kind;
    const answer = interviewKind.commands!["interview/answer"]!;
    const withSender = (ctx: Ctx): Ctx =>
      new Proxy(ctx, {
        has: (target, key) => key === "sender" || Reflect.has(target, key),
        get: (target, key): unknown => (key === "sender" ? "stand-in" : Reflect.get(target, key)),
      });
    return { ...kind, commands: { ...kind.commands, "interview/answer": (ctx, command) => answer(withSender(ctx), command) } };
  });
}

// ---------------------------------------------------------------------------

describe("the questions in content", () => {
  test("[R-INTERVIEW-003] given the entry, when it is read, then it asks the tuning's count from the ten questions of the page, each with its truth and needs", () => {
    expect(entry.ask).toBe(numbers.ask);
    expect(ALL).toEqual(["first-spot", "first-what", "last-spot", "times-met", "wedding-spot", "calls", "partner-job", "partner-home", "last-said", "plans"]);
    expect(entry.questions.filter((question) => question.about === "other").map((question) => question.id)).toEqual(["partner-job", "partner-home", "last-said"]);
    expect(entry.questions.find((question) => question.id === "plans")?.truth).toBeNull();
    expect(entry.questions.find((question) => question.id === "last-spot")?.needs).toEqual({ met: 2 });
  });

  test("[R-INTERVIEW-003] given the record, when each truth is worked out, then it reads the moments and the facts as the page's table says", () => {
    const game = sponsorLife();
    const read = { state: game.state, world: game.world(), content: game.content };
    const bond = game.state.people.bonds[BOND]!;
    const truth = (id: string, about: "them" | "me" = "them") => truthOf(read, bond, entry.questions.find((question) => question.id === id)!.truth, about);
    expect(truth("first-spot")).toBe("beach");
    expect(truth("first-what")).toBe("talked");
    expect(truth("last-spot")).toBe("campus");
    expect(truth("times-met")).toBe("nine-to-fifteen");
    expect(truth("wedding-spot")).toBe("registry");
    expect(truth("calls")).toBe("video-call");
    expect(truth("partner-job")).toBe("activity.job-nurse");
    expect(truth("partner-job", "me")).toBe(NO_JOB);
    expect(truth("partner-home")).toBe("town");
    expect(truth("last-said")).toBe("phrase.on-my-way");
    expect(truth("last-said", "me")).toBe("phrase.miss-you");
    expect(truth("plans")).toBeNull();
  });

  test.each([
    [0, "not-yet"],
    [1, "one-to-three"],
    [3, "one-to-three"],
    [4, "four-to-eight"],
    [8, "four-to-eight"],
    [9, "nine-to-fifteen"],
    [15, "nine-to-fifteen"],
    [16, "sixteen-or-more"],
  ])("[R-INTERVIEW-003] given %i meetings, when the times-met truth is worked out, then it is the band %s", (count, band) => {
    const game = sponsorLife();
    const moments = Array.from({ length: count }, (_unused, index) => ({ ...moment("me", "met", "beach", "talked"), n: index + 1, tick: index + 1 }));
    const bond = bondWith(game.state, { moments });
    expect(truthOf({ state: game.state, world: game.world(), content: game.content }, bond, "times-met", "them")).toBe(band);
  });
});

describe("opening", () => {
  test("[R-INTERVIEW-001] [R-INTERVIEW-003] given an application on the partner gate with a computer partner, when the month it is sent resolves, then the interview opens with the tuning's count drawn on visa without repeats, each with the truth among its options", () => {
    const game = applicantWithComputer();
    const visaBefore = game.state.draws.visa ?? 0;
    send(game);
    const open = game.state.interview.open!;
    const pool = entry.questions.filter((question) => needsMet(question, game.state.people.bonds[COMPUTER_BOND]!)).map((question) => question.id);
    expect(pool).toEqual(ALL);
    expect(open.route).toBe(PARTNER_ROUTE);
    expect(open.pair).toBe(COMPUTER_BOND);
    expect(open.questions.map((asked) => asked.id)).toEqual(drawnQuestions(game.state.seed, pool, numbers.ask, visaBefore));
    expect(new Set(open.questions.map((asked) => asked.id)).size).toBe(numbers.ask);
    const truths = game.state.interview.secret.truths!;
    open.questions.forEach((asked, index) => {
      expect(new Set(asked.options).size).toBe(asked.options.length);
      const question = entry.questions.find((candidate) => candidate.id === asked.id)!;
      // A plans question offers its whole list; every other offers its truth.
      expect(question.truth === null ? asked.options : [truths[index]]).toEqual(question.truth === null ? question.options : asked.options.filter((option) => option === truths[index]));
    });
  });

  test("[R-INTERVIEW-003] given a question about the couple, when it opens, then its options are the truth and the tuning's decoys from its list, never the truth twice", () => {
    for (const seed of ["seed-1", "seed-2", "seed-3", "seed-4"]) {
      const game = applicantWithComputer({ seed });
      send(game);
      const open = game.state.interview.open!;
      const truths = game.state.interview.secret.truths!;
      open.questions.forEach((asked, index) => {
        const question = entry.questions.find((candidate) => candidate.id === asked.id)!;
        if (question.about !== "couple" || question.truth === null) return;
        const list = listOf(game.content, game.state.people.bonds[COMPUTER_BOND]!, question);
        expect(asked.options.filter((option) => option === truths[index])).toHaveLength(1);
        expect(asked.options).toHaveLength(Math.min(list.length, numbers.decoys + 1));
        for (const option of asked.options) expect(list).toContain(option);
      });
    }
  });

  test("[R-INTERVIEW-003] given a record with no moments, when the interview opens, then only the questions that need nothing are asked", () => {
    const game = applicantWithComputer({ bond: { moments: [], stage: "married" } });
    send(game);
    const asked = game.state.interview.open!.questions.map((question) => question.id);
    expect([...asked].sort()).toEqual(["partner-home", "partner-job", "plans", "times-met"]);
  });

  test("[R-INTERVIEW-001] given a real sponsor's life, when the authority sends the questions, then the same questions and options open there, with no draw", () => {
    const game = sponsorLife();
    const questions = questionsFor(game, ["first-spot", "times-met", "partner-job", "plans", "calls"]);
    const before = game.state.draws;
    game.accept({ type: "interview/open", pair: PAIR, route: PARTNER_ROUTE, questions }, "authority");
    expect(game.state.interview.open?.questions).toEqual(questions);
    expect(game.state.draws).toEqual(before);
    expect(game.view().interview?.question).toEqual(questions[0]);
  });

  test("[R-INTERVIEW-001] given a player, when they send interview/open or interview/scored, then each is rejected as not theirs", () => {
    const game = sponsorLife();
    game.expectRejected({ type: "interview/open", pair: PAIR, route: PARTNER_ROUTE, questions: questionsFor(game) }, "not-yours");
    expect(game.expectRejected({ type: "interview/scored", pair: PAIR, theirs: [] }, "not-yours").code).toBe("not-yours");
  });

  test("[R-INTERVIEW-001] given an interview already open, a pair with no bond or a question the entry lacks, when the authority opens one, then it is rejected", () => {
    const game = sponsorLife();
    game.expectRejected({ type: "interview/open", pair: "pair-9", route: PARTNER_ROUTE, questions: questionsFor(game) }, "not-legal", "authority");
    game.expectRejected({ type: "interview/open", pair: PAIR, route: PARTNER_ROUTE, questions: [{ id: "favourite-colour", options: ["red"] }] }, "not-legal", "authority");
    game.expectRejected({ type: "interview/open", pair: PAIR, route: PARTNER_ROUTE, questions: [{ id: "plans", options: [] }] }, "not-legal", "authority");
    expect(game.state.interview.open).toBeNull();
    game.accept({ type: "interview/open", pair: PAIR, route: PARTNER_ROUTE, questions: questionsFor(game) }, "authority");
    game.expectRejected({ type: "interview/open", pair: PAIR, route: PARTNER_ROUTE, questions: questionsFor(game) }, "not-legal", "authority");
    expect(game.state.interview.open?.pair).toBe(PAIR);
  });

  describe("on the dependant gate", () => {
    /** The months together are counted in the month the application is sent, one after now. */
    function dependant(moments: number, monthsTogether: number): Game {
      const game = life();
      const sent = game.state.turn.month + 1;
      setBond(game, COMPUTER_BOND, computerBond(game, { moments: richMoments().slice(0, moments), partnerMonth: sent - monthsTogether, marriedMonth: null }));
      applyNextMonth(game, DEPENDANT_ROUTE);
      return game;
    }

    test("[R-INTERVIEW-002] given a record with the tuning's moments and months together, when a dependant application goes in, then no interview opens", () => {
      const game = dependant(numbers.thinMoments, numbers.thinMonths);
      send(game);
      expect(game.state.interview.open).toBeNull();
      expect(game.view().interview).toBeNull();
    });

    test("[R-INTERVIEW-002] given one moment fewer than the tuning's, when a dependant application goes in, then the interview opens", () => {
      const game = dependant(numbers.thinMoments - 1, numbers.thinMonths);
      send(game);
      expect(game.state.interview.open?.route).toBe(DEPENDANT_ROUTE);
    });

    test("[R-INTERVIEW-002] given one month fewer together than the tuning's, when a dependant application goes in, then the interview opens", () => {
      const game = dependant(richMoments().length, numbers.thinMonths - 1);
      send(game);
      expect(game.state.interview.open?.route).toBe(DEPENDANT_ROUTE);
    });
  });
});

describe("answering", () => {
  test("[R-INTERVIEW-004] given an open interview, when an answer names another question or an option not offered, then it is rejected with not-legal", () => {
    const game = sponsorLife();
    game.accept({ type: "interview/open", pair: PAIR, route: PARTNER_ROUTE, questions: questionsFor(game) }, "authority");
    game.expectRejected({ type: "interview/answer", question: "plans", option: "uk" }, "not-legal");
    game.expectRejected({ type: "interview/answer", question: "first-spot", option: "moon" }, "not-legal");
    game.accept({ type: "interview/answer", question: "first-spot", option: "beach" });
    expect(game.state.interview.open?.answers).toEqual(["beach"]);
  });

  test("[R-INTERVIEW-004] given no interview open, when an answer is sent, then it is rejected with not-legal", () => {
    expect(sponsorLife().expectRejected({ type: "interview/answer", question: "plans", option: "uk" }, "not-legal").code).toBe("not-legal");
  });

  test("[R-INTERVIEW-004] given a question to answer, when the turn is ended, then it is rejected with setpiece-open, and other commands work as usual", () => {
    const game = sponsorLife();
    game.accept({ type: "interview/open", pair: PAIR, route: PARTNER_ROUTE, questions: questionsFor(game) }, "authority");
    game.expectRejected({ type: "turn/end", slots: [] }, "setpiece-open");
    game.accept({ type: "wallet/move", currency: "NGN", amount: 100, to: "cash" });
    expect(legalCommands(game.view()).some((command) => command.type === "turn/end")).toBe(false);
    expect(legalCommands(game.view()).filter((command) => command.type === "interview/answer")).toHaveLength(game.view().interview!.question!.options.length);
  });

  test("[R-INTERVIEW-004] [R-INTERVIEW-011] given every answer in and a real partner still answering, when the turn is ended, then it goes ahead and the view says the interview is waiting", () => {
    const game = sponsorLife();
    game.accept({ type: "interview/open", pair: PAIR, route: PARTNER_ROUTE, questions: questionsFor(game) }, "authority");
    const result = (() => {
      const { mine } = rightAnswers(game);
      answerAll(game, mine.slice(0, -1));
      return game.accept({ type: "interview/answer", question: "plans", option: mine.at(-1)! });
    })();
    expect(result.events.map((event) => event.type)).toContain("interview/closed");
    expect(result.lines.map((line) => line.key)).toContain("line.interview.waiting");
    expect(game.state.interview.open?.answers).toHaveLength(ALL.length);
    expect(game.view().interview).toMatchObject({ waiting: true, question: null, asked: ALL.length, total: ALL.length, result: null });
    game.endTurn();
    game.expectRejected({ type: "interview/answer", question: "plans", option: "uk" }, "not-legal");
  });

  test("[R-INTERVIEW-004] given random legal play through an open interview, when every command offered is sent, then each is accepted and the invariants hold", () => {
    const game = sponsorLife();
    game.accept({ type: "interview/open", pair: PAIR, route: PARTNER_ROUTE, questions: questionsFor(game) }, "authority");
    for (let guard = 0; guard < ALL.length; guard += 1) {
      const answers = legalCommands(game.view()).filter((command) => command.type === "interview/answer");
      expect(answers.length).toBeGreaterThan(0);
      game.accept(answers[guard % answers.length]!);
      expect(checkInvariants(game.state, game.content)).toEqual([]);
    }
    expect(game.view().interview?.waiting).toBe(true);
  });
});

describe("the view", () => {
  test("[R-INTERVIEW-005] given an open interview, when it is viewed, then it shows one question and its options and never a truth, a score or a hidden field", () => {
    const game = sponsorLife();
    const questions = questionsFor(game);
    game.accept({ type: "interview/open", pair: PAIR, route: PARTNER_ROUTE, questions }, "authority");
    game.accept({ type: "interview/answer", question: "first-spot", option: "beach" });
    const shown = game.view().interview!;
    expect(Object.keys(shown).sort()).toEqual(["asked", "matched", "question", "result", "route", "standIn", "total", "waiting"]);
    expect(shown).toEqual({ route: PARTNER_ROUTE, question: questions[1], asked: 1, total: ALL.length, waiting: false, standIn: false, result: null, matched: null });
    expect(JSON.stringify(shown)).not.toContain("secret");
  });

  test("[R-INTERVIEW-005] given a scored interview, when it is viewed, then it shows the result and how many matched, never which", () => {
    const game = sponsorLife();
    scoreWith(game, ALL.length);
    expect(game.view().interview).toEqual({ route: PARTNER_ROUTE, question: null, asked: ALL.length, total: ALL.length, waiting: false, standIn: false, result: "pass", matched: ALL.length });
  });

  test("[R-INTERVIEW-005] [R-INTERVIEW-007] given a computer partner, when the interview is open and when it is scored, then the computer's answers and the truths are nowhere in the view", () => {
    const game = applicantWithComputer();
    send(game);
    const truths = game.state.interview.secret.truths!;
    const during = game.view().interview!;
    expect(during.question).toEqual(game.state.interview.open!.questions[0]);
    expect(JSON.stringify(viewFor({ state: game.state, world: game.world(), content: game.content }))).not.toContain('"truths"');
    answerAll(game, pickRight(game));
    expect(game.state.interview.open).toBeNull();
    const after = game.view().interview!;
    expect(Object.keys(after).sort()).toEqual(["asked", "matched", "question", "result", "route", "standIn", "total", "waiting"]);
    expect(after.question).toBeNull();
    expect(truths.length).toBe(numbers.ask);
  });
});

describe("scoring", () => {
  const TEN = ALL.length;
  /** The matches out of ten that make exactly this share. */
  const at = (bp: number): number => {
    expect(mulDiv(mulDiv(bp, TEN, 10000), 10000, TEN)).toBe(bp);
    return mulDiv(bp, TEN, 10000);
  };

  test("[R-INTERVIEW-006] given a deep record and ten questions, when the matches are exactly the pass share, then the result is pass", () => {
    expect(scoreWith(sponsorLife(), at(numbers.passBp))).toBe("pass");
  });

  test("[R-INTERVIEW-006] given a deep record, when one match fewer than the pass share is made, then the result is doubt", () => {
    expect(scoreWith(sponsorLife(), at(numbers.passBp) - 1)).toBe("doubt");
  });

  test("[R-INTERVIEW-006] given a deep record, when the matches are exactly the fail share, then the result is doubt, and one fewer is fail", () => {
    expect(scoreWith(sponsorLife(), at(numbers.failBp))).toBe("doubt");
    expect(scoreWith(sponsorLife(), at(numbers.failBp) - 1)).toBe("fail");
  });

  test("[R-INTERVIEW-006] given a deep record, when the matches are exactly the caught share, then the result is fail, and one fewer is caught", () => {
    expect(scoreWith(sponsorLife(), at(numbers.caughtBelowBp))).toBe("fail");
    expect(scoreWith(sponsorLife(), at(numbers.caughtBelowBp) - 1)).toBe("caught");
  });

  test("[R-INTERVIEW-006] given a thin record, when the result would not be pass, then it is caught, and a pass stays a pass", () => {
    const thin = (month: number): Partial<Bond> => ({ partnerMonth: month - numbers.thinMonths + 1, marriedMonth: null });
    expect(scoreWith(sponsorLife(thin), at(numbers.passBp))).toBe("pass");
    expect(scoreWith(sponsorLife(thin), at(numbers.passBp) - 1)).toBe("caught");
    expect(scoreWith(sponsorLife({ moments: richMoments().slice(0, numbers.thinMoments - 1) }), at(numbers.failBp))).toBe("caught");
  });

  test("[R-INTERVIEW-006] given a share in basis points, when the result is worked out, then each edge falls as the page says", () => {
    const asked = 10000;
    expect(resultOf(numbers.passBp, asked, false, numbers)).toBe("pass");
    expect(resultOf(numbers.passBp - 1, asked, false, numbers)).toBe("doubt");
    expect(resultOf(numbers.failBp, asked, false, numbers)).toBe("doubt");
    expect(resultOf(numbers.failBp - 1, asked, false, numbers)).toBe("fail");
    expect(resultOf(numbers.caughtBelowBp, asked, false, numbers)).toBe("fail");
    expect(resultOf(numbers.caughtBelowBp - 1, asked, false, numbers)).toBe("caught");
    expect(resultOf(numbers.passBp, asked, true, numbers)).toBe("pass");
    expect(resultOf(numbers.passBp - 1, asked, true, numbers)).toBe("caught");
  });

  test.prop([fc.integer({ min: 1, max: 40 }), fc.nat(), fc.boolean()])(
    "[R-INTERVIEW-006] given any count asked and matched, when the result is worked out, then caught under the caught share, pass at the pass share, and a thin record never doubts or fails",
    (asked, seed, thin) => {
      const matched = seed % (asked + 1);
      const share = mulDiv(matched, 10000, asked);
      const result = resultOf(matched, asked, thin, numbers);
      if (share < numbers.caughtBelowBp) expect(result).toBe("caught");
      else if (share >= numbers.passBp) expect(result).toBe("pass");
      else if (thin) expect(result).toBe("caught");
      else expect(result).toBe(share >= numbers.failBp ? "doubt" : "fail");
    },
  );

  test("[R-INTERVIEW-006] given a question about the other person, when one side gives the truth about the other but the other does not, then it does not match", () => {
    const game = sponsorLife();
    game.accept({ type: "interview/open", pair: PAIR, route: PARTNER_ROUTE, questions: questionsFor(game, ["partner-job", "plans"]) }, "authority");
    answerAll(game, ["activity.job-nurse", "uk"]);
    // Their answer names their own job, not the truth about this side.
    game.accept({ type: "interview/scored", pair: PAIR, theirs: ["activity.job-nurse", "uk"] }, "authority");
    expect(game.state.interview.last?.matched).toBe(1);
  });

  test("[R-INTERVIEW-006] [R-INTERVIEW-012] given both answers in, when the authority scores, then no draw is made", () => {
    const game = sponsorLife();
    game.accept({ type: "interview/open", pair: PAIR, route: PARTNER_ROUTE, questions: questionsFor(game) }, "authority");
    const { mine, theirs } = rightAnswers(game);
    answerAll(game, mine);
    const before = game.state.draws;
    game.accept({ type: "interview/scored", pair: PAIR, theirs }, "authority");
    expect(game.state.draws).toEqual(before);
  });

  test("[R-INTERVIEW-006] given a score for answers that are not all in, the wrong count or an option not offered, when it is sent, then it is rejected with not-legal", () => {
    const game = sponsorLife();
    game.accept({ type: "interview/open", pair: PAIR, route: PARTNER_ROUTE, questions: questionsFor(game) }, "authority");
    const { mine, theirs } = rightAnswers(game);
    game.expectRejected({ type: "interview/scored", pair: PAIR, theirs }, "not-legal", "authority");
    answerAll(game, mine);
    game.expectRejected({ type: "interview/scored", pair: PAIR, theirs: theirs.slice(1) }, "not-legal", "authority");
    game.expectRejected({ type: "interview/scored", pair: PAIR, theirs: ["moon", ...theirs.slice(1)] }, "not-legal", "authority");
    game.expectRejected({ type: "interview/scored", pair: "pair-9", theirs }, "not-legal", "authority");
    expect(game.state.interview.last).toBeNull();
  });
});

describe("a computer partner", () => {
  test("[R-INTERVIEW-007] given a computer that always recalls, when the player answers rightly, then the comparison runs with the last answer and passes", () => {
    const game = applicantWithComputer({ content: testContent({ recallBp: 10000 }) });
    send(game);
    const plan = game.state.interview.open!.questions.findIndex((asked) => asked.id === "plans");
    const answers = pickRight(game).map((option, index) => (index === plan ? "uk" : option));
    const result = (() => {
      answerAll(game, answers.slice(0, -1));
      return game.accept({ type: "interview/answer", question: game.state.interview.open!.questions.at(-1)!.id, option: answers.at(-1)! });
    })();
    expect(result.events.map((event) => event.type)).toEqual(expect.arrayContaining(["interview/answered", "interview/closed", "interview/scored"]));
    expect(game.state.interview.last).toEqual({ route: PARTNER_ROUTE, result: "pass", matched: numbers.ask, asked: numbers.ask, month: game.state.turn.month, standIn: { a: false, b: false } });
  });

  test("[R-INTERVIEW-007] given a computer that never recalls and plans otherwise, when the player answers rightly, then nothing matches and the result is caught", () => {
    const game = applicantWithComputer({ content: testContent({ recallBp: 0, plan: "not-decided" }) });
    send(game);
    const peopleBefore = game.state.draws.people ?? 0;
    // The player's plan is the first option, `uk`.
    answerAll(game, pickRight(game));
    expect(game.state.interview.last).toMatchObject({ result: "caught", matched: 0, asked: numbers.ask });
    // Each question with a truth draws the recall and a decoy on `people`; `plans` draws nothing.
    const withTruth = numbers.ask - 1;
    expect((game.state.draws.people ?? 0) - peopleBefore).toBe(withTruth * 2);
  });

  test("[R-INTERVIEW-007] given a papers partner with no moments, when the interview is scored, then it is caught unless every answer matched", () => {
    for (const seed of ["seed-1", "seed-2", "seed-3", "seed-4", "seed-5", "seed-6"]) {
      const game = applicantWithComputer({ seed, content: testContent({ recallBp: 2000, papers: true, plan: "not-decided" }), bond: { moments: [], partnerMonth: null, marriedMonth: 0 } });
      send(game);
      answerAll(game, pickRight(game));
      const last = game.state.interview.last!;
      expect(last.result).toBe(last.matched === last.asked ? "pass" : "caught");
    }
  });
});

describe("the stand-in", () => {
  test("[R-INTERVIEW-008] given the stand-in answering a question with a truth, when its draw on people is under the stand-in recall, then it gives the truth, and otherwise a decoy", () => {
    const hit = seedWhere((seed) => draw(seed, "people", 0, 10000) < numbers.standInRecallBp);
    const miss = seedWhere((seed) => draw(seed, "people", 0, 10000) >= numbers.standInRecallBp);
    for (const [seed, recalls] of [
      [hit, true],
      [miss, false],
    ] as const) {
      const game = sponsorLife({}, { seed, kinds: standInKinds() });
      game.accept({ type: "interview/open", pair: PAIR, route: PARTNER_ROUTE, questions: questionsFor(game) }, "authority");
      game.accept({ type: "interview/answer", question: "first-spot", option: "anything" }, "stand-in");
      expect(game.state.interview.open!.answers[0] === "beach").toBe(recalls);
      expect(game.view().interview?.standIn).toBe(true);
    }
  });

  test.prop([fc.integer({ min: 0, max: 400 })], { numRuns: 30 })(
    "[R-INTERVIEW-008] given any seed, when the stand-in answers the first question, then it gives the truth exactly when the people draw is under the stand-in recall",
    (index) => {
      const seed = `stand-${String(index)}`;
      const game = sponsorLife({}, { seed, kinds: standInKinds() });
      game.accept({ type: "interview/open", pair: PAIR, route: PARTNER_ROUTE, questions: questionsFor(game, ["times-met", "plans"]) }, "authority");
      game.accept({ type: "interview/answer", question: "times-met", option: "anything" }, "stand-in");
      expect(game.state.interview.open!.answers[0] === "nine-to-fifteen").toBe(draw(seed, "people", 0, 10000) < numbers.standInRecallBp);
    },
  );

  test("[R-INTERVIEW-008] given the plans question, when the stand-in answers, then it gives the waiting side's answer on a hit and the first option on a miss", () => {
    const hit = seedWhere((seed) => draw(seed, "people", 0, 10000) < numbers.standInRecallBp);
    const miss = seedWhere((seed) => draw(seed, "people", 0, 10000) >= numbers.standInRecallBp);
    for (const [seed, expected] of [
      [hit, "home"],
      [miss, "uk"],
    ] as const) {
      const game = sponsorLife({}, { seed, kinds: standInKinds() });
      game.accept({ type: "interview/open", pair: PAIR, route: PARTNER_ROUTE, questions: questionsFor(game, ["plans"]) }, "authority");
      game.accept({ type: "interview/answer", question: "plans", option: "home" }, "stand-in");
      expect(game.state.interview.open!.answers).toEqual([expected]);
    }
  });

  test("[R-INTERVIEW-008] given the stand-in on for the other side while this side waits, when the view is read, then it marks the interview as answered by a stand-in", () => {
    const game = sponsorLife({ standIn: "on" });
    game.accept({ type: "interview/open", pair: PAIR, route: PARTNER_ROUTE, questions: questionsFor(game, ["plans"]) }, "authority");
    expect(game.view().interview?.standIn).toBe(false);
    game.accept({ type: "interview/answer", question: "plans", option: "uk" });
    expect(game.view().interview).toMatchObject({ waiting: true, standIn: true });
  });
});

describe("the stand-in mark on the result", () => {
  /** Opens two questions, answers them in this life, and scores with the first option of each as the other side's. */
  function scoredAfter(game: Game): Accepted {
    game.accept({ type: "interview/open", pair: PAIR, route: PARTNER_ROUTE, questions: questionsFor(game, ["times-met", "plans"]) }, "authority");
    for (const asked of game.state.interview.open!.questions) game.accept({ type: "interview/answer", question: asked.id, option: asked.options[0]! });
    return game.accept({ type: "interview/scored", pair: PAIR, theirs: game.state.interview.open!.questions.map((asked) => asked.options[0]!) }, "authority");
  }

  test("[R-INTERVIEW-008] given the stand-in answering in this life, when the result comes, then the result keeps this side's mark, the view after the result says a stand-in answered, and so does the report", () => {
    const game = sponsorLife({}, { kinds: standInKinds() });
    const result = scoredAfter(game);
    expect(game.state.interview.last?.standIn).toEqual({ a: true, b: false });
    expect(game.view().interview).toMatchObject({ question: null, waiting: false, standIn: true });
    expect(game.view().interview?.result).not.toBeNull();
    expect(result.lines.map((line) => line.key)).toContain("line.interview.stood-in");
  });

  test("[R-INTERVIEW-008] given the stand-in on for the other side when the result comes, when this side answered itself, then the result keeps the other side's mark and the view and the report say a stand-in answered", () => {
    const game = sponsorLife({ standIn: "on" });
    const result = scoredAfter(game);
    expect(game.state.interview.last?.standIn).toEqual({ a: false, b: true });
    expect(game.view().interview).toMatchObject({ question: null, standIn: true });
    expect(result.lines.map((line) => line.key)).toContain("line.interview.stood-in");
  });

  test("[R-INTERVIEW-008] given no stand-in on either side, or one only warned, when the result comes, then nothing is marked and the report does not mention a stand-in", () => {
    for (const standIn of [null, "warned"] as const) {
      const game = sponsorLife({ standIn });
      const result = scoredAfter(game);
      expect(game.state.interview.last?.standIn).toEqual({ a: false, b: false });
      expect(game.view().interview?.standIn).toBe(false);
      expect(result.lines.map((line) => line.key)).not.toContain("line.interview.stood-in");
    }
  });
});

describe("what the result does", () => {
  test("[R-INTERVIEW-009] given a caught result, when it is scored, then standing falls by the tuning's figure and the result is kept for the application", () => {
    const game = sponsorLife();
    const standing = game.state.quality["quality.standing"]!;
    const result = (() => {
      game.accept({ type: "interview/open", pair: PAIR, route: PARTNER_ROUTE, questions: questionsFor(game) }, "authority");
      const { mine } = rightAnswers(game);
      answerAll(game, mine);
      const wrong = game.state.interview.open!.questions.map((asked, index) => asked.options.find((option) => option !== rightAnswers(game).theirs[index])!);
      return game.accept({ type: "interview/scored", pair: PAIR, theirs: wrong }, "authority");
    })();
    expect(game.state.interview.last).toEqual({ route: PARTNER_ROUTE, result: "caught", matched: 0, asked: ALL.length, month: game.state.turn.month, standIn: { a: false, b: false } });
    expect(game.state.quality["quality.standing"]).toBe(standing - numbers.caughtStanding);
    expect(result.lines.find((line) => line.key === "line.interview.caught")?.params).toEqual({ route: PARTNER_ROUTE, matched: 0, asked: ALL.length });
  });

  test.each(["pass", "doubt", "fail"] as const)("[R-INTERVIEW-009] given a %s result, when it is scored, then standing does not move", (wanted) => {
    const right: Record<typeof wanted, number> = { pass: ALL.length, doubt: 5, fail: 3 };
    const game = sponsorLife();
    const standing = game.state.quality["quality.standing"];
    expect(scoreWith(game, right[wanted])).toBe(wanted);
    expect(game.state.quality["quality.standing"]).toBe(standing);
  });

  test("[R-INTERVIEW-010] given a sponsor already living abroad, when the interview is caught, then the sponsor keeps their status and the caught result is kept with its month", () => {
    const game = sponsorLife();
    const status = game.state.status;
    expect(scoreWith(game, 0)).toBe("caught");
    expect(game.state.status).toEqual(status);
    expect(game.state.interview.last).toMatchObject({ result: "caught", month: game.state.turn.month });
  });
});

describe("two lives", () => {
  test("[R-INTERVIEW-011] given an open interview, when the bond ends before both have answered, then the turn goes ahead and the interview closes unscored", () => {
    const game = sponsorLife();
    game.accept({ type: "interview/open", pair: PAIR, route: PARTNER_ROUTE, questions: questionsFor(game) }, "authority");
    game.accept({ type: "interview/answer", question: "first-spot", option: "beach" });
    setBond(game, BOND, { ...game.state.people.bonds[BOND]!, stage: "ended", ended: { month: game.state.turn.month, by: "them" } });
    expect(game.view().interview?.question).toBeNull();
    game.expectRejected({ type: "interview/answer", question: "first-what", option: "talked" }, "not-legal");
    const turn = game.endTurn();
    expect(turn.lines.map((line) => line.key)).toContain("line.interview.withdrawn");
    expect(game.state.interview).toEqual({ open: null, last: null, secret: { truths: null } });
  });

  test("[R-INTERVIEW-012] given the applicant's life and the sponsor's, when each answers the same questions and each is scored with the other's answers, then both reach the same result", () => {
    const applicant = life({ seed: "seed-7" });
    const sponsor = life({ seed: "seed-8" });
    // The two lives hold the same record, each from its own side.
    const mirrored = richMoments().map((item) => ({ ...item, by: item.by === "me" ? ("them" as const) : ("me" as const) }));
    setBond(applicant, BOND, bondWith(applicant.state, { facts: { ...FACTS, job: null, home: "city" } }));
    setBond(sponsor, BOND, bondWith(sponsor.state, { moments: mirrored, facts: { ...FACTS, job: null, home: "city" } }));
    applyNextMonth(applicant, PARTNER_ROUTE);
    send(applicant);
    const opened = applicant.state.interview.open!;
    sponsor.accept({ type: "interview/open", pair: PAIR, route: PARTNER_ROUTE, questions: opened.questions }, "authority");
    const answersOf = (game: Game, wrongAt: number): string[] => {
      const read = { state: game.state, world: game.world(), content: game.content };
      const bond = game.state.people.bonds[BOND]!;
      return game.state.interview.open!.questions.map((asked, index) => {
        const question = entry.questions.find((candidate) => candidate.id === asked.id)!;
        if (question.truth === null) return asked.options.at(-1)!;
        const truth = truthOf(read, bond, question.truth, "them")!;
        // Each side gets one wrong in a different place, so the comparison has work to do.
        return index === wrongAt ? asked.options.find((option) => option !== truth)! : truth;
      });
    };
    const mine = answersOf(applicant, 0);
    const theirs = answersOf(sponsor, 1);
    answerAll(applicant, mine);
    answerAll(sponsor, theirs);
    const sponsorDraws = sponsor.state.draws;
    applicant.accept({ type: "interview/scored", pair: PAIR, theirs }, "authority");
    sponsor.accept({ type: "interview/scored", pair: PAIR, theirs: mine }, "authority");
    const strip = (state: State) => ({ ...state.interview.last!, month: 0 });
    expect(strip(applicant.state)).toEqual(strip(sponsor.state));
    expect(applicant.state.interview.last!.matched).toBeLessThan(opened.questions.length);
    expect(sponsor.state.draws).toEqual(sponsorDraws);
  });

  test("[R-INTERVIEW-012] given a deep record in this life and the applicant's measure sent as thin, when a result short of pass is scored, then it is caught as the applicant's life finds it", () => {
    const at = mulDiv(numbers.passBp, ALL.length, 10000) - 1;
    const measured = sponsorLife();
    expect(isThin(measured.state, measured.state.people.bonds[BOND]!, numbers)).toBe(false);
    const sent = (thin: boolean): InterviewResult => {
      const game = sponsorLife();
      game.accept({ type: "interview/open", pair: PAIR, route: PARTNER_ROUTE, questions: questionsFor(game), thin }, "authority");
      expect(game.state.interview.open?.thin).toBe(thin);
      const { mine, theirs } = rightAnswers(game);
      answerAll(game, mine);
      const given = theirs.map((option, index) => (index < at ? option : game.state.interview.open!.questions[index]!.options.find((other) => other !== option)!));
      game.accept({ type: "interview/scored", pair: PAIR, theirs: given }, "authority");
      return game.state.interview.last!.result;
    };
    expect(sent(true)).toBe("caught");
    expect(sent(false)).toBe("doubt");
  });

  test("[R-INTERVIEW-012] given an application sent on a thin record, when the interview opens, then the applicant's measure is kept with it", () => {
    const game = applicantWithComputer({ bond: { moments: [], stage: "married" } });
    send(game);
    expect(game.state.interview.open?.thin).toBe(true);
  });

  test("[R-INTERVIEW-012] given the same start and commands, when the life is played again, then the interview's draws and result are the same", () => {
    const play = (): State => {
      const game = applicantWithComputer({ seed: "seed-11" });
      send(game);
      answerAll(game, pickRight(game));
      return game.state;
    };
    const first = play();
    expect(first.interview.last).not.toBeNull();
    expect(play()).toEqual(first);
  });
});

describe("thinness", () => {
  test("[R-INTERVIEW-002] given months together counted from the earlier of partner and married, when the record is measured, then the edges fall at the tuning's figures", () => {
    const game = sponsorLife();
    const month = game.state.turn.month;
    const rich = richMoments();
    const bond = (over: Partial<Bond>) => bondWith(game.state, over);
    expect(isThin(game.state, bond({ moments: rich, partnerMonth: month - numbers.thinMonths }), numbers)).toBe(false);
    expect(isThin(game.state, bond({ moments: rich, partnerMonth: month - numbers.thinMonths + 1, marriedMonth: null }), numbers)).toBe(true);
    expect(isThin(game.state, bond({ moments: rich, partnerMonth: null, marriedMonth: month - numbers.thinMonths }), numbers)).toBe(false);
    expect(isThin(game.state, bond({ moments: rich.slice(0, numbers.thinMoments), partnerMonth: month - numbers.thinMonths }), numbers)).toBe(false);
    expect(isThin(game.state, bond({ moments: rich.slice(0, numbers.thinMoments - 1), partnerMonth: month - numbers.thinMonths }), numbers)).toBe(true);
    expect(isThin(game.state, bond({ moments: [], partnerMonth: null, marriedMonth: null }), numbers)).toBe(true);
  });
});

describe("words", () => {
  test("[R-INTERVIEW-003] given the questions, when their words are looked up, then each question and each fixed option has words", () => {
    const keys = [
      `${GENUINENESS}.name`,
      `${GENUINENESS}.a.partner-job.${NO_JOB}`,
      ...entry.questions.flatMap((question) => [
        `${GENUINENESS}.q.${question.id}`,
        ...(Array.isArray(question.options) ? question.options.map((option) => `${GENUINENESS}.a.${question.id}.${option}`) : []),
      ]),
    ];
    expect(keys.filter((key) => (text[key] ?? "").trim() === "")).toEqual([]);
  });
});
