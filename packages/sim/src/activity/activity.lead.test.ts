// A miss moves the story (activity:missed-hunt-opens-a-lead): in a starting life's first three months, the first hunt
// at home that misses with no job held and no job offer open opens Lanre's lead, once a life. Played on the real content.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { valueInKobo } from "../engine/int";
import type { ActivityEntry, Id, OfferView, ReportLine, SlotPick } from "../engine/types";
import { isEarlyWin } from "../guide/guide.earlyWin";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { readOf } from "../testing/read";
import { HUNT } from "../testing/ids";
import { leadJob } from "./activity.logic";

const TEACHER: Id<"activity"> = "activity.job-teacher";
const AGENT: Id<"activity"> = "activity.job-customer-service";
const BANK: Id<"activity"> = "activity.job-bank-officer";
const LEAD: Id<"offer"> = "offer.job-lead";
const WORD: Id<"offer"> = "offer.job-word";
const JOB_OFFER: Id<"offer"> = "offer.job";
const LEADS: readonly string[] = [LEAD, WORD];
const LEAD_LINES: readonly string[] = ["line.activity.hunt-lead", "line.activity.hunt-word"];
/** Enough seeds that a hunt at a fair chance both lands and misses among them. */
const TRIES = 60;

function entryOf(id: string): ActivityEntry {
  const entry = content.activity[id as Id<"activity">];
  if (entry === undefined) throw new Error(`No ${id} in content.`);
  return entry;
}

function graduate(seed: string): Game {
  return start({ scenario: "scenario.graduate", content, seed });
}

const huntFor = (job: Id<"activity">): SlotPick[] => [{ activity: HUNT, param: job }];

function huntLines(lines: readonly ReportLine[]): ReportLine[] {
  return lines.filter((line) => line.key === "line.activity.hunt-missed" || line.key === "line.activity.hunt-hired" || LEAD_LINES.includes(line.key));
}

function leadsOpen(game: Game): OfferView[] {
  return game.view().offers.filter((offer) => LEADS.includes(offer.entry));
}

function missed(lines: readonly ReportLine[], job: Id<"activity">): boolean {
  return lines.some((line) => line.key === "line.activity.hunt-missed" && line.params["job"] === job);
}

/**
 * The first seed whose life, played by `play`, meets `wanted`: the draws differ by seed, so a miss and a landing are each
 * found among a few. Fails when none of the seeds gives it.
 */
function firstWhere(make: (seed: string) => Game, play: (game: Game) => ReportLine[], wanted: (game: Game, lines: ReportLine[]) => boolean): { game: Game; lines: ReportLine[] } {
  for (let at = 0; at < TRIES; at += 1) {
    const game = make(`lead-${String(at)}`);
    const lines = play(game);
    if (wanted(game, lines)) return { game, lines };
  }
  throw new Error(`No seed of ${String(TRIES)} gave the life asked for.`);
}

/** The jobs the view offers to hunt now in this slot, by a month's pay in naira at the official rate, lowest first, then by id. */
function byWage(game: Game, slot: ActivityEntry["slot"]): Id<"activity">[] {
  const rates = Object.fromEntries(Object.entries(game.world().rates).map(([currency, rate]) => [currency, rate.official])) as Parameters<typeof valueInKobo>[2];
  const params = game.view().activities.find((option) => option.id === HUNT)?.params ?? [];
  return params
    .map(entryOf)
    .filter((entry) => entry.slot === slot && entry.pay !== null && typeof entry.pay.amount === "number")
    .map((entry) => ({ id: entry.id, kobo: valueInKobo(entry.pay!.amount as number, entry.pay!.currency, rates) }))
    .sort((a, b) => a.kobo - b.kobo || (a.id < b.id ? -1 : 1))
    .map((found) => found.id);
}

/** A first month whose hunt for the teacher's job missed. */
function teacherMissed(): { game: Game; lines: ReportLine[] } {
  return firstWhere(graduate, (game) => game.endTurn(huntFor(TEACHER)).lines, (_game, lines) => missed(lines, TEACHER));
}

function decline(game: Game, offer: OfferView): void {
  game.accept({ type: "offer/choose", offer: offer.id, choice: "decline" });
}

describe("the lead after a first miss", () => {
  test("[activity:missed-hunt-opens-a-lead] given the graduate's first hunt, for the teacher's job, when the draw misses, then the month says the teacher's job came to nothing and then Lanre's lead, a good line, for the lowest-paid main job that covers its dues, and the lead opens with the job, the job missed and their words", () => {
    const { game, lines } = teacherMissed();
    const told = huntLines(lines);
    expect(told.map((line) => line.key)).toEqual(["line.activity.hunt-missed", "line.activity.hunt-lead"]);
    const lead = told[1]!;
    expect(lead.tone).toBe("good");
    expect(lead.params).toEqual({ job: AGENT, missed: TEACHER, lead: `${AGENT}.lead`, cost: `${TEACHER}.lead-cost` });
    const offers = leadsOpen(game);
    expect(offers.map((offer) => offer.entry)).toEqual([LEAD]);
    expect(offers[0]!.terms).toEqual({ job: AGENT, missed: TEACHER, lead: `${AGENT}.lead`, cost: `${TEACHER}.lead-cost` });
    expect(offers[0]!.expiresMonth - offers[0]!.openedMonth).toBe(content.offer[LEAD]!.expiresAfter);
    expect(game.view().offers.some((offer) => offer.entry === JOB_OFFER)).toBe(false);
    expect(game.state.activity.lead).toBe(true);
  });

  test("[activity:missed-hunt-opens-a-lead] given the graduate's dues above the teacher's pay, when the lead's job is read for any main job missed, then it is the lowest-paid main job whose pay covers the dues, not the lowest-paid job", () => {
    const game = graduate("lead-wages");
    const wages = byWage(game, "main");
    const dues = Object.values(game.state.obligation.items).reduce((sum, item) => sum + item.amount, 0);
    const covering = wages.find((id) => {
      const pay = entryOf(id).pay;
      return pay !== null && pay.currency === "NGN" && typeof pay.amount === "number" && pay.amount >= dues;
    });
    expect(covering).toBe(AGENT);
    expect(covering).not.toBe(wages[0]);
    for (const named of wages) expect(leadJob(readOf(game), entryOf(named)).id).toBe(covering);
  });

  test("[activity:missed-hunt-opens-a-lead] given a side job missed, when the lead's job is read, then it is the lowest-paid side job", () => {
    const game = graduate("lead-sides");
    const sides = byWage(game, "side");
    expect(sides.length).toBeGreaterThan(1);
    expect(leadJob(readOf(game), entryOf(sides[sides.length - 1]!)).id).toBe(sides[0]);
  });

  test("[activity:missed-hunt-opens-a-lead] [guide:early-win-in-three-turns] given the lead's line, when the early win is looked for, then it counts, whatever the month's other picks", () => {
    const { lines } = teacherMissed();
    const lead = lines.find((line) => LEAD_LINES.includes(line.key))!;
    expect(isEarlyWin(lead, huntFor(TEACHER))).toBe(true);
    expect(isEarlyWin(lead, null)).toBe(true);
  });

  test("[activity:missed-hunt-opens-a-lead] given the lead, when it is taken, then the job it names starts", () => {
    const { game } = teacherMissed();
    game.accept({ type: "offer/choose", offer: leadsOpen(game)[0]!.id, choice: "accept" });
    expect(game.state.activity.job).toBe(AGENT);
    expect(leadsOpen(game)).toEqual([]);
  });

  test("[activity:missed-hunt-opens-a-lead] given the lead left unanswered, when its two months pass, then it lapses into nothing", () => {
    const { game } = teacherMissed();
    const opened = leadsOpen(game)[0]!;
    while (game.state.turn.month < opened.expiresMonth) game.endTurn([]);
    expect(leadsOpen(game)).toEqual([]);
    expect(game.state.activity.job).toBeNull();
  });
});

describe("where no lead opens", () => {
  test("[activity:missed-hunt-opens-a-lead] given the graduate's first hunt, when the draw lands, then the job offer opens and no lead, and no mark is kept", () => {
    const { game, lines } = firstWhere(graduate, (one) => one.endTurn(huntFor(TEACHER)).lines, (_one, told) => told.some((line) => line.key === "line.activity.hunt-hired"));
    expect(huntLines(lines).map((line) => line.key)).toEqual(["line.activity.hunt-hired"]);
    expect(leadsOpen(game)).toEqual([]);
    expect(game.state.activity.lead).toBeUndefined();
  });

  test("[activity:missed-hunt-opens-a-lead] given the months rested, when the first hunt misses in the third month, then the lead opens; when it misses in the fourth, then none", () => {
    const resting = (months: number) => (game: Game) => {
      for (let month = 1; month < months; month += 1) game.endTurn([]);
      return game.endTurn(huntFor(TEACHER)).lines;
    };
    const third = firstWhere(graduate, resting(3), (_game, lines) => missed(lines, TEACHER));
    expect(third.game.state.turn.month).toBe(3);
    expect(leadsOpen(third.game).map((offer) => offer.entry)).toEqual([LEAD]);
    const fourth = firstWhere(graduate, resting(4), (_game, lines) => missed(lines, TEACHER));
    expect(fourth.game.state.turn.month).toBe(4);
    expect(huntLines(fourth.lines).map((line) => line.key)).toEqual(["line.activity.hunt-missed"]);
    expect(leadsOpen(fourth.game)).toEqual([]);
    expect(fourth.game.state.activity.lead).toBeUndefined();
  });

  test("[activity:missed-hunt-opens-a-lead] given the lead declined, when the next month's hunt misses too, then the lead is gone and no second lead opens", () => {
    const { game } = firstWhere(
      graduate,
      (one) => {
        const first = one.endTurn(huntFor(TEACHER)).lines;
        if (!missed(first, TEACHER)) return [];
        decline(one, leadsOpen(one)[0]!);
        expect(leadsOpen(one)).toEqual([]);
        return one.endTurn(huntFor(TEACHER)).lines;
      },
      (_one, lines) => missed(lines, TEACHER),
    );
    expect(leadsOpen(game)).toEqual([]);
    expect(game.view().offers.some((offer) => offer.entry === JOB_OFFER)).toBe(false);
    expect(game.state.activity.job).toBeNull();
  });

  test("[activity:missed-hunt-opens-a-lead] given a life with a job held, hunting a better one, when the hunt misses in its first month, then no lead opens", () => {
    const developer = (seed: string) => start({ scenario: "scenario.developer", content, seed });
    expect(developer("lead-held").state.activity.job).not.toBeNull();
    const { game, lines } = firstWhere(developer, (one) => one.endTurn(huntFor(BANK)).lines, (_one, told) => missed(told, BANK));
    expect(huntLines(lines).map((line) => line.key)).toEqual(["line.activity.hunt-missed"]);
    expect(leadsOpen(game)).toEqual([]);
  });

  test("[activity:missed-hunt-opens-a-lead] given a job offer from an earlier hunt still open, when a hunt for another job misses, then no lead opens", () => {
    const { game, lines } = firstWhere(
      graduate,
      (one) => {
        const first = one.endTurn(huntFor(TEACHER)).lines;
        if (!first.some((line) => line.key === "line.activity.hunt-hired")) return [];
        return one.endTurn(huntFor(BANK)).lines;
      },
      (_one, told) => missed(told, BANK),
    );
    expect(game.view().offers.some((offer) => offer.entry === JOB_OFFER)).toBe(true);
    expect(huntLines(lines).map((line) => line.key)).toEqual(["line.activity.hunt-missed"]);
    expect(leadsOpen(game)).toEqual([]);
  });
});

describe("the word put in for the job missed", () => {
  test("[activity:missed-hunt-opens-a-lead] given the graduate's first hunt for the lead's own job, when the draw misses, then Lanre puts in a word for that same job: the word's offer opens for it, with no cost said, and no second pitch for it", () => {
    const { game, lines } = firstWhere(graduate, (one) => one.endTurn(huntFor(AGENT)).lines, (_one, told) => missed(told, AGENT));
    const told = huntLines(lines);
    expect(told.map((line) => line.key)).toEqual(["line.activity.hunt-missed", "line.activity.hunt-word"]);
    expect(told[1]!.tone).toBe("good");
    expect(told[1]!.params).toEqual({ job: AGENT, lead: `${AGENT}.lead` });
    const offers = leadsOpen(game);
    expect(offers.map((offer) => offer.entry)).toEqual([WORD]);
    expect(offers[0]!.terms).toEqual({ job: AGENT, lead: `${AGENT}.lead` });
  });
});

describe("one lead a life, whichever way the hunt is played", () => {
  test("[activity:missed-hunt-opens-a-lead] [activity:now-acts-and-month-acts] given a first hunt sent as a now-act that misses and its lead declined, when the next month's hunt in a slot misses, then no second lead opens", () => {
    const { game, lines } = firstWhere(
      graduate,
      (one) => {
        one.accept({ type: "activity/now", activity: HUNT, param: TEACHER });
        const first = one.endTurn([]).lines;
        if (!missed(first, TEACHER) || leadsOpen(one).length !== 1) return [];
        decline(one, leadsOpen(one)[0]!);
        return one.endTurn(huntFor(TEACHER)).lines;
      },
      (_one, told) => missed(told, TEACHER),
    );
    expect(huntLines(lines).map((line) => line.key)).toEqual(["line.activity.hunt-missed"]);
    expect(leadsOpen(game)).toEqual([]);
  });

  test("[activity:missed-hunt-opens-a-lead] [activity:now-acts-and-month-acts] given a first hunt in a month's slot that misses and its lead declined, when the next month's hunt sent as a now-act misses, then no second lead opens", () => {
    const { game, lines } = firstWhere(
      graduate,
      (one) => {
        const first = one.endTurn(huntFor(TEACHER)).lines;
        if (!missed(first, TEACHER) || leadsOpen(one).length !== 1) return [];
        decline(one, leadsOpen(one)[0]!);
        one.accept({ type: "activity/now", activity: HUNT, param: TEACHER });
        return one.endTurn([]).lines;
      },
      (_one, told) => missed(told, TEACHER),
    );
    expect(huntLines(lines).map((line) => line.key)).toEqual(["line.activity.hunt-missed"]);
    expect(leadsOpen(game)).toEqual([]);
  });
});
