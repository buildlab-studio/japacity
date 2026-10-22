// The passkeys and the ways out on the account sheet: the delete confirmation that only the account's own passkey
// answers, adding a passkey from an older session, the list and its Remove, where a passkey is offered, its errors,
// and signing out here or everywhere.
import type { AccountView } from "@japacity/api";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore, type GameStore } from "../../authority/store";
import { PASSKEY_MARK_KEY, PASSKEY_OFFERED_KEY } from "../../shared/storage/storage";
import { betterAuthApi, type AccountApi, type AuthResult, type PasskeyRow } from "../../shared/net/auth";
import { engineView } from "../../shared/testing/fixtures";
import { fakePhone, type Phone } from "../../shared/testing/passkeys";
import "../../shared/testing/render";
import { BASE, fakeServer } from "../../shared/testing/server";
import { say } from "../../shared/words/text";
import { AccountSettings } from "./Settings";

const OK: AuthResult = { ok: true };
const NOT_FRESH: AuthResult = { ok: false, why: "not-fresh" };
const WHATSAPP = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 WhatsApp/2.24";

type Ways = AccountView["ways"];

function kept(ways: Ways = { google: null, email: "ada@example.com", passkeys: 0 }): AccountView {
  return { id: "account-1", country: "NG", age: { passed: true, method: "declared" }, createdAt: 1, character: "c-1", sendUsageCounts: true, admin: false, state: "secured", username: "ada_lagos", renameFrom: 0, ways };
}

const GOOGLE_ROW: PasskeyRow = { id: "row-1", provider: "Google Password Manager", addedAt: Date.parse("2026-10-01T09:00:00.000Z") };
const PHONE_ROW: PasskeyRow = { id: "row-2", provider: null, addedAt: Date.parse("2026-10-09T09:00:00.000Z") };

function fakeAccount(view: AccountView, over: Partial<AccountApi> = {}): AccountApi & { calls: string[] } {
  const calls: string[] = [];
  const log = (name: string, result: AuthResult = OK) => () => (calls.push(`${name}()`), Promise.resolve(result));
  return {
    calls,
    ageStatus: () => Promise.resolve("passed"),
    declareAge: () => Promise.resolve("passed"),
    startGuest: () => Promise.resolve({ ok: true }),
    view: () => Promise.resolve(view),
    rename: () => Promise.resolve({ ok: true }),
    sendCode: (email) => (calls.push(`sendCode(${email})`), Promise.resolve(OK)),
    signInWithCode: (email, code) => (calls.push(`signInWithCode(${email},${code})`), Promise.resolve(OK)),
    signInWithGoogle: log("signInWithGoogle"),
    returnedFromGoogle: () => null,
    signInWithPasskey: log("signInWithPasskey"),
    addPasskey: log("addPasskey"),
    passkeysWork: () => Promise.resolve(true),
    passkeys: () => Promise.resolve([]),
    removePasskey: (id) => (calls.push(`removePasskey(${id})`), Promise.resolve({ ok: true, signedIn: true })),
    confirmWithPasskey: log("confirmWithPasskey"),
    email: () => Promise.resolve("ada@example.com"),
    usageCounts: () => Promise.resolve(null),
    setUsageCounts: () => Promise.resolve(true),
    deleteAccount: (code) => (calls.push(`deleteAccount(${String(code)})`), Promise.resolve(OK)),
    signOut: log("signOut"),
    signOutEverywhere: log("signOutEverywhere"),
    ...over,
    // A stand-in given for these is still heard, so the order of the calls can be told.
    ...(over.addPasskey === undefined ? {} : { addPasskey: () => (calls.push("addPasskey()"), (over.addPasskey as AccountApi["addPasskey"])()) }),
  };
}

function settings(account: AccountApi): GameStore {
  const store = createGameStore({ view: () => Promise.resolve(engineView()), send: () => Promise.reject(new Error("unused")) }, { account });
  render(
    <GameProvider store={store}>
      <AccountSettings account={account} />
    </GameProvider>,
  );
  return store;
}

/** Answers each call in turn, the last one again after that. */
function inTurn<T>(...answers: T[]): () => Promise<T> {
  return () => Promise.resolve((answers.length > 1 ? answers.shift() : answers[0]) as T);
}

async function askToDelete() {
  fireEvent.click(await screen.findByRole("button", { name: say("ui.account.delete") }));
  fireEvent.click(screen.getByRole("button", { name: say("ui.account.delete.confirm") }));
  await screen.findByText(say("ui.account.delete.fresh"));
}

let phone: Phone | null = null;

beforeEach(() => {
  localStorage.removeItem(PASSKEY_OFFERED_KEY);
  localStorage.removeItem(PASSKEY_MARK_KEY);
});

afterEach(() => {
  phone?.restore();
  phone = null;
  vi.restoreAllMocks();
});

describe("the delete confirmation (account:player-deletes-account)", () => {
  test("[account:player-deletes-account] given a stale session and a phone that answers with a passkey of another account, when the deletion is confirmed with a passkey, then no session is opened for that account, nothing is deleted, and the player is told", async () => {
    const server = fakeServer();
    const account = betterAuthApi({ baseUrl: BASE, fetch: server.fetch });
    phone = fakePhone({ signsInWith: "b3RoZXJzLWtleQ" });
    server.answer("GET /api/account", { body: { ok: true, account: kept({ google: null, email: "ada@example.com", passkeys: 1 }) } });
    server.answer("GET /api/auth/passkey/list-user-passkeys", { body: [{ id: "row-1", credentialID: "b3duLWtleQ", userId: "account-1", aaguid: null, createdAt: "2026-10-01T09:00:00.000Z" }] });
    server.answer("DELETE /api/account", { status: 403, body: { ok: false, code: "not-fresh", detail: "Sign in again or send a code to your email." } }, { body: { ok: true, dueAt: 1 } });
    server.answer("GET /api/auth/get-session", { body: { session: { id: "s-1" }, user: { id: "account-1", email: "ada@example.com" } } });
    server.answer("GET /api/auth/passkey/generate-authenticate-options", { body: { challenge: "Y2hhbGxlbmdl", rpId: "play.test", userVerification: "preferred" } });
    server.answer("POST /api/auth/passkey/verify-authentication", { body: { session: { id: "s-other" }, user: { id: "account-2" } } });
    const store = settings(account);
    await askToDelete();
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.passkey") }));
    expect(await screen.findByText(say("ui.account.fail.other-account"))).toBeDefined();
    const sent = server.sent.map((request) => `${request.method} ${request.path}`);
    expect(sent).not.toContain("POST /api/auth/passkey/verify-authentication");
    expect(sent.filter((route) => route === "DELETE /api/account")).toHaveLength(1);
    expect(store.getState().signedOut).toBe(false);
  });

  test("[account:player-deletes-account] [account:passkey-errors-told-apart] given the passkey prompt cancelled on the confirmation, then nothing is said and nothing is deleted", async () => {
    const account = fakeAccount(kept({ google: null, email: "ada@example.com", passkeys: 1 }), { deleteAccount: inTurn<AuthResult>(NOT_FRESH), confirmWithPasskey: () => Promise.resolve({ ok: false, why: "cancelled" }) });
    const store = settings(account);
    await askToDelete();
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.passkey") }));
    await waitFor(() => expect(screen.getByRole("button", { name: say("ui.account.passkey") }).hasAttribute("disabled")).toBe(false));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(store.getState().signedOut).toBe(false);
  });
});

describe("adding a passkey from an older session (account:passkey-added-in-place)", () => {
  test("[account:passkey-added-in-place] given a session older than the fresh age, when a passkey is added, then the sheet asks to confirm in place, a code to the account's email confirms it, and the passkey is made at once", async () => {
    const account = fakeAccount(kept(), { addPasskey: inTurn<AuthResult>(NOT_FRESH, OK) });
    const store = settings(account);
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.passkey.add") }));
    expect(await screen.findByText(say("ui.account.passkey.fresh"))).toBeDefined();
    // No passkey is held, so only the code confirms.
    expect(screen.queryByRole("button", { name: say("ui.account.passkey.fresh.passkey") })).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.passkey.fresh.code", { email: "ada@example.com" }) }));
    fireEvent.change(await screen.findByLabelText(say("ui.account.code.label")), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.passkey.fresh.code.go") }));
    expect(await screen.findByText(say("ui.account.passkey.added"))).toBeDefined();
    expect(account.calls.filter((call) => !call.startsWith("passkeys"))).toEqual(["addPasskey()", "sendCode(ada@example.com)", "signInWithCode(ada@example.com,123456)", "addPasskey()"]);
    expect(store.getState().signedOut).toBe(false);
  });

  test("[account:passkey-in-email-autofill] given a passkey added here, then this browser is marked, so its ways back in put the passkey first; a failed add marks nothing", async () => {
    settings(fakeAccount(kept(), { addPasskey: inTurn<AuthResult>({ ok: false, why: "cancelled" }, OK) }));
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.passkey.add") }));
    await waitFor(() => expect(localStorage.getItem(PASSKEY_MARK_KEY)).toBeNull());
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.passkey.add") }));
    expect(await screen.findByText(say("ui.account.passkey.added"))).toBeDefined();
    expect(localStorage.getItem(PASSKEY_MARK_KEY)).not.toBeNull();
  });

  test("[account:passkey-added-in-place] given an account holding a passkey, then its own passkey confirms instead, and the new one is made at once", async () => {
    const account = fakeAccount(kept({ google: "ada@example.com", email: "ada@example.com", passkeys: 1 }), { addPasskey: inTurn<AuthResult>(NOT_FRESH, OK), passkeys: () => Promise.resolve([GOOGLE_ROW]) });
    settings(account);
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.passkey.add") }));
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.passkey.fresh.passkey") }));
    expect(await screen.findByText(say("ui.account.passkey.added"))).toBeDefined();
    expect(account.calls).toEqual(["addPasskey()", "confirmWithPasskey()", "addPasskey()"]);
  });

  test("[account:passkey-added-in-place] [account:passkey-needs-signed-in-session] given an admin holding a passkey whose session has not shown one lately, when a passkey is added and the server asks for a passkey session, then the sheet asks to confirm in place with the account's own passkey alone, and the new one is made at once", async () => {
    const account = fakeAccount(kept({ google: null, email: "ada@example.com", passkeys: 1 }), { addPasskey: inTurn<AuthResult>({ ok: false, why: "passkey-first" }, OK), passkeys: () => Promise.resolve([GOOGLE_ROW]) });
    const store = settings(account);
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.passkey.add") }));
    expect(await screen.findByText(say("ui.account.passkey.fresh"))).toBeDefined();
    expect(screen.queryByText(say("ui.account.fail.passkey-first"))).toBeNull();
    // A code opens no passkey session, so it is not offered: only the account's own passkey answers the server.
    expect(screen.queryByRole("button", { name: say("ui.account.passkey.fresh.code", { email: "ada@example.com" }) })).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.passkey.fresh.passkey") }));
    expect(await screen.findByText(say("ui.account.passkey.added"))).toBeDefined();
    expect(account.calls.filter((call) => !call.startsWith("passkeys"))).toEqual(["addPasskey()", "confirmWithPasskey()", "addPasskey()"]);
    expect(store.getState().signedOut).toBe(false);
  });

  test("[account:passkey-added-in-place] given a phone that wants its own tap for the new passkey after the confirmation, then the sheet says to tap Add a passkey to finish", async () => {
    const account = fakeAccount(kept(), { addPasskey: inTurn<AuthResult>(NOT_FRESH, { ok: false, why: "cancelled" }) });
    settings(account);
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.passkey.add") }));
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.passkey.fresh.code", { email: "ada@example.com" }) }));
    fireEvent.change(await screen.findByLabelText(say("ui.account.code.label")), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.passkey.fresh.code.go") }));
    expect(await screen.findByText(say("ui.account.passkey.fresh.done"))).toBeDefined();
    expect(screen.getByRole("button", { name: say("ui.account.passkey.add") })).toBeDefined();
  });
});

describe("the passkeys listed and removed (account:passkeys-listed-and-removed)", () => {
  test("[account:passkeys-listed-and-removed] given two passkeys, then each shows by its provider's name, or Passkey, with the day it was added, and one is removed at once with other phones said to be signed out", async () => {
    const account = fakeAccount(kept({ google: null, email: "ada@example.com", passkeys: 2 }), { passkeys: () => Promise.resolve([GOOGLE_ROW, PHONE_ROW]) });
    const store = settings(account);
    const first = await screen.findByText("Google Password Manager");
    const row = first.closest("li");
    expect(row?.textContent).toContain("Added");
    expect(screen.getByText(say("ui.account.passkey.provider"))).toBeDefined();
    expect(screen.getByText("2 passkeys")).toBeDefined();
    fireEvent.click(within(row as HTMLElement).getByRole("button", { name: /^Remove Google Password Manager, added / }));
    expect(await screen.findByText(say("ui.account.passkey.removed"))).toBeDefined();
    expect(account.calls).toEqual(["removePasskey(row-1)"]);
    expect(store.getState().signedOut).toBe(false);
  });

  test("[account:passkeys-listed-and-removed] given the last passkey, then Remove asks first and names the way still left; kept, nothing goes; removed with this phone's session ended, the player leaves signed out", async () => {
    const account = fakeAccount(kept({ google: "ada.g@example.com", email: "ada.g@example.com", passkeys: 1 }), { passkeys: () => Promise.resolve([GOOGLE_ROW]), removePasskey: (id) => (account.calls.push(`removePasskey(${id})`), Promise.resolve({ ok: true, signedIn: false })) });
    const store = settings(account);
    fireEvent.click(await screen.findByRole("button", { name: /^Remove Google Password Manager/ }));
    expect(await screen.findByText(say("ui.account.passkey.last.google"))).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.passkey.last.keep") }));
    expect(screen.queryByText(say("ui.account.passkey.last.google"))).toBeNull();
    expect(account.calls).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: /^Remove Google Password Manager/ }));
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.passkey.last.go") }));
    await waitFor(() => expect(store.getState().signedOut).toBe(true));
    expect(store.getState().accountNotice).toBe("ui.account.notice.signed-out");
    expect(account.calls).toEqual(["removePasskey(row-1)"]);
  });

  test("[account:passkeys-listed-and-removed] given the last passkey of a life kept by a code, then the way left is the code to its email", async () => {
    const account = fakeAccount(kept({ google: null, email: "ada@example.com", passkeys: 1 }), { passkeys: () => Promise.resolve([PHONE_ROW]) });
    settings(account);
    fireEvent.click(await screen.findByRole("button", { name: /^Remove Passkey, added / }));
    expect(await screen.findByText(say("ui.account.passkey.last.email", { email: "ada@example.com" }))).toBeDefined();
  });
});

describe("where a passkey is offered (account:passkey-offered-where-it-works)", () => {
  test("[account:passkey-offered-where-it-works] given a browser that cannot make a passkey, then no Add a passkey shows, and the delete confirmation offers none either", async () => {
    const account = fakeAccount(kept({ google: null, email: "ada@example.com", passkeys: 1 }), { passkeysWork: () => Promise.resolve(false), deleteAccount: inTurn<AuthResult>(NOT_FRESH) });
    settings(account);
    await askToDelete();
    expect(await screen.findByRole("button", { name: say("ui.account.delete.code", { email: "ada@example.com" }) })).toBeDefined();
    expect(screen.queryByRole("button", { name: say("ui.account.passkey.add") })).toBeNull();
    expect(screen.queryByRole("button", { name: say("ui.account.passkey") })).toBeNull();
  });

  test("[account:passkey-offered-where-it-works] given an in-app browser, then no passkey is offered, whatever the browser says", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(WHATSAPP);
    const account = fakeAccount(kept());
    settings(account);
    expect(await screen.findByText("Passkey: none yet")).toBeDefined();
    await Promise.resolve();
    expect(screen.queryByRole("button", { name: say("ui.account.passkey.add") })).toBeNull();
  });

  test("[account:passkey-offered-where-it-works] given a kept life with no passkey, then the first sheet on this device offers one quietly with Not now, and every later one shows the plain line", async () => {
    const account = fakeAccount(kept());
    settings(account);
    expect(await screen.findByText(say("ui.account.passkey.offer"))).toBeDefined();
    expect(screen.getAllByRole("button", { name: say("ui.account.passkey.add") })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.passkey.later") }));
    expect(screen.queryByText(say("ui.account.passkey.offer"))).toBeNull();
    expect(screen.getByText(say("ui.account.passkey.why"))).toBeDefined();
    expect(localStorage.getItem(PASSKEY_OFFERED_KEY)).not.toBeNull();
    document.body.innerHTML = "";
    settings(fakeAccount(kept()));
    expect(await screen.findByText(say("ui.account.passkey.why"))).toBeDefined();
    expect(screen.queryByText(say("ui.account.passkey.offer"))).toBeNull();
  });

  test("[account:passkey-offered-where-it-works] given a kept life that already holds a passkey, then nothing is offered, only the plain line", async () => {
    const account = fakeAccount(kept({ google: null, email: "ada@example.com", passkeys: 1 }), { passkeys: () => Promise.resolve([GOOGLE_ROW]) });
    settings(account);
    expect(await screen.findByText(say("ui.account.passkey.why"))).toBeDefined();
    expect(screen.queryByText(say("ui.account.passkey.offer"))).toBeNull();
  });
});

describe("passkey errors on the sheet (account:passkey-errors-told-apart)", () => {
  test("[account:passkey-errors-told-apart] given the prompt for a new passkey cancelled, then the sheet says nothing; given one already on this phone, then it says so", async () => {
    const account = fakeAccount(kept(), { addPasskey: inTurn<AuthResult>({ ok: false, why: "cancelled" }, { ok: false, why: "already-here" }) });
    settings(account);
    const add = await screen.findByRole("button", { name: say("ui.account.passkey.add") });
    fireEvent.click(add);
    await waitFor(() => expect(add.hasAttribute("disabled")).toBe(false));
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(add);
    expect(await screen.findByText(say("ui.account.fail.already-here"))).toBeDefined();
  });
});

describe("signing out (account:sign-out-ends-the-session)", () => {
  test("[account:sign-out-ends-the-session] given a sign-out that does not reach the server, then the player stays in and is told; once it does, the player leaves signed out", async () => {
    const account = fakeAccount(kept(), { signOut: inTurn<AuthResult>({ ok: false, why: "sign-out" }, OK) });
    const store = settings(account);
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.sign-out") }));
    expect(await screen.findByText(say("ui.account.fail.sign-out"))).toBeDefined();
    expect(store.getState().signedOut).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.sign-out") }));
    await waitFor(() => expect(store.getState().signedOut).toBe(true));
    expect(store.getState().accountNotice).toBe("ui.account.notice.signed-out");
  });

  test("[account:sign-out-ends-the-session] given sign out on every phone, then it asks first; Stay signed in keeps all; confirmed, every session ends and the player leaves signed out", async () => {
    const account = fakeAccount(kept());
    const store = settings(account);
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.sign-out.all") }));
    expect(screen.getByText(say("ui.account.sign-out.all.warn"))).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.sign-out.all.keep") }));
    expect(account.calls).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.sign-out.all") }));
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.sign-out.all.go") }));
    await waitFor(() => expect(store.getState().signedOut).toBe(true));
    expect(store.getState().accountNotice).toBe("ui.account.notice.signed-out");
    expect(account.calls).toEqual(["signOutEverywhere()"]);
  });

  test("[account:sign-out-ends-the-session] given a guest, then there is no sign out on every phone: its one session is its only way back", async () => {
    const account = fakeAccount({ ...kept(), state: "guest", ways: { google: null, email: null, passkeys: 0 } });
    settings(account);
    expect(await screen.findByRole("button", { name: say("ui.account.sign-out") })).toBeDefined();
    expect(screen.queryByRole("button", { name: say("ui.account.sign-out.all") })).toBeNull();
  });
});
