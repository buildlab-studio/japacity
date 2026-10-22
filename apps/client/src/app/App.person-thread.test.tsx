// A bond's Chats thread (docs/rules/person.md, pair.md; world:nobody-picked-from-list): the computer partner's thread with its
// moments under the head, the quiet marks over it, and a friend's conversation online, its rows read and new, its
// phrases from chips, its refusals said plainly, block and report on the record and on the conversation. Chats as the
// shell hands it the people feature's screens, each assertion against the element the phone shows. Here beside the
// shell, since it joins two features.
import { content } from "@japacity/content";
import type { ConversationRow } from "@japacity/sim";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { moderationApi } from "../shared/moderation/api";
import { reasonWords, words } from "../shared/moderation/moderation.words";
import { ModerationProvider } from "../shared/moderation/ModerationProvider";
import { api } from "../shared/net/http";
import { bondName, momentWords, phraseWords } from "../shared/view/person";
import { courted, linkedFriend, PAIR, peopleGame, renderWithGame, DELE } from "../shared/testing/person";
import { BASE, fakeServer, type FakeServer } from "../shared/testing/server";
import { nameOf, say, sayCount } from "../shared/words/text";
import { Chats, PhonePeople, PhoneTalk } from "../features/phone/apps/Chats";
import { pairApiFor, type PairApi } from "../features/person/pairApi";
import { BondHead, PeopleSlots } from "../features/person/PeopleOnPhone";

const people = content.tuning.people;
const ME = "character-me";
const THEM = "character-them";

function chats(pairs: PairApi | null) {
  return (
    <PhoneTalk value={pairs}>
      <PhonePeople value={{ head: (bond) => <BondHead bond={bond} api={pairs} />, slots: <PeopleSlots api={pairs} /> }}>
        <Chats />
      </PhonePeople>
    </PhoneTalk>
  );
}

function head(bond: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[data-bond-head="${bond}"]`);
  if (found === null) throw new Error(`No head for ${bond}.`);
  return found;
}

function row(id: string, sender: string, phrase: ConversationRow["phrase"], fill: string | null, readAt: number | null): ConversationRow {
  return { id, conversation: PAIR, sender, phrase, fill, sentAt: 1_000, readAt };
}

/** A friend linked in the partner slot, the record naming the other side, and a short thread. */
function friendServer(rows: ConversationRow[] = []): { server: FakeServer; game: ReturnType<typeof peopleGame>; bond: string } {
  const game = peopleGame();
  const bond = linkedFriend(game);
  const server = fakeServer();
  server.answer(`GET /api/pair/${PAIR}`, { body: { ok: true, pair: { id: PAIR, side: "a", them: THEM } } });
  server.answer(`GET /api/pair/${PAIR}/conversation`, { body: { ok: true, pair: PAIR, messages: rows } });
  return { server, game, bond };
}

/** Chats online with the friend's thread opened: the conversation's region once it shows. */
async function online(server: FakeServer, game: ReturnType<typeof peopleGame>, bond: string) {
  const rendered = await renderWithGame(<ModerationProvider api={moderationApi(api({ baseUrl: BASE, fetch: server.fetch }))}>{chats(pairApiFor(BASE, server.fetch))}</ModerationProvider>, game);
  fireEvent.click(document.querySelector<HTMLElement>(`[data-chat-row="${bond}"]`)!);
  const thread = await screen.findByRole("region", { name: say("ui.talk.title") });
  return { ...rendered, thread };
}

/** Picks a phrase from the chips and says it. */
function sayPhrase(thread: HTMLElement, phrase: string): void {
  fireEvent.click(thread.querySelector<HTMLElement>(`[data-phrase="${phrase}"]`)!);
  fireEvent.click(thread.querySelector<HTMLElement>("[data-say]")!);
}

describe("a computer partner's thread", () => {
  test("[person:view-shows-people] given a computer courted and met, then the thread names them, its head gives the stage and the facts, the moments show in words, and never a sum of their money", async () => {
    const game = peopleGame();
    const bond = courted(game, DELE, 2);
    const { store } = await renderWithGame(chats(null), game);
    fireEvent.click(document.querySelector<HTMLElement>(`[data-chat-row="${bond}"]`)!);
    const held = store.getState().view!.people.bonds.find((entry) => entry.id === bond)!;
    expect(screen.getByRole("heading", { name: new RegExp(`^${nameOf(DELE)}`) })).toBeDefined();
    const shown = document.querySelector<HTMLElement>('[data-phone-app="chats"]')!;
    expect(head(bond).querySelector('[data-head-row="stage"] summary')?.textContent).toContain(say("ui.people.stage.courting"));
    const thread = document.querySelector<HTMLElement>(`[data-chat="${bond}"] [data-thread]`)!;
    for (const moment of held.moments!) expect(within(thread).getByText(momentWords(moment))).toBeDefined();
    expect(within(head(bond)).getByText(say("ui.people.facts.home"))).toBeDefined();
    expect(shown.textContent).not.toMatch(/[₦£$]|people\.|person\./);
    const left = people.partnerMoments - held.moments!.length;
    expect(within(head(bond)).getByText(sayCount("ui.people.courting.next", left, { count: left }))).toBeDefined();
    // The moments still short hold the ask, so the line and a live button never show together.
    expect(within(head(bond)).queryByRole("button", { name: say("ui.people.propose.partner") })).toBeNull();
  });

  test("[person:stand-in-acts-narrowly] given the stand-in on for a friend, then the thread's name carries the stand-in mark", async () => {
    const game = peopleGame();
    const bond = linkedFriend(game);
    game.accept({ type: "people/stand-in", pair: "pair-1", stage: "on" }, "authority");
    await renderWithGame(chats(null), game);
    fireEvent.click(document.querySelector<HTMLElement>(`[data-chat-row="${bond}"]`)!);
    expect(document.querySelector('h3 [data-person-mark="stand-in"]')?.textContent).toBe(say("ui.people.mark.stand-in"));
  });
});

describe("a friend's conversation", () => {
  test("[pair:conversation-phrases-stored] given a thread from the server, then each phrase reads in words, the player's own rows carry the read mark once read, and the other's unread rows are marked new", async () => {
    const { server, game, bond } = friendServer([row("m1", THEM, "phrase.meet-at", "suya-spot", null), row("m2", ME, "phrase.yes", null, 2_000), row("m3", ME, "phrase.thanks", null, null)]);
    const { thread } = await online(server, game, bond);
    await within(thread).findByText(phraseWords("phrase.meet-at", "suya-spot"));
    expect(phraseWords("phrase.meet-at", "suya-spot")).toBe("Let us meet at the suya spot.");
    const own = thread.querySelector<HTMLElement>('[data-row="m2"]')!;
    expect(within(own).getByText(say("ui.talk.read"))).toBeDefined();
    expect(within(thread.querySelector<HTMLElement>('[data-row="m3"]')!).queryByText(say("ui.talk.read"))).toBeNull();
    expect(within(thread.querySelector<HTMLElement>('[data-row="m1"]')!).getByText(say("ui.talk.unread"))).toBeDefined();
  });

  test("[pair:preset-phrases-only] given a phrase with a fill-in, when it is said, then only a fill from its fixed list can go, and the row joins the thread", async () => {
    const { server, game, bond } = friendServer();
    server.answer(`POST /api/pair/${PAIR}/say`, { body: { ok: true, message: row("m9", ME, "phrase.see-you", "beach", null) } });
    const { thread } = await online(server, game, bond);
    fireEvent.click(thread.querySelector<HTMLElement>('[data-phrase="phrase.see-you"]')!);
    const fill = within(thread).getByRole("radiogroup", { name: say("ui.talk.fill") });
    expect([...fill.querySelectorAll<HTMLElement>("[data-fill]")].map((option) => option.dataset.fill)).toEqual(content.people.spots);
    fireEvent.click(fill.querySelector<HTMLElement>('[data-fill="beach"]')!);
    const sayButton = thread.querySelector<HTMLElement>("[data-say]")!;
    expect(sayButton.textContent).toContain(phraseWords("phrase.see-you", "beach"));
    fireEvent.click(sayButton);
    await within(thread).findByText(phraseWords("phrase.see-you", "beach"));
    expect(server.sent.find((sent) => sent.path.endsWith("/say"))?.body).toEqual({ phrase: "phrase.see-you", fill: "beach" });
  });

  test("[pair:phrase-checks-before-send] given the hour's phrases used up, when one more is said, then the refusal says so plainly and stores nothing", async () => {
    const { server, game, bond } = friendServer();
    server.answer(`POST /api/pair/${PAIR}/say`, { body: { ok: false, code: "too-many", detail: "The phrase cannot be sent: too-many." } });
    const { thread } = await online(server, game, bond);
    sayPhrase(thread, "phrase.hello");
    await within(thread).findByText(say("ui.talk.failed.too-many"));
    expect(within(thread).getByText(say("ui.talk.empty"))).toBeDefined();
  });

  test("[pair:phrase-checks-before-send] given the server's rate limit, then the wait is said in seconds; and a block on the other side is only ever not possible", async () => {
    const { server, game, bond } = friendServer();
    server.answer(`POST /api/pair/${PAIR}/say`, { status: 429, body: { ok: false, code: "rate-limited", detail: "slow", retryAfter: 4 } }, { body: { ok: false, code: "not-possible", detail: "That is not possible now." } });
    const { thread } = await online(server, game, bond);
    sayPhrase(thread, "phrase.hello");
    await within(thread).findByText(sayCount("ui.online.wait", 4, { seconds: 4 }));
    fireEvent.click(thread.querySelector<HTMLElement>("[data-say]")!);
    expect(await within(thread).findByText(say("ui.talk.failed.not-possible"))).toBeDefined();
  });

  test("[pair:conversation-phrases-stored] given an open conversation, when the server nudges that a row is new, then the thread fetches after the last row it holds and shows the new one", async () => {
    const { server, game, bond } = friendServer([row("m1", THEM, "phrase.hello", null, null)]);
    const { thread, store } = await online(server, game, bond);
    await waitFor(() => expect(thread.querySelector('[data-row="m1"]')).not.toBeNull());
    server.answer(`GET /api/pair/${PAIR}/conversation`, { body: { ok: true, pair: PAIR, messages: [row("m2", THEM, "phrase.thanks", null, null)] } });
    act(() => store.getState().heardMessages());
    await waitFor(() => expect(thread.querySelector('[data-row="m2"]')?.textContent).toContain(phraseWords("phrase.thanks", null)));
    expect(server.sent.filter((sent) => sent.path.endsWith("/conversation")).at(-1)?.search).toBe("?after=m1");
  });
});

describe("block and report", () => {
  test("[pair:block-and-report-one-tap] [moderation:report-from-every-surface] given a friend's bond online, then block and report sit on the pair record and on the conversation; offline neither shows", async () => {
    const { server, game, bond } = friendServer();
    const { thread } = await online(server, game, bond);
    const app = document.querySelector<HTMLElement>('[data-phone-app="chats"]')!;
    expect(head(bond).querySelector('[data-moderation="pair"]')).not.toBeNull();
    expect(thread.querySelector('[data-moderation="conversation"]')).not.toBeNull();
    expect(within(app).getAllByRole("button", { name: words("ui.block") })).toHaveLength(2);
    document.body.innerHTML = "";
    await renderWithGame(<ModerationProvider api={null}>{chats(null)}</ModerationProvider>, game);
    fireEvent.click(document.querySelector<HTMLElement>(`[data-chat-row="${bond}"]`)!);
    expect(document.querySelector("[data-moderation]")).toBeNull();
    expect(screen.queryByRole("button", { name: words("ui.block") })).toBeNull();
  });

  test("[pair:block-ends-every-bond] given block tapped on the pair record, then it goes to the server for the pair the view's bond names, and the player is told it is over", async () => {
    const { server, game, bond } = friendServer();
    server.answer("POST /api/moderation/block", { body: { ok: true } });
    await online(server, game, bond);
    const record = head(bond).querySelector<HTMLElement>('[data-moderation="pair"]')!;
    fireEvent.click(within(record).getByRole("button", { name: words("ui.block") }));
    await within(record).findByText(words("ui.block.done"));
    expect(server.sent.find((sent) => sent.path === "/api/moderation/block")?.body).toEqual({ pair: PAIR });
  });

  test("[pair:report-holds-conversation] given a report from the conversation, then it cites the pair and the other side's messages, with a block ticked by default", async () => {
    const { server, game, bond } = friendServer([row("m1", THEM, "phrase.hello", null, null), row("m2", ME, "phrase.yes", null, null)]);
    server.answer("POST /api/moderation/report", { body: { ok: true, report: "report-1" } });
    const { thread } = await online(server, game, bond);
    const name = bondName(game.view().people.bonds.find((entry) => entry.id === bond)!);
    await waitFor(() => expect(within(thread.querySelector<HTMLElement>('[data-row="m1"]')!).getByText(name)).toBeDefined());
    const control = thread.querySelector<HTMLElement>('[data-moderation="conversation"]')!;
    fireEvent.click(within(control).getByRole("button", { name: words("ui.report") }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByLabelText<HTMLInputElement>(words("ui.report.also-block")).checked).toBe(true);
    fireEvent.click(within(sheet).getByRole("button", { name: reasonWords("scam") }));
    await within(control).findByText(words("ui.report.sent"));
    expect(server.sent.find((sent) => sent.path === "/api/moderation/report")?.body).toEqual({ pair: PAIR, reason: "scam", messages: ["m1"], block: true });
  });
});
