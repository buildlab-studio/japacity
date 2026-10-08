// The invite link's page against a faked server: the card read before
// sign-up, then the age screen and sign-in, then the card taken for its slot.
import { content } from "@japacity/content";
import type { Id, InviteCard } from "@japacity/sim";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { App } from "../../App";
import { GameProvider } from "../../authority/GameProvider";
import { remoteAuthority } from "../../authority/remote";
import { createGameStore } from "../../authority/store";
import { ModerationProvider } from "../../shared/moderation/ModerationProvider";
import type { AccountApi, AgeAnswer } from "../../shared/net/auth";
import type { AccountView } from "../../shared/net/contract";
import { api } from "../../shared/net/http";
import { engineView } from "../../shared/testing/fixtures";
import { fakeModeration } from "../../shared/testing/moderation";
import "../../shared/testing/render";
import { BASE, fakeServer, type FakeServer } from "../../shared/testing/server";
import { nameOf, say, words } from "../../shared/words/text";
import { answerAge } from "./age.testing";
import { inviteCodeOf, InvitePage, InviteServerProvider } from "./InvitePage";

const CODE = "a1b2c3d4e5f6a1b2c3d4e5f6";
const CLOCK = { tick: 3, nextTickAt: 2_000_000_000_000, nextTurnAt: null };

const CARD: InviteCard = {
  name: "scenario.tunde.name",
  japacity: { percent: 42, route: null },
  looking: { key: "card.invite.looking", slot: "partner", fill: "who-codes", slotKey: "card.invite.slot.partner", fillKey: "card.invite.fill.who-codes" },
  game: "card.invite.game",
  controls: ["block", "report"],
};

const SIGNED_OUT = { status: 401, body: { ok: false, code: "signed-out", detail: "Sign in to play." } };
const NO_CHARACTER = { status: 404, body: { ok: false, code: "no-character", detail: "No character yet." } };

function cardServer(looking: "partner" | "sibling" = "partner", view = SIGNED_OUT): FakeServer {
  const server = fakeServer();
  server.answer(`GET /api/invite/${CODE}`, { body: { ok: true, slot: looking === "partner" ? "partner" : "sibling-1", looking, expires: 9_000, card: { ...CARD, looking: { ...CARD.looking, slot: looking } } } });
  server.answer("GET /api/view", view);
  return server;
}

/** An account whose sign-in the server then honours: the next view fetch answers as the server would for a new account. */
const KEPT: AccountView = { id: "account-1", country: "NG", age: { passed: true, method: "declared" }, createdAt: 1, character: null, sendUsageCounts: true, admin: false, state: "secured", username: "ada_lagos", renameFrom: 0 };

function account(age: AgeAnswer = "passed", afterSignIn: () => void = () => undefined, state: AccountView["state"] = "secured"): AccountApi & { declared: string[] } {
  const declared: string[] = [];
  const ok = () => Promise.resolve({ ok: true } as const);
  return {
    declared,
    startGuest: () => {
      afterSignIn();
      return ok();
    },
    view: () => Promise.resolve({ ...KEPT, state }),
    rename: ok,
    returnedFromGoogle: () => null,
    ageStatus: () => Promise.resolve("unasked"),
    declareAge: (birth) => (declared.push(birth), Promise.resolve(age)),
    sendCode: ok,
    signInWithCode: () => {
      afterSignIn();
      return ok();
    },
    signInWithGoogle: ok,
    signInWithPasskey: () => {
      afterSignIn();
      return ok();
    },
    addPasskey: ok,
    email: () => Promise.resolve(null),
    deleteAccount: ok,
    signOut: () => Promise.resolve(),
    usageCounts: () => Promise.resolve(null),
    setUsageCounts: () => Promise.resolve(true),
  };
}

function openLink(server: FakeServer, accountApi: AccountApi) {
  const remote = remoteAuthority({ baseUrl: BASE, fetch: server.fetch });
  const store = createGameStore(remote, { life: remote, lifeAgain: false, account: accountApi });
  remote.listen((event) => store.getState().heard(event));
  const moderation = fakeModeration();
  render(
    <ModerationProvider api={moderation}>
      <InviteServerProvider value={api({ baseUrl: BASE, fetch: server.fetch })}>
        <App store={store} path={`/invite/${CODE}`} />
      </InviteServerProvider>
    </ModerationProvider>,
  );
  return { store, moderation };
}

async function comeIn() {
  await answerAge("1990-05-01");
  fireEvent.click(await screen.findByRole("button", { name: say("ui.account.returning") }));
  fireEvent.click(await screen.findByRole("button", { name: say("ui.account.passkey") }));
}

describe("the invite link's page", () => {
  test("[R-PAIR-008] given the path /invite/<code>, then the code is read from it; any other path is the game", () => {
    expect(inviteCodeOf(`/invite/${CODE}`)).toBe(CODE);
    expect(inviteCodeOf(`/invite/${CODE}/`)).toBe(CODE);
    expect(inviteCodeOf("/")).toBeNull();
    expect(inviteCodeOf("/invite/")).toBeNull();
  });

  test("[R-PAIR-007] [R-PAIR-008] [R-MODERATION-003] given a partner link, when it is opened signed out, then the card shows before sign-up with its report control, then the age screen, sign-in, a grown-up life and the card taken for its slot", async () => {
    const server = cardServer();
    const friend = account("passed", () => {
      server.answer("GET /api/view", NO_CHARACTER);
    });
    const { store } = openLink(server, friend);

    const card = await screen.findByRole("figure");
    expect(within(card).getByText(nameOf("scenario.tunde"))).toBeDefined();
    expect(within(card).getByText(words("card.invite.looking", { slot: "a partner", fill: "who codes" }))).toBeDefined();
    expect(within(card).getByText(words("card.invite.game"))).toBeDefined();
    expect(document.querySelector('[data-moderation="invite-card"]')).not.toBeNull();
    expect(server.sent.find((request) => request.path === `/api/invite/${CODE}`)?.method).toBe("GET");

    await comeIn();
    expect(friend.declared).toEqual(["1990-05-01"]);
    const scenario = Object.keys(content.scenario).find((id) => id !== "scenario.prologue") as Id<"scenario">;
    server.answer(`POST /api/invite/${CODE}/accept`, { body: { ok: true, pair: "pair-1", character: "c-friend", view: null } });
    fireEvent.click(await screen.findByRole("button", { name: `${say("ui.invite.take")}: ${nameOf(scenario)}` }));
    expect(screen.queryByRole("button", { name: `${say("ui.invite.take")}: ${nameOf("scenario.prologue")}` })).toBeNull();

    expect(await screen.findByText(say("ui.invite.taken"))).toBeDefined();
    expect(server.sent.find((request) => request.path.endsWith("/accept"))?.body).toEqual({ slot: "partner", scenario });

    server.answer("GET /api/view", { body: { ok: true, view: engineView(), lines: [], clock: CLOCK } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.invite.play") }));
    await waitFor(() => expect(document.querySelector("[data-invite-page]")).toBeNull());
    expect(store.getState().choosingLife).toBe(false);
  });

  test("[R-PAIR-008] [R-PEOPLE-011] given a sibling link and an account signed in, then the card is taken as a new life with no scenario asked", async () => {
    const server = cardServer("sibling", NO_CHARACTER);
    server.answer(`POST /api/invite/${CODE}/accept`, { body: { ok: true, pair: "pair-2", character: "c-sib", view: null } });
    openLink(server, account());
    fireEvent.click(await screen.findByRole("button", { name: say("ui.invite.take") }));
    expect(await screen.findByText(say("ui.invite.taken"))).toBeDefined();
    expect(server.sent.find((request) => request.path.endsWith("/accept"))?.body).toEqual({ slot: "sibling-1" });
  });

  test("[R-ACCOUNT-022] [R-PAIR-008] given a new friend who starts as a guest, then the card waits while the page asks to keep the life first, and nothing is accepted", async () => {
    const server = cardServer();
    openLink(server, account("passed", () => server.answer("GET /api/view", NO_CHARACTER), "guest"));
    fireEvent.change(await screen.findByLabelText(say("ui.account.age.label")), { target: { value: "1990-05-01" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.age.go") }));
    fireEvent.change(await screen.findByLabelText(say("ui.account.name.label")), { target: { value: "ada_lagos" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.name.go") }));
    expect(await screen.findByText(say("ui.invite.keep-first"))).toBeDefined();
    expect(screen.queryByRole("button", { name: say("ui.invite.take") })).toBeNull();
    expect(server.sent.some((request) => request.path.endsWith("/accept"))).toBe(false);
  });

  test("[R-PAIR-008] given a browser that does not pass the age screen, then no way in shows and nothing is accepted", async () => {
    const server = cardServer();
    openLink(server, account("refused"));
    await answerAge("2015-01-01");
    expect(await screen.findByText(say("ui.account.age.refused"))).toBeDefined();
    expect(screen.queryByRole("button", { name: say("ui.account.passkey") })).toBeNull();
    expect(server.sent.some((request) => request.path.endsWith("/accept"))).toBe(false);
  });

  test("[R-PAIR-008] given a link already used, then the page says so plainly and offers nothing", async () => {
    const server = fakeServer();
    server.answer(`GET /api/invite/${CODE}`, { body: { ok: false, code: "used", detail: "This link has been used." } });
    const store = createGameStore({ view: () => Promise.resolve(engineView()), send: () => Promise.reject(new Error("unused")) });
    render(
      <GameProvider store={store}>
        <InvitePage code={CODE} server={api({ baseUrl: BASE, fetch: server.fetch })} />
      </GameProvider>,
    );
    expect(await screen.findByText(words("reject.used"))).toBeDefined();
    expect(screen.queryByRole("figure")).toBeNull();
  });
});
