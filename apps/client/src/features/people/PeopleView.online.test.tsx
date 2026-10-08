// The people tab online: the routes the server's people side answers, faked
// here as the contract in shared/net/contract.ts assumes them.
import { content } from "@japacity/content";
import type { ConversationRow } from "@japacity/sim";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { phraseWords } from "../../shared/sim/people";
import { linkedFriend, PAIR, peopleGame, renderWithGame } from "../../shared/testing/people";
import { BASE, fakeServer, type FakeServer } from "../../shared/testing/server";
import { say, sayCount } from "../../shared/words/text";
import { pairApiFor, PairApiProvider } from "./pairApi";
import { PeopleView } from "./PeopleView";

const ME = "character-me";
const THEM = "character-them";

function row(id: string, sender: string, phrase: ConversationRow["phrase"], fill: string | null, readAt: number | null): ConversationRow {
  return { id, conversation: PAIR, sender, phrase, fill, sentAt: 1_000, readAt };
}

async function online(server: FakeServer, game = peopleGame()) {
  const rendered = await renderWithGame(
    <PairApiProvider value={pairApiFor(BASE, server.fetch)}>
      <PeopleView />
    </PairApiProvider>,
    game,
  );
  return rendered;
}

/** A friend linked in the partner slot, with the server naming the pair and a short thread. */
function friendServer(rows: ConversationRow[] = []): { server: FakeServer; game: ReturnType<typeof peopleGame>; bond: string } {
  const game = peopleGame();
  const bond = linkedFriend(game);
  const server = fakeServer();
  server.answer("GET /api/pairs", { body: { ok: true, pairs: [{ bond, pair: PAIR }] } });
  server.answer(`GET /api/pair/${PAIR}/conversation`, { body: { ok: true, me: ME, rows } });
  return { server, game, bond };
}

function card(bond: string): HTMLElement {
  return document.querySelector<HTMLElement>(`[data-bond="${bond}"]`)!;
}

describe("the invite link", () => {
  test("[R-PAIR-008] given a card out online, when the player gets the link, then the server's single-use code becomes the link, with the days it lasts", async () => {
    const game = peopleGame();
    game.accept({ type: "people/invite", slot: "partner", looking: "partner", fill: "who-codes" });
    const server = fakeServer();
    server.answer("POST /api/invite", { body: { ok: true, code: "K7Q2", expires: 9_000 } });
    await online(server, game);
    expect(screen.queryByText(say("ui.people.invite.offline"))).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: say("ui.people.invite.link-get") }));
    await screen.findByText(/\/invite\/K7Q2$/);
    expect(server.sent.find((sent) => sent.path === "/api/invite")?.body).toEqual({ slot: "partner" });
    expect(screen.getByText(say("ui.people.invite.link-days", { days: content.tuning.pair.inviteDays }))).toBeDefined();
  });
});

describe("the conversation", () => {
  test("[R-PAIR-011] given a thread from the server, then each phrase reads in words, the player's own rows carry the read mark once read, and the other's unread rows are marked new", async () => {
    const { server, game, bond } = friendServer([row("m1", THEM, "phrase.meet-at", "suya-spot", null), row("m2", ME, "phrase.yes", null, 2_000), row("m3", ME, "phrase.thanks", null, null)]);
    await online(server, game);
    const thread = await within(card(bond)).findByRole("region", { name: say("ui.talk.title") });
    await within(thread).findByText(phraseWords("phrase.meet-at", "suya-spot"));
    expect(phraseWords("phrase.meet-at", "suya-spot")).toBe("Let us meet at the suya spot.");
    const own = thread.querySelector<HTMLElement>('[data-row="m2"]')!;
    expect(within(own).getByText(say("ui.talk.read"))).toBeDefined();
    expect(within(thread.querySelector<HTMLElement>('[data-row="m3"]')!).queryByText(say("ui.talk.read"))).toBeNull();
    expect(within(thread.querySelector<HTMLElement>('[data-row="m1"]')!).getByText(say("ui.talk.unread"))).toBeDefined();
  });

  test("[R-PAIR-010] given a phrase with a fill-in, when it is said, then only a fill from its fixed list can go, and the row joins the thread", async () => {
    const { server, game, bond } = friendServer();
    server.answer(`POST /api/pair/${PAIR}/say`, { body: { ok: true, row: row("m9", ME, "phrase.see-you", "beach", null) } });
    await online(server, game);
    const thread = await within(card(bond)).findByRole("region", { name: say("ui.talk.title") });
    fireEvent.change(within(thread).getByLabelText(say("ui.talk.phrase")), { target: { value: "phrase.see-you" } });
    const fill = within(thread).getByLabelText<HTMLSelectElement>(say("ui.talk.fill"));
    expect([...fill.options].map((option) => option.value)).toEqual(content.people.spots);
    fireEvent.change(fill, { target: { value: "beach" } });
    fireEvent.click(within(thread).getByRole("button", { name: `${say("ui.talk.send")}: ${phraseWords("phrase.see-you", "beach")}` }));
    await within(thread).findByText(phraseWords("phrase.see-you", "beach"));
    expect(server.sent.find((sent) => sent.path.endsWith("/say"))?.body).toEqual({ phrase: "phrase.see-you", fill: "beach" });
  });

  test("[R-PAIR-013] given the hour's phrases used up, when one more is said, then the refusal says so plainly and stores nothing", async () => {
    const { server, game, bond } = friendServer();
    server.answer(`POST /api/pair/${PAIR}/say`, { body: { ok: false, code: "not-legal", detail: "too many", failed: "too-many" } });
    await online(server, game);
    const thread = await within(card(bond)).findByRole("region", { name: say("ui.talk.title") });
    fireEvent.click(within(thread).getByRole("button", { name: new RegExp(`^${say("ui.talk.send")}`) }));
    await within(thread).findByText(say("ui.talk.failed.too-many"));
    expect(within(thread).getByText(say("ui.talk.empty"))).toBeDefined();
  });

  test("[R-PAIR-013] given the server's rate limit, then the wait is said in seconds; and a block on the other side is only ever not possible", async () => {
    const { server, game, bond } = friendServer();
    server.answer(`POST /api/pair/${PAIR}/say`, { status: 429, body: { ok: false, code: "rate-limited", detail: "slow", retryAfter: 4 } }, { body: { ok: false, code: "not-legal", detail: "x", failed: "not-possible" } });
    await online(server, game);
    const thread = await within(card(bond)).findByRole("region", { name: say("ui.talk.title") });
    const sendButton = () => within(thread).getByRole("button", { name: new RegExp(`^${say("ui.talk.send")}`) });
    fireEvent.click(sendButton());
    await within(thread).findByText(sayCount("ui.online.wait", 4, { seconds: 4 }));
    fireEvent.click(sendButton());
    await within(thread).findByText(say("ui.talk.failed.not-possible"));
  });
});

describe("block and report", () => {
  test("[R-PAIR-014] given a friend's bond online, then block and report sit one tap from where they appear; offline neither shows", async () => {
    const { server, game, bond } = friendServer();
    await online(server, game);
    await within(card(bond)).findByRole("region", { name: say("ui.talk.title") });
    expect(within(card(bond)).getByRole("button", { name: say("ui.pair.block") })).toBeDefined();
    expect(within(card(bond)).getByRole("button", { name: say("ui.pair.report") })).toBeDefined();
    document.body.innerHTML = "";
    await renderWithGame(
      <PairApiProvider value={null}>
        <PeopleView />
      </PairApiProvider>,
      game,
    );
    expect(card(bond).querySelector("[data-safety]")).toBeNull();
    expect(screen.queryByRole("button", { name: say("ui.pair.block") })).toBeNull();
  });

  test("[R-PAIR-015] given a block confirmed, then it goes to the server for the pair and the player is told it is over", async () => {
    const { server, game, bond } = friendServer();
    server.answer("POST /api/moderation/block", { body: { ok: true } });
    await online(server, game);
    await within(card(bond)).findByRole("region", { name: say("ui.talk.title") });
    fireEvent.click(within(card(bond)).getByRole("button", { name: say("ui.pair.block") }));
    const confirm = within(card(bond)).getByRole("group", { name: say("ui.pair.block.title") });
    fireEvent.click(within(confirm).getByRole("button", { name: say("ui.pair.block.confirm") }));
    await within(card(bond)).findByText(say("ui.pair.blocked"));
    expect(server.sent.find((sent) => sent.path === "/api/moderation/block")?.body).toEqual({ pair: PAIR });
  });

  test("[R-PAIR-016] given a report from the conversation, then it cites the pair and the other side's messages, with a block ticked by default", async () => {
    const { server, game, bond } = friendServer([row("m1", THEM, "phrase.hello", null, null), row("m2", ME, "phrase.yes", null, null)]);
    server.answer("POST /api/moderation/report", { body: { ok: true } });
    await online(server, game);
    const thread = await within(card(bond)).findByRole("region", { name: say("ui.talk.title") });
    await within(thread).findByText(phraseWords("phrase.hello", null));
    fireEvent.click(within(thread).getByRole("button", { name: say("ui.pair.report") }));
    const form = within(thread).getByRole("form", { name: say("ui.pair.report.title") });
    expect(within(form).getByLabelText<HTMLInputElement>(say("ui.pair.report.also-block")).checked).toBe(true);
    fireEvent.change(within(form).getByLabelText(say("ui.pair.report.reason")), { target: { value: "scam" } });
    fireEvent.click(within(form).getByRole("button", { name: say("ui.pair.report.send") }));
    await within(thread).findByText(say("ui.pair.reported"));
    await waitFor(() => expect(server.sent.find((sent) => sent.path === "/api/moderation/report")?.body).toEqual({ pair: PAIR, reason: "scam", messages: ["m1"], block: true }));
  });
});
