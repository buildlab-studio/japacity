// The boards screen against a faked server, in the shapes boards.ts copies
// from apps/server/src/boards/board.ts.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import "../../shared/testing/render";
import { BASE, fakeServer, type Answer, type FakeServer } from "../../shared/testing/server";
import { say } from "../../shared/words/text";
import { boardsApiFor, BoardsApiProvider, type BoardName, type BoardReply, type BoardRow } from "./boards";
import { BoardsView } from "./BoardsView";

const PAUSED = { status: 503, headers: { "Retry-After": "30" }, body: { ok: false, code: "switched-off", detail: "This board is paused.", retryAfter: 30 } };

function line(rank: number, figure: number, over: Partial<BoardRow> = {}): BoardRow {
  return { rank, firstName: "Tunde", figure, me: false, name: null, ...over };
}

function board(name: BoardName, rows: BoardRow[], own: BoardRow | null = rows.find((row) => row.me) ?? null): { body: BoardReply } {
  return { body: { ok: true, board: name, size: 50, rows, own } };
}

/** Every board answers, the joined-week board as launched: switched off. `over` replaces a route's answers. */
function launched(over: Record<string, Answer[]> = {}): FakeServer {
  const server = fakeServer();
  const answers: Record<string, Answer[]> = {
    "GET /api/boards/this-week/everyone": [board("this-week.everyone", [line(1, 12, { firstName: "Zainab" }), line(2, 5, { firstName: "Ada", me: true })])],
    "GET /api/boards/this-week/friends": [board("this-week.friends", [line(1, 5, { firstName: "Ada", me: true, name: "ada_lagos" })])],
    "GET /api/boards/all-time/everyone": [board("all-time.everyone", [line(1, 80), line(2, 70)], line(51, 10, { firstName: "Ada", me: true }))],
    "GET /api/boards/all-time/friends": [board("all-time.friends", [line(1, 40, { name: "tunde.k" }), line(2, 30, { firstName: "Ada", me: true, name: "ada_lagos" })])],
    "GET /api/boards/joined-week": [PAUSED],
    ...over,
  };
  for (const [route, queued] of Object.entries(answers)) server.answer(route, ...queued);
  return server;
}

function show(server: FakeServer) {
  return render(
    <BoardsApiProvider value={boardsApiFor(BASE, server.fetch)}>
      <BoardsView />
    </BoardsApiProvider>,
  );
}

const lines = () => Array.from(document.querySelectorAll("[data-board] > ol > li")).map((item) => item.textContent);

function pick(group: string, option: string): void {
  fireEvent.click(within(screen.getByRole("radiogroup", { name: say(group) })).getByRole("radio", { name: say(option) }));
}

describe("the boards screen", () => {
  test("[R-CITY-039] given the boards as launched, when the screen opens, then this week for everyone shows, and each picker asks the server for its own board", async () => {
    const server = launched();
    show(server);
    await waitFor(() => expect(lines()).toEqual(["1Zainab+12", "2AdaYou+5"]));
    expect(screen.getByRole("radio", { name: say("ui.boards.when.this-week") }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: say("ui.boards.who.everyone") }).getAttribute("aria-checked")).toBe("true");

    pick("ui.boards.when", "ui.boards.when.all-time");
    await waitFor(() => expect(document.querySelector("[data-board]")?.getAttribute("data-board")).toBe("all-time.everyone"));
    pick("ui.boards.who", "ui.boards.who.friends");
    await waitFor(() => expect(lines()).toEqual(["1tunde.kTunde40%", "2ada_lagosAdaYou30%"]));
    pick("ui.boards.when", "ui.boards.when.this-week");
    await waitFor(() => expect(document.querySelector("[data-board]")?.getAttribute("data-board")).toBe("this-week.friends"));

    expect(server.sent.map((sent) => sent.path).filter((path) => path !== "/api/boards/joined-week")).toEqual(["/api/boards/this-week/everyone", "/api/boards/all-time/everyone", "/api/boards/all-time/friends", "/api/boards/this-week/friends"]);
  });

  test("[R-CITY-040] given the player ranked below the top lines, when all time is shown, then the player's own line shows under them with its rank", async () => {
    show(launched());
    pick("ui.boards.when", "ui.boards.when.all-time");
    const own = await waitFor(() => {
      const found = document.querySelector("[data-board-own]");
      if (found === null) throw new Error("no own line yet");
      return found;
    });
    expect(own.textContent).toContain(say("ui.boards.your-place"));
    expect(own.querySelector("[data-me]")?.textContent).toBe("51AdaYou10%");
  });

  test("[R-CITY-040] given a player with no route yet, when a board is shown, then the own line says so instead of a rank", async () => {
    show(launched({ "GET /api/boards/this-week/everyone": [board("this-week.everyone", [line(1, 12)], null)] }));
    await waitFor(() => expect(screen.getByText(say("ui.boards.no-route"))).toBeTruthy());
  });

  test("[R-CITY-039] given a board switched off, when it is picked, then a quiet note says it is paused and the other boards still show", async () => {
    show(launched({ "GET /api/boards/all-time/everyone": [PAUSED] }));
    await waitFor(() => expect(lines()).toHaveLength(2));
    pick("ui.boards.when", "ui.boards.when.all-time");
    await waitFor(() => expect(screen.getByText(say("ui.boards.paused"))).toBeTruthy());
    expect(document.querySelector("[data-board]")).toBeNull();
    pick("ui.boards.who", "ui.boards.who.friends");
    await waitFor(() => expect(lines()).toHaveLength(2));
  });

  test("[R-ACCOUNT-022] given a guest, when a board is asked for, then the screen asks the player to secure the life", async () => {
    show(launched({ "GET /api/boards/this-week/everyone": [{ status: 403, body: { ok: false, code: "not-legal", detail: "Secure your account to be on the boards." } }] }));
    await waitFor(() => expect(screen.getByText(say("ui.boards.secure"))).toBeTruthy());
  });

  test("[R-CITY-039] given the joined-week board switched off, when the screen opens, then nothing of it shows; switched on, then it shows under the pickers", async () => {
    show(launched());
    await waitFor(() => expect(lines()).toHaveLength(2));
    expect(document.querySelector("[data-joined-week]")).toBeNull();

    cleanup();
    show(launched({ "GET /api/boards/joined-week": [board("joined-week", [line(1, 30, { firstName: "Ada", me: true }), line(2, 20)])] }));
    await waitFor(() => expect(document.querySelector("[data-joined-week]")).not.toBeNull());
    expect(screen.getByText(say("ui.boards.joined-week"))).toBeTruthy();
  });

  test("[R-CITY-039] given a board that fails to load, when the player tries again, then it is asked for again", async () => {
    show(launched({ "GET /api/boards/this-week/everyone": [{ status: 500, body: { ok: false, code: "diverged", detail: "broken" } }, board("this-week.everyone", [line(1, 3)])] }));
    fireEvent.click(await screen.findByRole("button", { name: say("ui.boards.retry") }));
    await waitFor(() => expect(lines()).toEqual(["1Tunde+3"]));
  });
});
