// Two walks over the interface. Every surface where a player meets another
// player or something the game did not write carries the block and report
// control (R-MODERATION-003). No advert slot shows on a card, a guide, the
// report or block screens, or the sign-up and age screens (R-ADVERT-003).
import { content } from "@japacity/content";
import type { ConversationRow, PlayerView } from "@japacity/sim";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, test } from "vitest";

import { App } from "./App";
import { GameProvider } from "./authority/GameProvider";
import { createGameStore, type GameStore } from "./authority/store";
import { pickBirth } from "./features/account/age.testing";
import { InvitePage, InviteServerProvider } from "./features/account/InvitePage";
import type { ServedAdvert } from "./features/adverts/adverts";
import { AdvertsProvider, PhoneTile } from "./features/adverts/placed";
import { GuidesMenu } from "./features/guides/GuidesMenu";
import { pairApiFor, PairApiProvider, usePairApi } from "./features/people/pairApi";
import { BondHead, PeopleSlots } from "./features/people/PeopleOnPhone";
import { Chats, PhonePeople, PhoneTalk } from "./features/phone/apps/Chats";
import { MODERATION_SURFACES } from "./shared/moderation/BlockReport";
import { ModerationProvider } from "./shared/moderation/ModerationProvider";
import { words } from "./shared/moderation/moderation.words";
import type { AccountApi } from "./shared/net/auth";
import { api } from "./shared/net/http";
import { engineView, fakeAuthority } from "./shared/testing/fixtures";
import { fakeModeration } from "./shared/testing/moderation";
import { linkedFriend, PAIR, peopleGame, renderWithGame } from "./shared/testing/people";
import "./shared/testing/render";
import { BASE, fakeServer, type FakeServer } from "./shared/testing/server";
import { say } from "./shared/words/text";

const CODE = "c0ffeec0ffeec0ffeec0ffee";
const THEM = "character-them";

function served(slot: string): ServedAdvert {
  const entry = content.advert[slot as keyof typeof content.advert]!;
  return { campaign: `campaign-${slot}`, creative: "creative-1", version: 1, image: "/img", width: entry.width, height: entry.height, advertiser: "Mama Put Kitchen", text: "Jollof on the island.", link: null };
}

/** A server that answers every route the walks touch: a friend's pair, an invite card, and every advert slot filled. */
function everything(): FakeServer {
  const server = fakeServer();
  const row: ConversationRow = { id: "m1", conversation: PAIR, sender: THEM, phrase: "phrase.hello", fill: null, sentAt: 1, readAt: null };
  server.answer(`GET /api/pair/${PAIR}`, { body: { ok: true, pair: { id: PAIR, side: "a", them: THEM } } });
  server.answer(`GET /api/pair/${PAIR}/conversation`, { body: { ok: true, pair: PAIR, messages: [row] } });
  server.answer(`GET /api/invite/${CODE}`, {
    body: {
      ok: true,
      slot: "partner",
      looking: "partner",
      expires: 9_000,
      card: { name: "scenario.tunde.name", japacity: { percent: 40, route: null }, looking: { key: "card.invite.looking", slot: "partner", fill: null, slotKey: "card.invite.slot.partner", fillKey: null }, game: "card.invite.game", controls: ["block", "report"] },
    },
  });
  server.answer("GET /api/account", { body: { ok: true, account: { id: "a-1", country: "NG", age: { passed: true, method: "declared" }, createdAt: 1, character: "c-1" } } });
  server.answer("GET /api/adverts", { body: { ok: true, region: "NG", hour: 1, until: Date.now() + 3_600_000, slots: Object.fromEntries(Object.keys(content.advert).map((slot) => [slot, served(slot)])) } });
  return server;
}

function providers(server: FakeServer, children: ReactNode) {
  const http = api({ baseUrl: BASE, fetch: server.fetch });
  return (
    <ModerationProvider api={fakeModeration()}>
      <PairApiProvider value={pairApiFor(BASE, server.fetch)}>
        <InviteServerProvider value={http}>
          <AdvertsProvider value={{ api: http, baseUrl: BASE }}>{children}</AdvertsProvider>
        </InviteServerProvider>
      </PairApiProvider>
    </ModerationProvider>
  );
}

/** Chats with the people feature's screens as App hands them to the phone, on the pair routes the shell gives it (moved from the old people tab). */
function PeopleChats() {
  const pairs = usePairApi();
  return (
    <PhoneTalk value={pairs}>
      <PhonePeople value={{ head: (bond) => <BondHead bond={bond} api={pairs} />, slots: <PeopleSlots api={pairs} /> }}>
        <Chats />
      </PhonePeople>
    </PhoneTalk>
  );
}

/** A friend's bond online, its Chats thread opened as a player opens it: the pair record on its head, the conversation under it. */
async function friendThread(server: FakeServer): Promise<void> {
  const game = peopleGame();
  const bond = linkedFriend(game);
  await renderWithGame(providers(server, <PeopleChats />), game);
  fireEvent.click(document.querySelector<HTMLElement>(`[data-chat-row="${bond}"]`)!);
  await screen.findByRole("region", { name: say("ui.talk.title") });
}

async function storeOf(view: PlayerView): Promise<GameStore> {
  const store = createGameStore(fakeAuthority(view));
  await store.getState().refresh();
  return store;
}

const advertsOn = (): PlayerView => ({ ...engineView("scenario.tunde"), adverts: true });

/** Each surface of R-MODERATION-003, opened the way a player reaches it. */
const OPEN: Record<(typeof MODERATION_SURFACES)[number], (server: FakeServer) => Promise<void>> = {
  pair: friendThread,
  conversation: async (server) => OPEN.pair(server),
  "invite-card": async (server) => {
    render(<GameProvider store={await storeOf(engineView())}>{providers(server, <InvitePage code={CODE} />)}</GameProvider>);
    await screen.findByRole("figure");
  },
  advert: async (server) => {
    render(<GameProvider store={await storeOf(advertsOn())}>{providers(server, <PhoneTile />)}</GameProvider>);
    fireEvent.click(await screen.findByRole("button", { name: `${say("advert.label")}: Mama Put Kitchen` }));
    await screen.findByRole("dialog");
  },
};

describe("the block and report control on every surface", () => {
  test.each(MODERATION_SURFACES.map((surface) => [surface]))("[R-MODERATION-003] given the %s surface online, when a player reaches it, then the report control is there", async (surface) => {
    await OPEN[surface](everything());
    const control = await waitFor(() => {
      const found = document.querySelector<HTMLElement>(`[data-moderation="${surface}"]`);
      expect(found).not.toBeNull();
      return found!;
    });
    expect(within(control).getByRole("button", { name: words("ui.report") })).toBeDefined();
  });
});

const slots = (within: ParentNode = document) => within.querySelectorAll("[data-advert-slot]");

describe("where no advert shows", () => {
  // The world draws no advert slot of its own (City.tsx shows the place's adverts only off the world), so the phone tile and
  // the guides are walked as the components they are, under the same providers.
  test("[R-ADVERT-003] given every slot filled, when the phone tile shows, then it is there to be found, so the walks below are not empty", async () => {
    render(<GameProvider store={await storeOf(advertsOn())}>{providers(everything(), <PhoneTile />)}</GameProvider>);
    await waitFor(() => expect(slots()).toHaveLength(1));
  });

  test("[R-ADVERT-003] given every slot filled, when the guides open, then the guide holds no advert", async () => {
    render(
      <GameProvider store={await storeOf(advertsOn())}>
        {providers(
          everything(),
          <>
            <PhoneTile />
            <GuidesMenu row />
          </>,
        )}
      </GameProvider>,
    );
    await waitFor(() => expect(slots()).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: say("guide.page.menu") }));
    expect(slots(await screen.findByRole("dialog"))).toHaveLength(0);
  });

  test("[R-ADVERT-003] given every slot filled, when the advert's report screen opens, then it holds no advert", async () => {
    render(<GameProvider store={await storeOf(advertsOn())}>{providers(everything(), <PhoneTile />)}</GameProvider>);
    fireEvent.click(await screen.findByRole("button", { name: `${say("advert.label")}: Mama Put Kitchen` }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: words("ui.report") }));
    const report = await screen.findByRole("dialog", { name: words("ui.report.title", { name: "Mama Put Kitchen" }) });
    expect(slots(report)).toHaveLength(0);
  });

  test("[R-ADVERT-003] given every slot filled and a friend's bond, when block and report are reached, then neither holds an advert", async () => {
    await friendThread(everything());
    const control = await waitFor(() => document.querySelector<HTMLElement>('[data-moderation="pair"]')!);
    fireEvent.click(within(control).getByRole("button", { name: words("ui.block") }));
    await within(control).findByText(words("ui.block.done"));
    expect(slots()).toHaveLength(0);
    fireEvent.click(within(control).getByRole("button", { name: words("ui.report") }));
    expect(slots(await screen.findByRole("dialog"))).toHaveLength(0);
  });

  test("[R-ADVERT-003] given every slot filled, when a share card is due, then the card holds no advert", async () => {
    // A card that opens on its own when due: the send-off no longer does (share.md R-SHARE-015), the granted card still does.
    const card = { kind: "granted" as const, route: "route.uk-masters" as const, percent: 82, months: 35, standing: 61, topActivities: [], chapter: null, name: null };
    const store = await storeOf({ ...advertsOn(), card });
    // A grant comes long after the early win, which the share card waits for (R-GUIDE-015).
    store.setState({ earlyWin: true });
    render(providers(everything(), <App store={store} />));
    const sheet = await screen.findByRole("dialog");
    expect(sheet.querySelector("[data-share-card]")).not.toBeNull();
    expect(slots(sheet)).toHaveLength(0);
  });

  test("[R-ADVERT-003] given every slot filled, when a signed-out player meets the start screen, the age screen, the door's page with the username and the ways back in, then none holds an advert", async () => {
    const account = {
      ageStatus: () => Promise.resolve("unasked"),
      declareAge: () => Promise.resolve("passed"),
      sendCode: () => Promise.resolve({ ok: true }),
      returnedFromGoogle: () => null,
    } as unknown as AccountApi;
    const store = createGameStore({ view: () => Promise.resolve(advertsOn()), send: () => Promise.reject(new Error("unused")) }, { account });
    store.getState().leave(null);
    render(providers(everything(), <App store={store} />));
    expect(await screen.findByRole("button", { name: say("ui.account.start.play") })).toBeDefined();
    expect(slots()).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.start.play") }));
    await pickBirth("1990-01-01");
    expect(slots()).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.age.go") }));
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${say("ui.door.next")}`) }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${say("ui.door.next")}`) }));
    await screen.findByLabelText(say("ui.account.name.label"));
    expect(slots()).toHaveLength(0);
    cleanup();
    localStorage.clear();
    render(providers(everything(), <App store={store} />));
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.start.returning") }));
    await screen.findByRole("button", { name: say("ui.account.google") });
    expect(slots()).toHaveLength(0);
  });

  test("[R-ADVERT-003] given every slot filled, when the invite link's sign-up page shows, then it holds no advert", async () => {
    render(<GameProvider store={await storeOf(advertsOn())}>{providers(everything(), <InvitePage code={CODE} />)}</GameProvider>);
    await screen.findByRole("figure");
    expect(slots()).toHaveLength(0);
  });
});
