// The player's words never count the engine (text:bands-not-figures,
// text:voice-by-surface): no slots, a turn of the engine, banked months, months as pages, days left, a day count or a
// percentage; "chapter" never said to the player; no em or en dash. The phone's apps are scanned by their own
// tests; this walks every words table a player reads, then renders the world's sheets, the results and the map.
import { content, text } from "@japacity/content";
import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { Map } from "../features/map/Map";
import { mapPins } from "../features/map/pins";
import { OfferView } from "../features/offer/OfferView";
import { Results } from "../features/turn/Results";
import { engineView, recordedGame } from "../shared/testing/fixtures";
import { renderWithView } from "../shared/testing/render";
import { nameOf } from "../shared/words/text";
import "../features/map/paper/PaperMap";

/** What a player must never read: the engine's counting, never the life's. Braces are a line's params, never read. */
const NEVER = /\b(slots?|banked|days left|chapters?|next turn|end (the )?turn|turns? left|next page|pages? left)\b|\b\d+ days? (left|to go)\b|%|[\u2013\u2014]/i;

/** Every table of words a player can read, by name. */
const TABLES: Record<string, Record<string, string>> = { content: text };

function said(line: string): string | null {
  return NEVER.exec(line.replace(/\{[^}]*\}/g, ""))?.[0] ?? null;
}

describe("the player's words never count the engine", () => {
  test("[text:bands-not-figures] [text:voice-by-surface] given every words table a player reads, when each line is read without its params, then none says slots, a turn, banked, pages, days left, a day count, a percentage or chapter, and none has a dash", () => {
    const found = Object.entries(TABLES).flatMap(([table, lines]) =>
      Object.entries(lines).flatMap(([key, line]) => {
        const hit = typeof line === "string" ? said(line) : null;
        return hit === null ? [] : [`${table}: ${key}: ${hit}`];
      }),
    );
    expect(found).toEqual([]);
  });

  test("[text:bands-not-figures] given these lines, when they are said, then each says the life's words: the brief, not the chapter; months, not pages or turns; a figure in words", () => {
    expect(text["line.chapter.closed"]).toBe("Done: {chapter}.");
    expect(text["moment.chapter.kicker"]).toBe("Brief done");
    expect(text["share.chapter.kicker"]).toBe("Brief done");
    expect(text["ui.secure.ask.first-chapter"]).toMatch(/^You finished your first brief\./);
    expect(text["ui.nudge.chapter-done"]).toBe("That brief is done. Live the month.");
    expect(text["share.official.never.turns"]).toBe("We never sell months to play.");
    expect(text["line.people.linked"]).toBe("A friend took your card, and they are your {slot} now.");
    expect(text["offer.gulf-agent.sign.pay-today"]).toBe("He says someone else takes it if you do not pay today.");
  });

  test("[text:bands-not-figures] [world:month-end-results-sheet] given a lived month's results opened whole, when they are read, then nothing counts the engine", async () => {
    const view = recordedGame("banker-borrower").view();
    expect(view.report).not.toBeNull();
    await renderWithView(<Results place="Ojuelegba" />, view);
    const whole = screen.queryByRole("button", { name: /See the whole month/ });
    if (whole !== null) fireEvent.click(whole);
    expect(said(document.body.textContent ?? "")).toBeNull();
  });

  test("[text:bands-not-figures] [world:one-action-one-sheet] given the asks of a life in the middle of its months, when the sheet is read, then nothing counts the engine and no line says a percentage", async () => {
    // The recorded graduate with the deposit paid holds two lenders' cards open, each with its figures (route:education-loan-pays-the-school).
    const game = recordedGame("graduate-careful", 211);
    const view = game.view();
    expect(view.offers.map((offer) => offer.entry)).toEqual(expect.arrayContaining(["offer.education-loan", "offer.held-funds"]));
    await renderWithView(<OfferView />, view);
    expect(said(document.body.textContent ?? "")).toBeNull();
  });

  test("[text:bands-not-figures] [world:map-is-painted-lagos] given the painted map open on a neighbourhood and unfolded, when it is read, then nothing counts the engine", async () => {
    const places = Object.values(content.place).filter((place) => place.where === "home");
    const pins = mapPins({ places, here: "place.ojuelegba", home: "place.family-house", homeSpot: { latE3: 6507, lonE3: 3359 }, been: [], built: new Set(places.map((place) => place.id)), name: nameOf });
    const lagos = { id: "lagos", name: "Lagos", locked: null };
    await renderWithView(<Map pins={pins} country={lagos} countries={[lagos]} drawing={false} onGo={() => undefined} onClose={() => undefined} home="place.family-house" step={null} pickFirst={null} />, engineView());
    for (let tries = 0; tries < 200 && document.querySelector("[data-paper-map]") === null; tries += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
    expect(document.querySelector("[data-paper-map]")).not.toBeNull();
    expect(said(document.body.textContent ?? "")).toBeNull();
  });
});
