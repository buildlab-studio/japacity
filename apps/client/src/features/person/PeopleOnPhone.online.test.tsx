// The invite link on Chats' People row online (pair:invite-link-single-use, pair:everyone-meets-by-invite): the server's route faked here
// in the shapes of @japacity/api, each assertion against the slot the phone shows.
import { content } from "@japacity/content";
import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { moderationApi } from "../../shared/moderation/api";
import { ModerationProvider } from "../../shared/moderation/ModerationProvider";
import { api } from "../../shared/net/http";
import { peopleGame, renderWithGame } from "../../shared/testing/person";
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

/** Stands in for the device's share sheet and clipboard; `share` left out, the device has no share sheet. */
function device({ share }: { share?: (data: ShareData) => Promise<void> }) {
  const shared: ShareData[] = [];
  const copied: string[] = [];
  Object.defineProperty(navigator, "share", { configurable: true, value: share === undefined ? undefined : (data: ShareData) => (shared.push(data), share(data)) });
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: (text: string) => (copied.push(text), Promise.resolve()) } });
  return { shared, copied };
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "clipboard");
});

/** A card out online, the early win in, and Get the link pressed: the link shows. */
async function linkGot() {
  const game = peopleGame();
  game.accept({ type: "people/invite", slot: "partner", looking: "partner", fill: "who-codes" });
  const server = fakeServer();
  server.answer("POST /api/invite", { body: { ok: true, code: "K7Q2", slot: "partner", expires: 9_000, card: {} } });
  const { store } = await online(server, game);
  act(() => store.setState({ earlyWin: true }));
  fireEvent.click(screen.getByRole("button", { name: say("ui.people.invite.link-get") }));
  const shown = await screen.findByText(/\/invite\/K7Q2$/);
  return /https?:\/\/\S+\/invite\/K7Q2/.exec(shown.textContent ?? "")?.[0] ?? "";
}

describe("sending the link on (pair:invite-link-single-use)", () => {
  test("[pair:invite-link-single-use] given a device with a share sheet, when the link is got, then Share hands the link to the share sheet, and no Copy stands beside it", async () => {
    const { shared } = device({ share: () => Promise.resolve() });
    const link = await linkGot();
    expect(screen.queryByRole("button", { name: say("ui.people.invite.copy") })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: say("ui.people.invite.share") }));
    await act(() => Promise.resolve());
    expect(shared).toHaveLength(1);
    expect(shared[0]?.url).toBe(link);
  });

  test("[pair:invite-link-single-use] given a device with no share sheet, when the link is got, then Copy puts the link on the clipboard and says it is copied", async () => {
    const { copied } = device({});
    const link = await linkGot();
    expect(screen.queryByRole("button", { name: say("ui.people.invite.share") })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: say("ui.people.invite.copy") }));
    expect(await screen.findByText(say("ui.people.invite.copied"))).toBeDefined();
    expect(copied).toEqual([link]);
  });

  test("[pair:invite-link-single-use] given a share sheet the player closes, then nothing is said; one that fails offers Copy instead", async () => {
    let fails = false;
    device({ share: () => Promise.reject(fails ? new Error("not allowed") : new DOMException("closed", "AbortError")) });
    await linkGot();
    fireEvent.click(screen.getByRole("button", { name: say("ui.people.invite.share") }));
    await act(() => Promise.resolve());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: say("ui.people.invite.copy") })).toBeNull();
    fails = true;
    fireEvent.click(screen.getByRole("button", { name: say("ui.people.invite.share") }));
    expect(await screen.findByRole("button", { name: say("ui.people.invite.copy") })).toBeDefined();
  });
});

describe("the invite link", () => {
  test("[pair:invite-link-single-use] given a card out online, when the player gets the link, then the server's single-use code becomes the link, with the days it lasts", async () => {
    const game = peopleGame();
    game.accept({ type: "people/invite", slot: "partner", looking: "partner", fill: "who-codes" });
    const server = fakeServer();
    server.answer("POST /api/invite", { body: { ok: true, code: "K7Q2", slot: "partner", expires: 9_000, card: {} } });
    const { store } = await online(server, game);
    act(() => store.setState({ earlyWin: false }));
    // guide:nothing-asked-before-early-win: the link is an ask, so it waits for the early win.
    expect(screen.queryByRole("button", { name: say("ui.people.invite.link-get") })).toBeNull();
    act(() => store.setState({ earlyWin: true }));
    expect(screen.queryByText(say("ui.people.invite.offline"))).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: say("ui.people.invite.link-get") }));
    await screen.findByText(/\/invite\/K7Q2$/);
    expect(server.sent.find((sent) => sent.path === "/api/invite")?.body).toEqual({ slot: "partner" });
    expect(screen.getByText(say("ui.people.invite.link-days", { days: content.tuning.pair.inviteDays }))).toBeDefined();
  });

  test.each([["too-many", 429]])("[pair:invite-link-single-use] given the server refusing the link as %s with %i, then the client reads the refusal from the body and says it in words", async (code, status) => {
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
