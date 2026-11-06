// One figure across the screens: what the results say against the board, the
// Bank and News, beside the shell since each assertion reads two features (tests/boundaries.test.ts). Played on the
// real engine from the tiles' own years.
import { act } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { Bank } from "../features/phone/apps/Bank";
import { savings } from "../features/turn/month.results";
import { Results } from "../features/turn/Results";
import { type Archetype, archetypeOf } from "../shared/front-door/archetypes";
import { playTile } from "../shared/front-door/archetypes.testing";
import { newGame } from "../shared/testing/fixtures";
import { renderWithView } from "../shared/testing/render";
import { formatMoney } from "../shared/words/format";
import { say, words } from "../shared/words/text";
import { newsLines, toldOnResults } from "../shared/words/told";

const HUNT = "activity.job-hunt";
const JUNIOR_DEV = "activity.job-junior-developer";
const TALENT = "route.uk-talent";

/** A tile's life from sixteen, handed over: its preset played on one seed. */
function lifeOf(tile: Archetype, seed: string): ReturnType<typeof newGame> {
  const game = newGame("scenario.prologue", seed);
  playTile(game, tile);
  return game;
}

/** The developer tile's life, handed over. */
function developer(): ReturnType<typeof newGame> {
  return lifeOf(archetypeOf("developer")!, "developer-0");
}

describe("Saved for the move on the results and the Bank", () => {
  test("[world:phone-holds-what-phones-hold] given the developer who hears of the talent visa at the meetup in its first month, when the month's results and the Bank are read before the official page, then both say the same figure toward the move", async () => {
    const game = developer();
    game.accept({ type: "activity/now", activity: "activity.meetup", param: null });
    game.endTurn([]);
    const view = game.view();
    expect(view.plan.route).toBe(TALENT);
    expect(view.routes.find((route) => route.id === TALENT)?.state).toBe("heard");
    const shown = savings(view);
    if (shown === null || shown.kind !== "funds") throw new Error("The results show no figure toward the move.");
    await renderWithView(<Bank />, view);
    expect(document.querySelector("[data-savings-none]")).toBeNull();
    expect(document.querySelector("[data-savings]")?.textContent).toContain(say("phone.bank.savings.line", { shown: formatMoney(shown.shown, shown.currency), required: formatMoney(shown.required, shown.currency) }));
  });
});

describe("the first miss and its lead", () => {
  test("[activity:job-hunt-lands-offer] [activity:missed-hunt-opens-a-lead] [world:month-end-results-sheet] given the developer's application for the junior developer's job with the month full, when the draw misses, then the results and News say the junior developer's job came to nothing and then Lanre's lead, and the lead's asker stands among the faces", async () => {
    const tile = archetypeOf("developer")!;
    // The first seed of a handful whose draw misses: the miss then opens Lanre's lead for customer service.
    for (let at = 0; at < 12; at += 1) {
      const game = lifeOf(tile, `z1-${String(at)}`);
      game.accept({ type: "activity/now", activity: HUNT, param: JUNIOR_DEV });
      const met = game.accept({ type: "activity/now", activity: "activity.meetup", param: null });
      const ended = game.endTurn([
        { activity: "activity.build-portfolio", param: null },
        { activity: "activity.open-source", param: null },
      ]);
      const hunts = ended.lines.filter((line) => line.key.startsWith("line.activity.hunt-"));
      if (hunts[0]?.params["job"] === JUNIOR_DEV && hunts[0].key === "line.activity.hunt-hired") continue;
      const view = game.view();
      expect(hunts.map((line) => [line.key, line.params["job"]])).toEqual([
        ["line.activity.hunt-missed", JUNIOR_DEV],
        ["line.activity.hunt-lead", "activity.job-customer-service"],
      ]);
      const missed = toldOnResults(hunts[0]!, view);
      const lead = toldOnResults(hunts[1]!, view);
      expect(words(missed.key, missed.params)).toBe("Junior developer: not this time.");
      expect(words(lead.key, lead.params)).toBe("Lanre told you about a call centre in Ikeja that is hiring: it pays, but it will not count as code.");
      const { store } = await renderWithView(<Results place="Yaba" />, view);
      act(() => store.setState({ reportOpen: true }));
      const told = [...document.querySelectorAll("[data-results-story] li")].map((row) => row.textContent ?? "");
      const said = [words(missed.key, missed.params), words(lead.key, lead.params)];
      // The results tell the named job's miss and then the lead, and the lead stands as its asker's face.
      expect(told).toContain(said[0]!);
      expect(told).toContain(said[1]!);
      expect(told.indexOf(said[0]!)).toBeLessThan(told.indexOf(said[1]!));
      const offer = view.offers.find((one) => one.entry === "offer.job-lead");
      if (offer === undefined) throw new Error("The lead is not open.");
      expect(document.querySelector(`[data-results-ask="${offer.id}"]`)?.textContent).toContain("Lanre");
      // News keeps both, the miss before the lead.
      const news = newsLines(met.lines, view.report?.lines ?? [], view).map((line) => words(line.key, line.params));
      expect(news).toEqual(expect.arrayContaining(said));
      expect(news.indexOf(said[0]!)).toBeLessThan(news.indexOf(said[1]!));
      return;
    }
    throw new Error("Every draw landed the junior developer's job in twelve seeds.");
  });
});
