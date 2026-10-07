// The saves the goldens are measured from. `pnpm bless` turns each into a
// JSON file beside this one. Add a script here, run bless, commit both.
import type { Currency, Id, Save, SlotPick } from "../engine/types";
import type { Loose } from "../testing/play";

export interface GoldenScript {
  name: string;
  save: Save;
}

const rest: SlotPick = { activity: "activity.rest", param: null };
const study: SlotPick = { activity: "activity.study", param: null };

function turns(count: number, startTick: number, slots: SlotPick[] = []): Save["commands"] {
  const commands: Save["commands"] = [];
  for (let i = 0; i < count; i += 1) {
    commands.push({ command: { type: "turn/end", slots, basedOn: -1 }, tick: startTick + i, sender: "player" });
  }
  return commands;
}

/** Fills in `basedOn` from position, since every command here is accepted. */
function numbered(commands: Save["commands"]): Save["commands"] {
  return commands.map((entry, index) => ({ ...entry, command: { ...entry.command, basedOn: index } }));
}

export const goldenScripts: GoldenScript[] = [
  {
    name: "mini-plain-resting",
    save: {
      schema: 1,
      content: "mini.1",
      scenario: "scenario.plain",
      seed: "golden-plain",
      worldSeed: "golden-world",
      commands: numbered(turns(6, 0, [rest, rest, rest])),
    },
  },
  {
    name: "mini-worker-studying",
    save: {
      schema: 1,
      content: "mini.1",
      scenario: "scenario.worker",
      seed: "golden-worker",
      worldSeed: "golden-world",
      commands: numbered([
        ...turns(3, 0, [study]),
        { command: { type: "turns/grant", count: 2, basedOn: -1 }, tick: 3, sender: "authority" },
        ...turns(3, 3, []),
      ]),
    },
  },
];

// ---------------------------------------------------------------------------
// The three real lives, played through the real content by the simulated
// players in packages/sim/src/sweep/players.ts and recorded command by command.
// ---------------------------------------------------------------------------

/** One free slot: the activity's slug without its kind, and the param it takes. */
type Pick = [string] | [string, string];

function end(...picks: Pick[]): Loose {
  return { type: "turn/end", slots: picks.map(([activity, param]) => ({ activity: `activity.${activity}`, param: param ?? null })) };
}

function choose(offer: string, choice: string, amount?: number): Loose {
  return amount === undefined ? { type: "offer/choose", offer, choice } : { type: "offer/choose", offer, choice, amount };
}

function convert(from: Currency, to: Currency, amount: number, via: "bank" | "aboki"): Loose {
  return { type: "wallet/convert", from, to, amount, via };
}

function pay(obligation: string, amount: number): Loose {
  return { type: "obligation/pay", obligation, amount };
}

function deposit(school: string): Loose {
  return { type: "route/pay-deposit", route: "route.uk-masters", school: school as Id<"school"> };
}

function depart(): Loose {
  return { type: "route/depart", route: "route.uk-masters" };
}

function answer(question: string, chosen: string): Loose {
  return { type: "setpiece/answer", question, answer: chosen };
}

/**
 * A save from a list of commands: each command's tick is the number of months
 * ended before it, its `basedOn` its position, and a grant is the authority's.
 */
function life(name: string, scenario: string, seed: string, steps: Loose[]): GoldenScript {
  let tick = 0;
  const commands: Save["commands"] = steps.map((step, index) => {
    const entry = { command: { ...step, basedOn: index }, tick, sender: step.type === "turns/grant" ? ("authority" as const) : ("player" as const) };
    if (step.type === "turn/end") tick += 1;
    return entry;
  });
  return { name, save: { schema: 2, content: "m0.1", scenario: scenario as Id<"scenario">, seed, worldSeed: "golden-world", commands } };
}

/**
 * Not yet blessed: engine/goldens.test.ts replays every golden against the
 * mini content only, so these wait outside `goldenScripts` until it looks the
 * content up by version as tools/bless.ts does. sweep/lives.test.ts replays them.
 */
export const lifeScripts: GoldenScript[] = [
  // careful from ada: departs in month 25, decisions granted.
  life("ada-careful", "scenario.ada", "golden-ada-39", [
    end(["job-hunt", "activity.job-junior-dev"], ["learn-tech"], ["learn-tech"]),
    choose("offer-2", "accept"),
    end(["build-portfolio"], ["build-portfolio"]),
    choose("offer-3", "pay"),
    choose("offer-4", "pay"),
    end(["look-into-route", "route.uk-masters"], ["build-portfolio"]),
    end(["get-passport"], ["get-transcript"]),
    choose("offer-5", "buy"),
    convert("NGN", "GBP", 4000000, "bank"),
    end(["study-english"], ["learn-tech"]),
    convert("NGN", "GBP", 20000000, "bank"),
    end(["study-english"], ["learn-tech"]),
    convert("NGN", "GBP", 20000000, "bank"),
    end(["study-english"], ["learn-tech"]),
    convert("NGN", "GBP", 20000000, "bank"),
    end(["sit-english-test"], ["rest"]),
    choose("offer-6", "pay"),
    end(["learn-tech"], ["learn-tech"]),
    convert("NGN", "GBP", 1450000, "bank"),
    end(["job-hunt", "activity.job-remote-dev"], ["apply-to-school", "school.northgate"]),
    choose("offer-7", "pay"),
    convert("NGN", "GBP", 20000000, "bank"),
    end(["job-hunt", "activity.job-remote-dev"], ["apply-to-school", "school.ashby"]),
    end(["job-hunt", "activity.job-remote-dev"], ["apply-to-school", "school.kingsmere"]),
    choose("offer-8", "buy"),
    end(["job-hunt", "activity.job-remote-dev"], ["family-meeting"]),
    choose("offer-9", "accept"),
    choose("offer-10", "accept"),
    choose("offer-11", "no"),
    end(["interview-prep"], ["side-gig"]),
    convert("USD", "NGN", 154755, "bank"),
    end(["interview-prep"], ["rest"]),
    convert("USD", "NGN", 6564, "bank"),
    end(["side-gig"], ["side-gig"]),
    choose("offer-12", "repair"),
    choose("offer-13", "give"),
    convert("USD", "NGN", 128447, "bank"),
    deposit("school.northgate"),
    convert("USD", "NGN", 234782, "bank"),
    convert("NGN", "GBP", 95993400, "bank"),
    convert("NGN", "GBP", 1441722, "bank"),
    end(["rest"], ["rest"]),
    choose("offer-14", "no"),
    choose("offer-15", "go"),
    convert("NGN", "GBP", 95589900, "bank"),
    convert("NGN", "GBP", 1435661, "bank"),
    end(["side-gig"], ["side-gig"]),
    convert("USD", "NGN", 1178, "bank"),
    convert("NGN", "GBP", 96554900, "bank"),
    convert("NGN", "GBP", 1450156, "bank"),
    end(["side-gig"], ["side-gig"]),
    choose("offer-16", "take", 1168569721),
    choose("offer-17", "walk-away"),
    convert("USD", "NGN", 61648, "bank"),
    end(["tb-test"], ["rest"]),
    convert("USD", "NGN", 26278, "bank"),
    end(["side-gig"], ["side-gig"]),
    choose("offer-19", "no"),
    convert("USD", "NGN", 22156, "bank"),
    end(["rest"], ["rest"]),
    choose("offer-20", "do-it"),
    choose("offer-21", "pay"),
    convert("USD", "NGN", 37393, "bank"),
    end(["side-gig"], ["side-gig"]),
    choose("offer-22", "no"),
    convert("USD", "NGN", 20527, "bank"),
    end(["apply-for-visa"], ["side-gig"]),
    answer("why-uk", "course"),
    answer("course", "detail"),
    answer("living", "figures"),
    choose("offer-23", "message"),
    convert("USD", "NGN", 26316, "bank"),
    end(["rest"], ["rest"]),
    choose("offer-24", "no"),
    choose("offer-25", "no"),
    convert("USD", "NGN", 118182, "bank"),
    pay("obligation-18", 1168569721),
    depart(),
  ]),
  // borrower from tunde: departs in month 32, decisions refused (funds) then granted.
  life("tunde-borrower", "scenario.tunde", "golden-tunde-2", [
    end(["job-hunt", "activity.job-bank-senior"], ["learn-tech"]),
    end(["job-hunt", "activity.job-bank-senior"], ["learn-tech"]),
    choose("offer-2", "accept"),
    choose("offer-3", "take", 128000000),
    choose("offer-4", "go"),
    end(["look-into-route", "route.uk-masters"], ["learn-tech"]),
    choose("offer-6", "pay"),
    end(["get-transcript"], ["study-english"]),
    end(["study-english"], ["rest"]),
    choose("offer-7", "sell"),
    choose("offer-8", "pay"),
    end(["study-english"], ["learn-tech"]),
    choose("offer-9", "pay"),
    end(["sit-english-test"], ["rest"]),
    end(["learn-tech"], ["learn-tech"]),
    end(["sit-english-test"], ["rest"]),
    end(["learn-tech"], ["learn-tech"]),
    choose("offer-10", "go"),
    choose("offer-11", "pay"),
    end(["apply-to-school", "school.northgate"], ["build-portfolio"]),
    choose("offer-12", "take", 224000000),
    end(["rest"], ["rest"]),
    end(["family-meeting"], ["interview-prep"]),
    choose("offer-14", "accept"),
    end(["build-portfolio"], ["build-portfolio"]),
    choose("offer-15", "pay"),
    end(["learn-tech"], ["learn-tech"]),
    end(["rest"], ["rest"]),
    deposit("school.northgate"),
    end(["learn-tech"], ["learn-tech"]),
    choose("offer-16", "take", 672000000),
    choose("offer-17", "pay"),
    end(["learn-tech"], ["learn-tech"]),
    end(["learn-tech"], ["learn-tech"]),
    choose("offer-19", "take", 672000000),
    end(["job-hunt", "activity.job-remote-dev"], ["rest"]),
    choose("offer-22", "go"),
    end(["job-hunt", "activity.job-remote-dev"], ["side-gig"]),
    choose("offer-23", "take", 672000000),
    end(["job-hunt", "activity.job-remote-dev"], ["side-gig"]),
    choose("offer-25", "repair"),
    choose("offer-26", "pay"),
    end(["job-hunt", "activity.job-remote-dev"], ["get-passport"]),
    choose("offer-27", "take", 672000000),
    end(["job-hunt", "activity.job-remote-dev"], ["rest"]),
    choose("offer-30", "accept"),
    choose("offer-31", "buy"),
    end(["side-gig"], ["side-gig"]),
    choose("offer-32", "take", 3000000000),
    choose("offer-33", "pay"),
    convert("USD", "NGN", 150206, "bank"),
    end(["rest"], ["rest"]),
    convert("USD", "NGN", 154154, "bank"),
    end(["tb-test"], ["side-gig"]),
    choose("offer-35", "take", 3000000000),
    choose("offer-36", "walk-away"),
    convert("USD", "NGN", 245530, "bank"),
    end(["apply-for-visa"], ["side-gig"]),
    answer("living", "figures"),
    answer("deposit", "agreement"),
    answer("why-uk", "course"),
    convert("USD", "NGN", 226401, "bank"),
    end(["rest"], ["rest"]),
    convert("USD", "NGN", 617126, "bank"),
    deposit("school.northgate"),
    convert("USD", "NGN", 6583, "bank"),
    end(["side-gig"], ["side-gig"]),
    choose("offer-38", "take", 3000000000),
    choose("offer-39", "leave"),
    convert("USD", "NGN", 280000, "bank"),
    end(["apply-for-visa"], ["side-gig"]),
    answer("why-uk", "course"),
    answer("after", "return"),
    answer("who-pays", "own"),
    convert("USD", "NGN", 25099, "bank"),
    end(["rest"], ["rest"]),
    choose("offer-41", "no"),
    convert("USD", "NGN", 123210, "bank"),
    pay("obligation-18", 672000000),
    pay("obligation-21", 672000000),
    depart(),
  ]),
  // careful from zainab: departs in month 26, decisions granted.
  life("zainab-remote", "scenario.zainab", "golden-zainab-5", [
    end(["build-portfolio"], ["build-portfolio"]),
    end(["job-hunt", "activity.job-mid-dev"], ["learn-tech"]),
    end(["look-into-route", "route.uk-masters"], ["job-hunt", "activity.job-mid-dev"]),
    choose("offer-3", "send"),
    convert("NGN", "GBP", 26500000, "bank"),
    end(["job-hunt", "activity.job-mid-dev"], ["get-passport"]),
    convert("NGN", "GBP", 3000000, "bank"),
    end(["job-hunt", "activity.job-mid-dev"], ["get-transcript"]),
    choose("offer-4", "accept"),
    convert("NGN", "GBP", 10500000, "bank"),
    end(["study-english"], ["learn-tech"]),
    convert("NGN", "GBP", 68113400, "bank"),
    convert("NGN", "GBP", 1022964, "bank"),
    end(["job-hunt", "activity.job-remote-dev"], ["study-english"]),
    choose("offer-5", "no"),
    choose("offer-6", "give"),
    convert("NGN", "GBP", 68160900, "bank"),
    convert("NGN", "GBP", 1023678, "bank"),
    end(["job-hunt", "activity.job-remote-dev"], ["sit-english-test"]),
    convert("NGN", "GBP", 68985400, "bank"),
    convert("NGN", "GBP", 1036062, "bank"),
    end(["job-hunt", "activity.job-remote-dev"], ["rest"]),
    choose("offer-7", "pay"),
    convert("NGN", "GBP", 69033400, "bank"),
    convert("NGN", "GBP", 1036783, "bank"),
    end(["job-hunt", "activity.job-remote-dev"], ["apply-to-school", "school.northgate"]),
    choose("offer-8", "pay"),
    convert("NGN", "GBP", 68549900, "bank"),
    convert("NGN", "GBP", 1029521, "bank"),
    end(["job-hunt", "activity.job-remote-dev"], ["apply-to-school", "school.ashby"]),
    end(["job-hunt", "activity.job-remote-dev"], ["family-meeting"]),
    choose("offer-9", "accept"),
    choose("offer-10", "pay"),
    end(["job-hunt", "activity.job-remote-dev"], ["interview-prep"]),
    choose("offer-11", "pay"),
    end(["job-hunt", "activity.job-remote-dev"], ["interview-prep"]),
    choose("offer-12", "accept"),
    end(["rest"], ["rest"]),
    end(["side-gig"], ["side-gig"]),
    choose("offer-13", "pay"),
    choose("offer-14", "send"),
    deposit("school.northgate"),
    convert("USD", "NGN", 193444, "bank"),
    convert("NGN", "GBP", 95993400, "bank"),
    convert("NGN", "GBP", 1441722, "bank"),
    end(["side-gig"], ["side-gig"]),
    choose("offer-15", "no"),
    convert("NGN", "GBP", 95589900, "bank"),
    convert("NGN", "GBP", 1435661, "bank"),
    end(["rest"], ["rest"]),
    convert("USD", "NGN", 4200, "bank"),
    convert("NGN", "GBP", 96554900, "bank"),
    convert("NGN", "GBP", 1450156, "bank"),
    end(["side-gig"], ["side-gig"]),
    choose("offer-16", "no"),
    choose("offer-17", "buy"),
    convert("NGN", "GBP", 94900192, "bank"),
    end(["side-gig"], ["side-gig"]),
    end(["rest"], ["rest"]),
    choose("offer-18", "no"),
    choose("offer-19", "pay"),
    convert("USD", "NGN", 2215, "bank"),
    end(["side-gig"], ["side-gig"]),
    choose("offer-20", "pay"),
    convert("USD", "NGN", 2553, "bank"),
    end(["side-gig"], ["side-gig"]),
    choose("offer-21", "take", 200000000),
    convert("USD", "NGN", 10810, "bank"),
    end(["tb-test"], ["rest"]),
    choose("offer-23", "walk-away"),
    choose("offer-24", "no"),
    convert("USD", "NGN", 15263, "bank"),
    end(["apply-for-visa"], ["side-gig"]),
    answer("who-pays", "own"),
    answer("course", "detail"),
    answer("living", "figures"),
    choose("offer-25", "no"),
    convert("USD", "NGN", 6642, "bank"),
    end(["rest"], ["rest"]),
    choose("offer-26", "plain"),
    convert("USD", "NGN", 98098, "bank"),
    pay("obligation-22", 200000000),
    depart(),
  ]),
];
