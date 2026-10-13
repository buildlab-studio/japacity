// The invite link on Chats' People row online (docs/rules/pair.md R-PAIR-008, R-PAIR-018): the server's route faked here
// in the shapes shared/net/contract.ts copies from the server. Moved from the old people tab (PeopleView, retired 13 Oct
// 2026 by the rest wave), each assertion kept against the slot the phone shows.
import { content } from "@japacity/content";
import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { moderationApi } from "../../shared/moderation/api";
import { ModerationProvider } from "../../shared/moderation/ModerationProvider";
import { api } from "../../shared/net/http";
import { peopleGame, renderWithGame } from "../../shared/testing/people";
import { BASE, fakeServer, type FakeServer } from "../../shared/testing/server";
import { say } from "../../shared/words/text";
import { pairApiFor } from "./pairApi";
import { PeopleSlots } from "./PeopleOnPhone";

async function online(server: FakeServer, game = peopleGame()) {
  return renderWithGame(
    <ModerationProvider api={moderationApi(api({ baseUrl: BASE, fetch: server.fetch }))}>
      <PeopleSlots api={pairApiFor(BASE, server.fetch)} />
    </ModerationProvider>,
    game,
  );
}

describe("the invite link", () => {
  test("[R-PAIR-008] given a card out online, when the player gets the link, then the server's single-use code becomes the link, with the days it lasts", async () => {
    const game = peopleGame();
    game.accept({ type: "people/invite", slot: "partner", looking: "partner", fill: "who-codes" });
    const server = fakeServer();
    server.answer("POST /api/invite", { body: { ok: true, code: "K7Q2", slot: "partner", expires: 9_000, card: {} } });
    const { store } = await online(server, game);
    act(() => store.setState({ earlyWin: false }));
    // R-GUIDE-015: the link is an ask, so it waits for the early win.
    expect(screen.queryByRole("button", { name: say("ui.people.invite.link-get") })).toBeNull();
    act(() => store.setState({ earlyWin: true }));
    expect(screen.queryByText(say("ui.people.invite.offline"))).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: say("ui.people.invite.link-get") }));
    await screen.findByText(/\/invite\/K7Q2$/);
    expect(server.sent.find((sent) => sent.path === "/api/invite")?.body).toEqual({ slot: "partner" });
    expect(screen.getByText(say("ui.people.invite.link-days", { days: content.tuning.pair.inviteDays }))).toBeDefined();
  });

  test.each([
    ["too-many", 429],
    ["region", 403],
  ])("[R-PAIR-008] [R-PAIR-018] given the server refusing the link as %s with %i, then the client reads the refusal from the body and says it in words", async (code, status) => {
    const game = peopleGame();
    game.accept({ type: "people/invite", slot: "partner", looking: "partner", fill: "who-codes" });
    const server = fakeServer();
    server.answer("POST /api/invite", { status, body: { ok: false, code, detail: "Refused." } });
    const { store } = await online(server, game);
    act(() => store.setState({ earlyWin: true }));
    fireEvent.click(screen.getByRole("button", { name: say("ui.people.invite.link-get") }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(say("ui.people.invite.failed", { why: say(`reject.${code}`) }));
    expect(alert.textContent).not.toContain("Refused.");
  });
});
