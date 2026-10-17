// The player's words never count the engine (text.md R-TEXT-005,
// R-TEXT-007): no slots, a turn of the engine, banked months, months as pages, days left, a day count or a
// percentage; "chapter" never said to the player; no em or en dash. The phone's apps are scanned by their own
// tests; this walks every words table a player reads, then renders the world's sheets, the results and the map.
import { content, text } from "@japacity/content";
import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { cityText } from "../../features/city/city.words";
import { sceneText } from "../../features/city/scene.words";
import { Map } from "../../features/map/Map";
import { mapText } from "../../features/map/map.words";
import { mapPins } from "../../features/map/pins";
import { OfferView } from "../../features/offer/OfferView";
import { passbookText } from "../../features/phone/apps/passbook.words";
import { phoneText } from "../../features/phone/phone.words";
import { roomText } from "../../features/setpiece/room.words";
import { Results } from "../../features/turn/Results";
import { turnText } from "../../features/turn/turn.words";
import { engineView, recordedGame } from "../testing/fixtures";
import { renderWithView } from "../testing/render";
import { nameOf } from "./text";
import { uiText } from "./ui";
import "../../features/map/paper/PaperMap";

/** What a player must never read: the engine's counting, never the life's. Braces are a line's params, never read. */
const NEVER = /\b(slots?|banked|days left|chapters?|next turn|end (the )?turn|turns? left|next page|pages? left)\b|\b\d+ days? (left|to go)\b|%|[\u2013\u2014]/i;

/** Every table of words a player can read, by name. */
const TABLES: Record<string, Record<string, string>> = { content: text, ui: uiText, city: cityText, scene: sceneText, map: mapText, turn: turnText, phone: phoneText, passbook: passbookText, room: roomText };

function said(line: string): string | null {
  return NEVER.exec(line.replace(/\{[^}]*\}/g, ""))?.[0] ?? null;
}

describe("the player's words never count the engine", () => {
  test("[R-TEXT-005] [R-TEXT-007] given every words table a player reads, when each line is read without its params, then none says slots, a turn, banked, pages, days left, a day count, a percentage or chapter, and none has a dash", () => {
    const found = Object.entries(TABLES).flatMap(([table, lines]) =>
      Object.entries(lines).flatMap(([key, line]) => {
        const hit = typeof line === "string" ? said(line) : null;
        return hit === null ? [] : [`${table}: ${key}: ${hit}`];
      }),
    );
    expect(found).toEqual([]);
  });

  test("[R-TEXT-005] given the reworded lines, when they are said, then each says the life's words: the brief, not the chapter; months, not pages or turns; a figure in words", () => {
    expect(text["line.chapter.closed"]).toBe("Done: {chapter}.");
    expect(text["moment.chapter.kicker"]).toBe("Brief done");
    expect(text["share.chapter.kicker"]).toBe("Brief done");
    expect(uiText["ui.secure.ask.first-chapter"]).toMatch(/^You finished your first brief\./);
    expect(uiText["ui.nudge.chapter-done"]).toBe("That brief is done. Live the month.");
    expect(text["share.official.never.turns"]).toBe("We never sell months to play.");
    expect(text["line.people.linked"]).toBe("A friend took your card, and they are your {slot} now.");
    expect(text["offer.gulf-agent.sign.pay-today"]).toBe("He says someone else takes it if you do not pay today.");
  });

  test("[R-TEXT-005] [R-WORLD-008] given a lived month's results opened whole, when they are read, then nothing counts the engine", async () => {
    const view = recordedGame("tunde-borrower").view();
    expect(view.report).not.toBeNull();
    await renderWithView(<Results place="Ojuelegba" />, view);
    const whole = screen.queryByRole("button", { name: /See the whole month/ });
    if (whole !== null) fireEvent.click(whole);
    expect(said(document.body.textContent ?? "")).toBeNull();
  });

  test("[R-TEXT-005] [R-WORLD-006] given the asks of a life in the middle of its months, when the sheet is read, then nothing counts the engine and no line says a percentage", async () => {
    const game = recordedGame("ada-careful", 290 - 93);
    const view = game.view();
    expect(view.offers.map((offer) => offer.entry)).toContain("offer.salary-loan");
    await renderWithView(<OfferView />, view);
    expect(said(document.body.textContent ?? "")).toBeNull();
  });

  test("[R-TEXT-005] [R-WORLD-015] given the painted map open on a neighbourhood and unfolded, when it is read, then nothing counts the engine", async () => {
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
