// The boards in the lively dress on Chats' people page (docs/rules/city.md R-CITY-039, R-CITY-040; design page 13
// section 2): the two pickers as segmented pills, each line a card with a face sticker, the name and the figure as a
// chip, this week's rise in green, the player's own line ringed; no look travels on a board, so another player's face
// is picked from the name the line shows, and the player's own is the look they built at the door.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { PERSON_KEY } from "../../authority/person";
import "../../shared/testing/render";
import { LOOKS } from "../../shared/frontdoor/looks";
import { BASE, fakeServer } from "../../shared/testing/server";
import { say } from "../../shared/words/text";
import { BOARD_FACES, boardFace, KEPT_PERSON, keptLook } from "./BoardList";
import { boardsApiFor, BoardsApiProvider, type BoardRow } from "./boards";
import { BoardsView } from "./BoardsView";

afterEach(() => window.localStorage.clear());

function row(rank: number, username: string | null, figure: number, me = false): BoardRow {
  return { rank, username, figure, me };
}

function show(rows: BoardRow[], allTime: BoardRow[] = rows) {
  const server = fakeServer();
  server.answer("GET /api/boards/this-week/everyone", { body: { ok: true, board: "this-week.everyone", size: 50, rows, own: rows.find((one) => one.me) ?? null } });
  server.answer("GET /api/boards/all-time/everyone", { body: { ok: true, board: "all-time.everyone", size: 50, rows: allTime, own: allTime.find((one) => one.me) ?? null } });
  server.answer("GET /api/boards/joined-week", { status: 503, body: { ok: false, code: "switched-off", detail: "This board is paused.", retryAfter: 30 } });
  render(
    <BoardsApiProvider value={boardsApiFor(BASE, server.fetch)}>
      <BoardsView />
    </BoardsApiProvider>,
  );
}

const lineCards = () => Array.from(document.querySelectorAll<HTMLElement>("[data-board-lines] > li"));

describe("the boards in the lively dress", () => {
  test("[R-CITY-039] given the boards, when they show, then each picker is one segmented pill with its choice lit, and a pick moves the light", async () => {
    show([row(1, "zainab_b", 12), row(2, "ada_lagos", 5, true)], [row(1, "zainab_b", 80), row(2, "ada_lagos", 70, true)]);
    await waitFor(() => expect(lineCards()).toHaveLength(2));
    const groups = screen.getAllByRole("radiogroup");
    expect(groups).toHaveLength(2);
    for (const group of groups) {
      expect(group.className).toContain("phone-segment");
      expect(group.querySelectorAll(".phone-segment-on")).toHaveLength(1);
    }
    const when = screen.getByRole("radiogroup", { name: say("ui.boards.when") });
    fireEvent.click(within(when).getByRole("radio", { name: say("ui.boards.when.all-time") }));
    expect(within(when).getByRole("radio", { name: say("ui.boards.when.all-time") }).className).toContain("phone-segment-on");
    expect(within(when).getByRole("radio", { name: say("ui.boards.when.this-week") }).className).not.toContain("phone-segment-on");
  });

  test("[R-CITY-040] given this week's board, when it shows, then each line is a card with a face sticker and the name, a rise is a green chip, and the player's own line is ringed", async () => {
    show([row(1, "zainab_b", 12), row(2, "tunde_k", 0), row(3, "ada_lagos", 5, true)]);
    await waitFor(() => expect(lineCards()).toHaveLength(3));
    for (const card of lineCards()) {
      expect(card.className).toContain("lively-card");
      expect(card.querySelector("[data-face-sticker]")).not.toBeNull();
    }
    const [first, second, mine] = lineCards();
    expect(first?.querySelector("[data-board-figure]")?.getAttribute("data-board-figure")).toBe("rise");
    expect(first?.querySelector("[data-board-figure]")?.className).toContain("bg-tint-money");
    // No rise is no green: nothing rose, so the chip is the sheet's own.
    expect(second?.querySelector("[data-board-figure]")?.getAttribute("data-board-figure")).toBe("figure");
    expect(mine?.className).toContain("phone-picked");
    expect(first?.className).not.toContain("phone-picked");
    expect(mine?.querySelector("[data-board-you]")?.textContent).toBe(say("ui.boards.you"));
  });

  test("[R-CITY-040] given no look on a board line, when faces are shown, then another player's face follows the name shown, the same name the same face, and the player's own line wears the look kept from the door", async () => {
    expect([...BOARD_FACES].sort()).toEqual(LOOKS.map((look) => look.id).sort());
    expect(boardFace("zainab_b", false)).toBe(boardFace("zainab_b", false));
    expect(LOOKS.map((look) => look.id)).toContain(boardFace("zainab_b", false));
    expect(boardFace("ada_lagos", true, "chr_kemi")).toBe("chr_kemi");
    // A kept look the door does not offer falls back to the name's face.
    expect(boardFace("ada_lagos", true, "chr_nobody")).toBe(boardFace("ada_lagos", false));

    expect(KEPT_PERSON).toBe(PERSON_KEY);
    expect(keptLook()).toBeNull();
    window.localStorage.setItem(PERSON_KEY, JSON.stringify({ look: "chr_kemi", name: "Kemi", archetype: "developer" }));
    show([row(1, "zainab_b", 12), row(2, "ada_lagos", 5, true)]);
    await waitFor(() => expect(lineCards()).toHaveLength(2));
    expect(lineCards()[1]?.querySelector("[data-face-sticker]")?.getAttribute("data-face-sticker")).toBe("chr_kemi");
    expect(lineCards()[0]?.querySelector("[data-face-sticker]")?.getAttribute("data-face-sticker")).toBe(boardFace("zainab_b", false));
  });
});
