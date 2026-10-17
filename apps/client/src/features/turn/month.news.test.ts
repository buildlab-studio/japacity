// One story per month (docs/rules/world.md R-WORLD-008): the results and News never tell the same month two ways, as
// "A piece for the portfolio: two of three" beside "You have little work to show", and the results never promise an
// endorsement "next month" that is then refused. News reads the month as it closed,
// in the results' own words, and a wait whose outcome is still to be judged never promises one. Real content, the
// recorded lives and a developer's life played through `step`.
import { content } from "@japacity/content";
import type { Content, Id, PlayerView, ReportLine } from "@japacity/sim";
import { lifeSaves, applyEffects, readyLife, slot, start, type Game } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { recordedSave } from "../../shared/testing/fixtures";
import { tidyLines } from "../../shared/words/lines";
import { words } from "../../shared/words/text";
import { newsLines } from "../../shared/words/told";
import { storyLines, toldOnResults } from "./month.results";

const TALENT: Id<"route"> = "route.uk-talent";
const ENDORSEMENT: Id<"document"> = "document.endorsement";

/** One month as the screens get it: the lines of what was done mid-month, and the report the month's end stored. */
interface Month {
  mid: ReportLine[];
  report: ReportLine[];
  /** The view at the month's end, whose jobs and offers say what a job pays (R-WALLET-016). */
  view: PlayerView;
}

/** What the results sheet says, line by line, as its story. */
function resultsSay(month: Month): string[] {
  return storyLines([...month.mid, ...month.report]).map((line) => {
    const told = toldOnResults(line, month.view);
    return words(told.key, told.params);
  });
}

/** What News says of the same month. */
function newsSays(month: Month): string[] {
  return newsLines(month.mid, month.report, month.view).map((line) => words(line.key, line.params));
}

/** Plays a life's commands as the screens send them, keeping each month as its results and News read it. */
function monthsOf(game: Game, play: (send: (run: () => { lines: ReportLine[] }) => void, end: (run: () => unknown) => void) => void): Month[] {
  const months: Month[] = [];
  let mid: ReportLine[] = [];
  const send = (run: () => { lines: ReportLine[] }): void => {
    mid = [...mid, ...run().lines];
  };
  const end = (run: () => unknown): void => {
    run();
    const view = game.view();
    months.push({ mid, report: view.report?.lines ?? [], view });
    mid = [];
  };
  play(send, end);
  return months;
}

function recordedMonths(name: string): Month[] {
  const save = recordedSave(name);
  const game = start({ scenario: save.scenario, seed: save.seed, worldSeed: save.worldSeed, content });
  return monthsOf(game, (send, end) => {
    for (const { command, sender } of save.commands) {
      if (command.type === "turn/end") end(() => game.accept(command, sender));
      else send(() => game.accept(command, sender));
    }
  });
}

/** Content whose endorsing body never backs anyone, so the wait ends in a refusal. */
function neverEndorsed(used: Content): Content {
  const route = used.route[TALENT]!;
  return { ...used, route: { ...used.route, [TALENT]: { ...route, endorsement: { ...route.endorsement!, baseBp: 0, perPortfolioBp: 0, perNetworkBp: 0 } } } };
}

/** The developer of the review: pieces built and open source from nothing, the talent route looked into, the endorsement asked for and refused. */
function developerMonths(): Month[] {
  const game = readyLife(content, { from: "scenario.zainab", quiet: true, change: neverEndorsed, qualities: { "quality.tech": 85, "quality.portfolio": 0, "quality.network": 70 } });
  return monthsOf(game, (send, end) => {
    for (let month = 0; month < 6 && (game.state.quality["quality.portfolio"] ?? 0) < 3; month += 1) end(() => game.endTurn([slot("activity.build-portfolio"), slot("activity.open-source")]));
    applyEffects(game, [{ type: "route/hear", route: TALENT, via: "meetup" }]);
    end(() => game.endTurn([slot("activity.look-into-route", TALENT)]));
    send(() => game.accept({ type: "activity/now", activity: "activity.apply-endorsement", param: null }));
    const ready = game.state.document[ENDORSEMENT]?.readyMonth ?? 0;
    end(() => game.endTurn());
    while (game.state.turn.month < ready) end(() => game.endTurn());
  });
}

const LIVES = Object.keys(lifeSaves);

describe("News and the results tell one story a month", () => {
  test.each(LIVES)("[R-WORLD-008] given the recorded life %s, when each month's News is read beside its results, then every line the results tell is in News in the same words", (name) => {
    for (const month of recordedMonths(name)) {
      const news = newsSays(month);
      for (const said of resultsSay(month)) expect(news).toContain(said);
    }
  });

  test("[R-WORLD-008] given the developer's life, when a piece goes into the portfolio from nothing, then News counts it as the results do and never says there is little work to show", () => {
    const months = developerMonths();
    const pieces = months.filter((month) => resultsSay(month).some((said) => said.includes(words("quality.portfolio.name").toLowerCase()) || said.startsWith("A piece")));
    expect(pieces.length).toBeGreaterThan(0);
    for (const month of months) {
      const news = newsSays(month);
      for (const said of resultsSay(month)) expect(news).toContain(said);
      expect(news).not.toContain(words("ui.band.quality.portfolio.0") + ".");
    }
  });

  test("[R-WORLD-008] [R-ENDORSE-002] given the developer's endorsement asked for and later refused, when the month it was asked for is read, then the wait names who answers and when, and promises nothing", () => {
    const months = developerMonths();
    const asked = months.find((month) => [...month.mid, ...month.report].some((line) => line.key === "line.document.requested" && line.params.document === ENDORSEMENT));
    expect(asked).toBeDefined();
    const told = [...resultsSay(asked!), ...newsSays(asked!)].filter((said) => said.includes("endorsing body"));
    expect(told.length).toBeGreaterThan(0);
    for (const said of told) expect(said).not.toMatch(/should|ready|on the way/i);
    expect(told.some((said) => said.startsWith("The endorsing body answers"))).toBe(true);
    expect(months.some((month) => month.report.some((line) => line.key === "line.route.endorsement-refused"))).toBe(true);
  });

  test("[R-WORLD-008] given every paper a route judges when it is issued, when its request is told, then the words never say it should be ready", () => {
    const judged = Object.values(content.route).flatMap((route) => (route?.endorsement === undefined || route.endorsement === null ? [] : [route.endorsement.document]));
    expect(judged.length).toBeGreaterThan(0);
    for (const document of judged) {
      const [told] = tidyLines([{ key: "line.document.requested", params: { document, month: 3 }, tone: "plain", attention: false, counts: [] }]);
      expect(words(told!.key, told!.params)).not.toMatch(/should be ready|on the way/i);
    }
  });
});
