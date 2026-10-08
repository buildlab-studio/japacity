// A switched-off board's screen is never fetched (docs/rules/city.md
// R-CITY-039): with every board answering switched-off, the lazy chunks of
// the board lines and the joined-week board are never imported.
import { render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import "../../shared/testing/render";
import { BASE, fakeServer } from "../../shared/testing/server";
import { say } from "../../shared/words/text";
import { boardsApiFor, BoardsApiProvider } from "./boards";
import { BoardsView } from "./BoardsView";

const imported = vi.hoisted(() => ({ lines: 0, joined: 0 }));

vi.mock("./BoardList", async (original) => {
  imported.lines += 1;
  return original();
});
vi.mock("./JoinedWeekBoard", async (original) => {
  imported.joined += 1;
  return original();
});

test("[R-CITY-039] given every board switched off, when the screen opens, then each says it is paused and no board's screen is loaded", async () => {
  const server = fakeServer();
  const paused = { status: 503, headers: { "Retry-After": "30" }, body: { ok: false, code: "switched-off", detail: "This board is paused.", retryAfter: 30 } };
  for (const path of ["this-week/everyone", "this-week/friends", "all-time/everyone", "all-time/friends", "joined-week"]) server.answer(`GET /api/boards/${path}`, paused);
  render(
    <BoardsApiProvider value={boardsApiFor(BASE, server.fetch)}>
      <BoardsView />
    </BoardsApiProvider>,
  );
  await waitFor(() => expect(screen.getByText(say("ui.boards.paused"))).toBeTruthy());
  await waitFor(() => expect(server.sent.map((sent) => sent.path).sort()).toEqual(["/api/boards/joined-week", "/api/boards/this-week/everyone"]));
  expect(imported).toEqual({ lines: 0, joined: 0 });
});

test("[R-CITY-039] given a board switched on again, when the screen opens, then its lines are loaded then and only then", async () => {
  expect(imported.lines).toBe(0);
  const server = fakeServer();
  server.answer("GET /api/boards/this-week/everyone", { body: { ok: true, board: "this-week.everyone", size: 50, rows: [{ rank: 1, firstName: "Ada", figure: 4, me: true, name: null }], own: { rank: 1, firstName: "Ada", figure: 4, me: true, name: null } } });
  server.answer("GET /api/boards/joined-week", { status: 503, body: { ok: false, code: "switched-off", detail: "This board is paused.", retryAfter: 30 } });
  render(
    <BoardsApiProvider value={boardsApiFor(BASE, server.fetch)}>
      <BoardsView />
    </BoardsApiProvider>,
  );
  await waitFor(() => expect(document.querySelector("[data-board]")).not.toBeNull());
  expect(imported).toEqual({ lines: 1, joined: 0 });
});
